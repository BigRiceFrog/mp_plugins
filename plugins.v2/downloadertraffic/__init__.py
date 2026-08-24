# -*- coding: utf-8 -*-
"""
下载器流量统计插件 (MoviePilot V2)

功能：
  - 定时采集 qBittorrent / Transmission 的上传、下载流量
  - 按「年 / 月 / 日」统计
  - 细分到每个 PT 站点（通过种子的 tracker 域名归属）

统计原理：
  - 不依赖下载器全局计数器（会因重启清零），而是读取每颗种子的累计上传/下载量，
    每次采集做「差值(delta)」累加，因此对下载器重启是健壮的。
  - 每颗种子通过 trackers 列表里的 tracker 域名归属到具体 PT 站点（用 SitesHelper 映射站点名）。
  - 数据落盘到插件独立数据目录下的 SQLite (traffic.db)。
"""
import sqlite3
import threading
import traceback
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from apscheduler.triggers.cron import CronTrigger
from fastapi import Request

# 核心依赖：与官方/可运行的 V2 插件（limit、removelinkjellyfinfix）保持完全一致
from app.log import logger

# _PluginBase：本机 MP 版本路径为 app.plugins（复数）；旧版为 app.plugin（单数）。双路径容错。
try:
    from app.plugins import _PluginBase
except Exception:  # pragma: no cover
    try:
        from app.plugin import _PluginBase
    except Exception:  # pragma: no cover
        _PluginBase = object

# 事件相关：本机 MP 版本路径为 app.core.event / app.schemas.types（app.event 不存在）。双路径容错。
try:
    from app.core.event import eventmanager
except Exception:  # pragma: no cover
    eventmanager = None

try:
    from app.schemas.types import EventType
except Exception:  # pragma: no cover
    try:
        from app.event import EventType
    except Exception:  # pragma: no cover
        EventType = None

try:
    from app.helper.downloader import DownloaderHelper
except Exception:  # pragma: no cover
    DownloaderHelper = None

try:
    from app.helper.sites import SitesHelper
except Exception:  # pragma: no cover
    SitesHelper = None

# 站点表读取：官方「站点数据统计」插件同款用法 SiteOper()（无参）最能反映「站点设置」里的站点。
# 之前尝试 from app.db import db_query / app.db.models.site 在本机读不到 → 候选为 0。
try:
    from app.db.site_oper import SiteOper
except Exception:  # pragma: no cover
    SiteOper = None

# db_query + Site 模型直查作为兜底（部分 MP 版本可用）
try:
    from app.db import db_query
    from app.db.models.site import Site
except Exception:  # pragma: no cover
    try:
        from app.db import db_query
        from app.db.models import Site
    except Exception:  # pragma: no cover
        db_query = None
        Site = None

if db_query is not None and Site is not None:
    @db_query
    def _query_all_sites(db):
        """查询 MP 站点设置里配置的全部站点。db_query 装饰器会自动注入并关闭会话。"""
        return list(db.query(Site).all())
else:  # pragma: no cover
    def _query_all_sites():
        return []

# ---------------------------------------------------------------------------
# 兼容性：不同 MoviePilot 版本的 TorrentInformation 字段名可能略有差异，
# 这里用「防御式取值」统一处理（dict / 对象两种形态都兼容）。
# ---------------------------------------------------------------------------


# 不同 MoviePilot 版本里 TorrentInformation / TorrentDictionary 的字段名不一致，
# 这里把常见别名都列上，按优先级依次尝试（dict / 对象两种形态都兼容）。
_FIELD_ALIASES = {
    "hash": ("hash", "hashString", "hash_string", "infohash", "info_hash"),
    "uploaded": ("uploaded", "uploaded_ever", "uploadedEver", "uploaded_total", "total_uploaded", "up"),
    "downloaded": ("downloaded", "downloaded_ever", "downloadedEver", "downloaded_total", "total_downloaded", "down"),
    "trackers": ("trackers", "tracker", "tracker_list"),
    "added_on": ("added_on", "added_date", "date_added", "creation_date"),
}


def _norm(s: Any) -> str:
    """字段名归一化：转小写并去掉下划线/连字符，兼容 uploadedEver / uploaded_ever 等异构命名。"""
    return str(s).lower().replace("_", "").replace("-", "")


def _field(obj: Any, *names: str, default: Any = None) -> Any:
    """从对象/字典里按多个候选字段名取值。

    兼容各下载器客户端（dict / 内部 _fields 字典 / 普通属性），并使用「去分隔符+小写」的
    归一化匹配，因此无论是 uploadedEver、uploaded_ever 还是 uploaded-ever 都能对上，
    避免因字段命名差异读不到值（如 transmission-rpc 的 Torrent._fields）。
    """
    if obj is None:
        return default
    target = {_norm(n) for n in names}

    def _hit(v: Any) -> bool:
        return v is not None

    # 1) dict / 内部 _fields 字典（transmission-rpc 等把数据存在这里）
    if isinstance(obj, dict):
        mapping = obj
    else:
        mapping = getattr(obj, "_fields", None)
    if isinstance(mapping, dict):
        for k, v in mapping.items():
            if _norm(k) in target and _hit(v):
                return v

    # 2) 普通属性：遍历对象属性，按归一化名匹配（任意命名）
    if not isinstance(obj, dict):
        for a in dir(obj):
            if a.startswith("__") or _norm(a) not in target:
                continue
            try:
                val = getattr(obj, a)
            except Exception:  # pragma: no cover
                continue
            if _hit(val) and not callable(val):
                return val
    return default


def _field_multi(obj: Any, key: str, default: Any = None) -> Any:
    """用预定义的别名表按 key 取值，兼容 dict / 对象。"""
    return _field(obj, *_FIELD_ALIASES.get(key, (key,)), default=default)


def _redact_url(u: Any) -> str:
    """把 tracker URL 脱敏为仅剩域名：去掉路径/query（含 passkey），避免敏感信息进日志。"""
    if not u:
        return ""
    s = str(u).strip().strip("`'\"")
    if not s:
        return ""
    try:
        parsed = urlparse(s)
        return parsed.hostname or s
    except Exception:  # pragma: no cover
        return s


def _extract_domain(url: str) -> str:
    """从 tracker url 中提取域名，例如 http://tracker.example.com/announce -> example.com"""
    if not url:
        return ""
    s = url.strip()
    # 去掉协议
    if "://" in s:
        s = s.split("://", 1)[1]
    # 去掉路径/端口/用户名
    s = s.split("/")[0]
    s = s.split("@")[-1]
    s = s.split(":")[0]
    return s.lower()


def _parse_site_domain_map(raw) -> List[Tuple[str, str]]:
    """解析「手动站点域名映射」配置。

    每行一条「站点名=域名」，多个域名用英文/中文逗号分隔；支持 # 注释。
    用于 tracker 域名与 MP 站点设置域名不一致的站点（如 AGSVPT 站点填 agsvpt.com、
    但 tracker 是 tracker.agsvpt.cn），手动指定后即可正确归属。
    """
    result: List[Tuple[str, str]] = []
    if not raw:
        return result
    if isinstance(raw, (list, tuple)):
        lines = [str(x) for x in raw]
    else:
        lines = str(raw).replace("；", ";").splitlines()
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        sep = "=" if "=" in line else (":" if ":" in line else None)
        if not sep:
            continue
        name, dom_part = line.split(sep, 1)
        name = name.strip()
        dom_part = dom_part.strip()
        if not name or not dom_part:
            continue
        result.append((name, dom_part))
    return result


class DownloaderTraffic(_PluginBase):
    # 站点映射诊断日志去重（只对前几个不同的 host 打一次，避免每条种子刷屏）
    _diag_hosts: set = set()

    # ----------------------- 插件元信息 -----------------------
    plugin_name = "下载器流量统计"
    plugin_version = "1.6.0"
    # icon 可换成你自己的图片 URL；这里复用官方仓库的通用图标占位
    plugin_icon = "https://raw.githubusercontent.com/jxxghp/MoviePilot-Plugins/main/icons/statistic.png"
    plugin_desc = "按年/月/日统计 qBittorrent、Transmission 的上传/下载流量，并细分到每个 PT 站点"
    plugin_description = "按年/月/日统计 qBittorrent、Transmission 的上传/下载流量，并细分到每个 PT 站点"
    plugin_author = "BigRiceFrog"
    plugin_order = 50

    # ----------------------- 运行态配置 -----------------------
    _enabled: bool = False
    _cron: str = "*/30 * * * *"          # 默认每 30 分钟采集一次
    _downloaders: List[str] = []         # 留空 = 统计所有下载器
    # 月度上传阈值限速
    _upload_threshold_gb: float = 0.0    # 0 = 不启用（单位 GB）
    _limit_speed_kb: int = 0             # 超限后全局上传限速（KB/s），0 = 不限速
    _limit_download_kb: int = 0          # 超限后全局下载限速（KB/s），0 = 不限速
    _recovery_speed_kb: int = 0          # 月初恢复到的上传限速（KB/s），0 = 完全放开不限速
    _recovery_download_kb: int = 0       # 月初恢复到的下载限速（KB/s），0 = 完全放开不限速
    _recovery_cron: str = "30 0 1 * *"   # 月初恢复触发时间（Cron，默认每月1号00:30）
    _retention_days: int = 90            # 历史数据保留天数（天），0 = 不自动清理
    _db: Optional[sqlite3.Connection] = None
    _db_lock: Optional[threading.RLock] = None
    _downloader_helper: Optional[DownloaderHelper] = None
    _sites_helper: Optional[SitesHelper] = None

    # =====================================================================
    # 生命周期
    # =====================================================================
    def init_plugin(self, config: dict = None):
        # 先初始化 helper（与 limit 插件一致），确保 get_form 调用时可用
        self._downloader_helper = DownloaderHelper() if DownloaderHelper else None
        self._sites_helper = SitesHelper() if SitesHelper else None
        self._db_lock = threading.RLock()
        config = config or {}
        self._enabled = bool(config.get("enabled"))
        self._cron = config.get("cron") or "*/30 * * * *"
        # downloaders 在表单里以列表（VSelect multiple）或逗号分隔字符串存储
        raw = config.get("downloaders") or []
        if isinstance(raw, list):
            self._downloaders = [str(x).strip() for x in raw if str(x).strip()]
        else:
            self._downloaders = [s.strip() for s in str(raw).split(",") if s.strip()]
        try:
            self._upload_threshold_gb = float(config.get("upload_threshold_gb") or 0)
        except (ValueError, TypeError):
            self._upload_threshold_gb = 0.0
        try:
            self._limit_speed_kb = int(config.get("limit_speed_kb") or 0)
        except (ValueError, TypeError):
            self._limit_speed_kb = 0
        try:
            self._limit_download_kb = int(config.get("limit_download_kb") or 0)
        except (ValueError, TypeError):
            self._limit_download_kb = 0
        try:
            self._recovery_speed_kb = int(config.get("recovery_speed_kb") or 0)
        except (ValueError, TypeError):
            self._recovery_speed_kb = 0
        try:
            self._recovery_download_kb = int(config.get("recovery_download_kb") or 0)
        except (ValueError, TypeError):
            self._recovery_download_kb = 0
        self._recovery_cron = str(config.get("recovery_cron") or "30 0 1 * *")
        try:
            self._retention_days = int(config.get("retention_days") or 90)
        except (ValueError, TypeError):
            self._retention_days = 90
        self._site_domain_map = _parse_site_domain_map(config.get("site_domain_map") or "")
        self.__init_db()
        self._cleanup_bad_site_rows()
        self._migrate_site_rows()
        self._log_mapping_diag()
        # 启动诊断：打印实例类型供排查 plugin_id（MP 用 plugin.__name__ 当 id）
        try:
            cls_name = type(self).__name__
            module = type(self).__module__ or ""
            logger.info(
                f"下载器流量统计：init 完成。plugin_id(类名)={cls_name}, "
                f"module={module}, enabled={self._enabled}, cron={self._cron}"
            )
        except Exception:
            pass
        # 事件总线注册（可选，失败不影响核心功能）
        if eventmanager is not None and EventType is not None:
            try:
                eventmanager.register(EventType.PluginAction)(self.handle_command)
            except Exception as e:  # pragma: no cover
                logger.debug(f"下载器流量统计：事件注册失败 {e}")
        # 插件重载后重新注册对外 API，避免路由未注册导致 404
        if eventmanager is not None and EventType is not None:
            try:
                eventmanager.register(EventType.PluginReload)(self.reload)
            except Exception as e:  # pragma: no cover
                logger.debug(f"下载器流量统计：reload 事件注册失败 {e}")

    def reload(self, event):
        """插件重载后重新注册对外 API，避免路由未注册导致 404。"""
        if not event or not getattr(event, "event_data", None):
            return
        if event.event_data.get("plugin_id") != self.__class__.__name__:
            return
        register_plugin_api = None
        try:
            from app.api.apiv1.plugin import register_plugin_api
        except Exception:  # pragma: no cover
            try:
                from app.api.endpoints.plugin import register_plugin_api
            except Exception:  # pragma: no cover
                register_plugin_api = None
        if register_plugin_api:
            try:
                register_plugin_api(plugin_id=self.__class__.__name__)
            except Exception as e:  # pragma: no cover
                logger.debug(f"下载器流量统计：重注册 API 失败 {e}")

    def get_state(self) -> bool:
        return self._enabled

    def stop_service(self):
        if self._db:
            try:
                self._db.close()
            except Exception:
                pass
            self._db = None

    # =====================================================================
    # 配置表单
    # =====================================================================
    def get_form(self) -> Tuple[List[dict], Dict[str, Any]]:
        # 完全照搬 limit 插件写法：init_plugin 中已初始化 self._downloader_helper
        downloader_items = []
        try:
            if self._downloader_helper is None:
                raise RuntimeError("DownloaderHelper 未初始化")
            configs = self._downloader_helper.get_configs()
            downloader_items = [
                {"title": config.name, "value": config.name}
                for config in configs.values()
            ]
            logger.debug(f"下载器流量统计：读取到 {len(downloader_items)} 个下载器")
        except Exception as e:  # pragma: no cover
            logger.error(f"下载器流量统计：读取下载器列表失败 {e}\n{traceback.format_exc()}")

        return [{
            "component": "VForm",
            "content": [
                {
                    "component": "VRow",
                    "content": [
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VSwitch",
                                "props": {"model": "enabled", "label": "启用插件"}
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "cron",
                                    "label": "采集周期 (Cron)",
                                    "placeholder": "*/30 * * * *",
                                    "hint": "默认每 30 分钟采集一次"
                                }
                            }]
                        }
                    ]
                },
                {
                    "component": "VRow",
                    "content": [{
                        "component": "VCol",
                        "props": {"cols": 12},
                        "content": [{
                            "component": "VSelect",
                            "props": {
                                "multiple": True,
                                "chips": True,
                                "clearable": True,
                                "model": "downloaders",
                                "label": "指定下载器（留空=全部）",
                                "items": downloader_items,
                                "hint": "从 MP 已配置的下载器中选择；留空则统计全部"
                            }
                        }]
                    }]
                },
                {
                    "component": "VRow",
                    "content": [
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "upload_threshold_gb",
                                    "label": "月度上传阈值 (GB)",
                                    "type": "number",
                                    "placeholder": "0",
                                    "hint": "当月上传达到该值后触发限速；0=不启用"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "limit_speed_kb",
                                    "label": "超限后全局上传限速 (KB/s)",
                                    "type": "number",
                                    "placeholder": "0",
                                    "hint": "0=达到阈值也不限上传"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "limit_download_kb",
                                    "label": "超限后全局下载限速 (KB/s)",
                                    "type": "number",
                                    "placeholder": "0",
                                    "hint": "0=达到阈值也不限下载"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "recovery_speed_kb",
                                    "label": "月初恢复全局上传限速 (KB/s)",
                                    "type": "number",
                                    "placeholder": "0",
                                    "hint": "恢复时把全局上传限速设成该值（如 4096=4M/s）；0=完全放开"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 6},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "recovery_download_kb",
                                    "label": "月初恢复全局下载限速 (KB/s)",
                                    "type": "number",
                                    "placeholder": "0",
                                    "hint": "恢复时把全局下载限速设成该值；0=完全放开"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 12},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "recovery_cron",
                                    "label": "月初恢复触发时间 (Cron 表达式)",
                                    "placeholder": "30 0 1 * *",
                                    "hint": "默认每月1号00:30（30 0 1 * *）。可临时改成更频繁的值来测试恢复动作"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 12},
                            "content": [{
                                "component": "VTextField",
                                "props": {
                                    "model": "retention_days",
                                    "label": "历史数据保留天数 (天)",
                                    "type": "number",
                                    "placeholder": "90",
                                    "hint": "每次采集时自动删除超过该天数的历史记录（0=不自动清理）；建议保留 90~180 天"
                                }
                            }]
                        },
                        {
                            "component": "VCol",
                            "props": {"cols": 12, "md": 12},
                            "content": [{
                                "component": "VTextarea",
                                "props": {
                                    "model": "site_domain_map",
                                    "label": "手动站点域名映射",
                                    "rows": 3,
                                    "placeholder": "AGSVPT=tracker.agsvpt.cn",
                                    "hint": "每行一条「站点名=域名」，多个域名用逗号分隔。用于 tracker 域名与站点设置域名不一致的站点（如 AGSVPT 站点填 agsvpt.com 但 tracker 是 tracker.agsvpt.cn）；留空=不启用"
                                }
                            }]
                        }
                    ]
                }
            ]
        }], {
            "enabled": False,
            "cron": "*/30 * * * *",
            "downloaders": [],
            "upload_threshold_gb": 0,
            "limit_speed_kb": 0,
            "limit_download_kb": 0,
            "recovery_speed_kb": 0,
            "recovery_download_kb": 0,
            "recovery_cron": "30 0 1 * *",
            "retention_days": 90,
            "site_domain_map": ""
        }

    # =====================================================================
    # 定时服务 + 远程命令
    # =====================================================================
    def get_service(self) -> List[Dict[str, Any]]:
        if not self._enabled:
            return []
        jobs = [{
            "id": "DownloaderTrafficCollect",
            "name": "下载器流量采集",
            "trigger": CronTrigger.from_crontab(self._cron),
            "func": self._collect,
            "kwargs": {}
        }]
        # 月初恢复限速由独立定时任务驱动，触发时间可配置（默认每月1号00:30）
        try:
            jobs.append({
                "id": "DownloaderTrafficRecovery",
                "name": "月初恢复上传限速",
                "trigger": CronTrigger.from_crontab(self._recovery_cron),
                "func": self._scheduled_recovery,
                "kwargs": {}
            })
        except Exception as e:  # pragma: no cover
            logger.warning(f"下载器流量统计：月初恢复定时任务注册失败（cron={self._recovery_cron}）：{e}")
        return jobs

    def _scheduled_recovery(self):
        """按配置的 cron 到点后，把所选下载器的上传/下载限速恢复到配置值。"""
        self._do_apply_speed(
            self._recovery_speed_kb,
            self._recovery_download_kb,
            reason=f"定时恢复限速（cron={self._recovery_cron}）",
        )

    def get_command(self) -> List[Dict[str, Any]]:
        if EventType is None:
            return []
        return [{
            "cmd": "/downloader_traffic_collect",
            "event": EventType.PluginAction,
            "desc": "立即采集下载器流量",
            "category": "下载器流量统计",
            "data": {"action": "downloader_traffic_collect"}
        }]

    def handle_command(self, event):
        if not event or not event.event_data:
            return
        if event.event_data.get("action") != "downloader_traffic_collect":
            return
        self._collect()

    # =====================================================================
    # 对外 API（供页面 / 外部调用）
    # =====================================================================
    def get_api(self) -> List[Dict[str, Any]]:
        """
        注册插件 API。

        按 MoviePilot 官方约定：path 以 / 开头，MP 会在每个 path 前自动拼接
        插件类名作为前缀（get_plugin_apis 中 api["path"] = f"/{plugin_id}{api['path']}"），
        因此最终路由为：
          /api/v1/plugin/DownloaderTraffic/records
          /api/v1/plugin/DownloaderTraffic/trend
          /api/v1/plugin/DownloaderTraffic/downloaders
          /api/v1/plugin/DownloaderTraffic/collect
          /api/v1/plugin/DownloaderTraffic/reset-limit
        （同时会生成 /api/v2/plugin/... 的镜像路由）

        前端组件固定以类名 DownloaderTraffic 调用，避免大小写不一致导致 404。
        """
        return [
            {
                "path": "/records",
                "endpoint": self.api_records,
                "methods": ["GET"],
                "auth": "bear",
                "summary": "查询流量统计",
                "description": "按 年/月/日 查询上传/下载流量，可按站点、下载器过滤",
            },
            {
                "path": "/trend",
                "endpoint": self.api_trend,
                "methods": ["GET"],
                "auth": "bear",
                "summary": "查询流量时间趋势",
                "description": "按月/年返回逐日或逐月的累计上传/下载趋势，用于绘制折线图",
            },
            {
                "path": "/downloaders",
                "endpoint": self.api_downloaders,
                "methods": ["GET"],
                "auth": "bear",
                "summary": "获取 MP 已配置下载器列表",
                "description": "返回已配置的下载器名称列表，供前端配置页下拉选择",
            },
            {
                "path": "/collect",
                "endpoint": self.api_collect,
                "methods": ["GET"],
                "auth": "bear",
                "summary": "手动触发一次流量采集",
                "description": "立即执行一次 _collect()，并返回本次入账统计摘要",
            },
            {
                "path": "/test-limit",
                "endpoint": self.api_test_limit,
                "methods": ["POST", "GET"],
                "auth": "bear",
                "summary": "手动测试超限限速",
                "description": "立即按「超限后上传/下载限速」(limit_speed_kb / limit_download_kb) 对所选下载器设置，方便验证限速是否生效",
            },
            {
                "path": "/reset-limit",
                "endpoint": self.api_reset_limit,
                "methods": ["POST", "GET"],
                "auth": "bear",
                "summary": "手动恢复上传限速",
                "description": "立即把全局上传/下载限速设为「月初恢复限速」(recovery_speed_kb / recovery_download_kb，0=不限)。用于手动测试月初恢复动作",
            },
            {
                "path": "/clear",
                "endpoint": self.api_clear,
                "methods": ["POST", "GET"],
                "auth": "bear",
                "summary": "清空全部采集历史数据",
                "description": "清空 traffic_records 与 torrent_snapshots 表。不可恢复；前端需二次确认后调用。清空后下一次采集会以当前值为基准重新入账",
            },
        ]

    def get_render_mode(self):
        """启用 Vue 模块联邦页面（图表化详情页）。宿主会从 dist/assets/remoteEntry.js 加载组件。"""
        return ("vue", "dist/assets")

    def api_downloaders(self, request: Request):
        """返回 MP 已配置的下载器名称列表，供前端 VSelect 使用。"""
        items = []
        try:
            if self._downloader_helper is None:
                raise RuntimeError("DownloaderHelper 未初始化")
            items = [
                {"title": config.name, "value": config.name}
                for config in self._downloader_helper.get_configs().values()
            ]
        except Exception as e:  # pragma: no cover
            logger.error(f"下载器流量统计：读取下载器列表失败 {e}\n{traceback.format_exc()}")
        return {"data": items}

    def api_trend(self, request: Request):
        params = request.query_params
        period = (params.get("period") or "month").lower()
        downloader = params.get("downloader")
        if period == "year":
            value = params.get("value") or str(datetime.now().year)
            sql = "SELECT month, SUM(uploaded), SUM(downloaded) FROM traffic_records WHERE year=? AND site='GLOBAL' "
            args: List[Any] = [int(value)]
            label = "month"
        else:  # month（默认）
            value = params.get("value") or datetime.now().strftime("%Y-%m")
            sql = "SELECT date, SUM(uploaded), SUM(downloaded) FROM traffic_records WHERE month=? AND site='GLOBAL' "
            args = [value]
            label = "date"
        if downloader:
            sql += " AND downloader=? "
            args.append(downloader)
        sql += f" GROUP BY {label} ORDER BY {label}"

        with self._db_lock:
            cur = self._db.cursor()
            cur.execute(sql, args)
            data = [{
                "label": r[0],
                "uploaded": int(r[1] or 0),
                "downloaded": int(r[2] or 0)
            } for r in cur.fetchall()]
        return {"period": period, "value": value, "data": data}

    def api_records(self, request: Request):
        params = request.query_params
        period = (params.get("period") or "day").lower()
        value = params.get("value")
        site = params.get("site")
        downloader = params.get("downloader")

        if period == "month":
            sql = ("SELECT site, downloader, SUM(uploaded), SUM(downloaded) "
                   "FROM traffic_records WHERE month=?")
            value = value or datetime.now().strftime("%Y-%m")
            args: List[Any] = [value]
        elif period == "year":
            sql = ("SELECT site, downloader, SUM(uploaded), SUM(downloaded) "
                   "FROM traffic_records WHERE year=?")
            value = value or str(datetime.now().year)
            args = [int(value)]
        else:  # day
            sql = ("SELECT site, downloader, SUM(uploaded), SUM(downloaded) "
                   "FROM traffic_records WHERE date=?")
            value = value or date.today().strftime("%Y-%m-%d")
            args = [value]

        if site:
            sql += " AND site=?"
            args.append(site)
        if downloader:
            sql += " AND downloader=?"
            args.append(downloader)

        # GLOBAL 是供总览/限速使用的汇总行，并非真实站点：站点明细里剔掉，
        # 避免「GLOBAL 总额 + 各站点之和」被重复计入 total。
        sql += " AND site!='GLOBAL' "

        sql += " GROUP BY site, downloader ORDER BY site"

        with self._db_lock:
            cur = self._db.cursor()
            cur.execute(sql, args)
            data = [{
                "site": r[0],
                "downloader": r[1],
                "uploaded": int(r[2] or 0),
                "downloaded": int(r[3] or 0)
            } for r in cur.fetchall()]

            # 总览合计采用 GLOBAL 汇总行：与采集入账、限速阈值判断是同一口径，
            # 避免站点行里历史/别名写入不一致导致的虚高，确保主界面与业务日志一致。
            tot_sql = ("SELECT COALESCE(SUM(uploaded),0), COALESCE(SUM(downloaded),0) "
                       "FROM traffic_records WHERE site='GLOBAL'")
            tot_args: List[Any] = []
            if period == "month":
                tot_sql += " AND month=?"
                tot_args.append(value)
            elif period == "year":
                tot_sql += " AND year=?"
                tot_args.append(int(value))
            else:  # day
                tot_sql += " AND date=?"
                tot_args.append(value)
            if downloader:
                tot_sql += " AND downloader=?"
                tot_args.append(downloader)
            cur.execute(tot_sql, tot_args)
            _g = cur.fetchone() or (0, 0)

        return {
            "period": period,
            "value": value,
            "total_uploaded": int(_g[0] or 0),
            "total_downloaded": int(_g[1] or 0),
            "data": data
        }

    # =====================================================================
    # 手动触发 & 限速恢复接口
    # =====================================================================
    def api_collect(self, request: Request):
        """手动触发一次采集(同步等待),返回本次入账概要;用于调试按钮和远程触发。"""
        result = {"ok": False, "triggered_at": int(datetime.now().timestamp())}
        try:
            self._collect()
            result["ok"] = True
            result["message"] = "采集任务已完成（详见 MP 业务日志）"
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"下载器流量统计：手动采集失败：{e}\n{traceback.format_exc()}")
        return result

    def api_test_limit(self, request: Request):
        """手动测试「超限限速」：按 limit_speed_kb / limit_download_kb 设置全局限速。"""
        up = self._limit_speed_kb
        down = self._limit_download_kb
        n = self._do_apply_speed(up, down, reason="手动测试超限限速")
        return {
            "ok": True,
            "applied_count": n,
            "upload_kb": up,
            "download_kb": down,
            "reason": "test-limit",
        }

    def api_reset_limit(self, request: Request):
        """手动恢复：把全局上传/下载限速设为 recovery_speed_kb / recovery_download_kb。"""
        reason = "手动触发"
        try:
            if request is not None:
                # body 不必解析，简单从 query/body 取说明
                body_reason = None
                try:
                    payload = request.json() if hasattr(request, 'json') else None
                    if isinstance(payload, dict):
                        body_reason = payload.get('reason')
                except Exception:
                    pass
                if not body_reason:
                    body_reason = (request.query_params.get('reason') if hasattr(request, 'query_params') else None)
                if body_reason:
                    reason = str(body_reason)[:200]
        except Exception:
            pass
        up = self._recovery_speed_kb
        down = self._recovery_download_kb
        n = self._do_apply_speed(up, down, reason=reason)
        return {
            "ok": True,
            "reset_count": n,
            "upload_kb": up,
            "download_kb": down,
            "reason": reason,
        }

    def api_clear(self, request: Request):
        """清空全部采集历史数据（traffic_records + torrent_snapshots）。不可恢复。"""
        if self._db is None:
            return {"ok": False, "error": "数据库未初始化"}
        records = snaps = 0
        try:
            with self._db_lock:
                cur = self._db.execute("DELETE FROM traffic_records")
                records = cur.rowcount
                cur = self._db.execute("DELETE FROM torrent_snapshots")
                snaps = cur.rowcount
                self._db.commit()
            logger.warning(
                f"下载器流量统计：已清空全部采集历史数据"
                f"（records={records} 行, snapshots={snaps} 行）"
            )
            return {
                "ok": True,
                "deleted_records": records,
                "deleted_snapshots": snaps,
                "message": "历史数据已清空，下次采集将以当前值为基准重新入账",
            }
        except Exception as e:  # pragma: no cover
            logger.error(f"下载器流量统计：清空历史数据失败：{e}\n{traceback.format_exc()}")
            return {"ok": False, "error": str(e)}

    # =====================================================================
    # 详情页（极简版，真实数据走上面的 API）
    # =====================================================================
    def get_page(self) -> List[Dict[str, Any]]:
        return [{
            "component": "VCard",
            "props": {"title": "下载器流量统计", "flat": True},
            "content": [{
                "component": "VCardText",
                "props": {
                    "innerHTML": (
                        "插件已按 <b>年 / 月 / 日</b> 自动采集 qBittorrent、Transmission 的上传/下载流量，"
                        "并按 <b>PT 站点</b> 细分。<br/><br/>"
                        "可通过接口获取 JSON 数据（需带 <code>?token=API_TOKEN</code>）：<br/>"
                        "<code>GET /plugin/DownloaderTraffic/records?period=day&amp;value=2026-08-18</code><br/>"
                        "<code>GET /plugin/DownloaderTraffic/records?period=month&amp;value=2026-08</code><br/>"
                        "<code>GET /plugin/DownloaderTraffic/records?period=year&amp;value=2026</code><br/>"
                        "<code>GET /plugin/DownloaderTraffic/trend?period=month&amp;value=2026-08</code><br/>"
                        "<code>GET /plugin/DownloaderTraffic/downloaders</code><br/><br/>"
                        "调试与控制接口：<br/>"
                        "<code>GET /plugin/DownloaderTraffic/collect</code> —— 立即采集一次<br/>"
                        "<code>POST /plugin/DownloaderTraffic/reset-limit</code> —— 立即解除限速<br/><br/>"
                        "可在「设定 - 服务」手动触发「下载器流量采集」，或微信/Telegram 发送 "
                        "<code>/downloader_traffic_collect</code> 立即采集。"
                    )
                }
            }]
        }]

    # =====================================================================
    # 核心采集逻辑
    # =====================================================================
    def _collect(self):
        if not self._enabled:
            logger.info("下载器流量统计：插件未启用，跳过采集")
            return
        if self._db is None:
            self.__init_db()

        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        year = now.year
        month = now.strftime("%Y-%m")
        ts = int(now.timestamp())

        if self._downloader_helper is None:
            logger.error("下载器流量统计：DownloaderHelper 不可用，无法采集")
            return
        services = self._downloader_helper.get_services(
            name_filters=self._downloaders or None
        )
        if not services:
            logger.warning("下载器流量统计：未找到可用下载器")
            return

        total_torrents = 0
        for sname, sinfo in services.items():
            try:
                if sinfo.instance.is_inactive():
                    logger.warning(f"下载器流量统计：下载器 {sname} 未连接，跳过")
                    continue
                downloader = sinfo.instance
                dtype = sinfo.type  # "qbittorrent" / "transmission"
                # get_torrents 返回 (torrents, error)；兼容只返回列表的写法
                result = downloader.get_torrents()
                if isinstance(result, tuple):
                    torrents, error = result
                else:
                    torrents, error = result, None
                if error:
                    logger.error(f"下载器流量统计：获取 {sname} 种子失败：{error}")
                    continue
                # 兼容 get_torrents 返回以 hash 为键的字典的情况
                if isinstance(torrents, dict):
                    torrents = list(torrents.values())
                torrents = torrents or []
                total_torrents += len(torrents)
                # 诊断：每个下载器打印一次字段样例 + 关键字段实际取值，便于排查
                if torrents and dtype not in getattr(self, "_logged_dtypes", set()):
                    try:
                        sample = torrents[0]
                        if isinstance(sample, dict):
                            keys = list(sample.keys())
                        else:
                            keys = [a for a in dir(sample) if not a.startswith("_")][:60]
                        logger.info(f"下载器流量统计：种子字段样例({dtype})：{keys}")
                        _sample_trackers = _field_multi(sample, "trackers", default=[]) or []
                        if isinstance(_sample_trackers, str):
                            _sample_trackers = [_sample_trackers]
                        logger.info(
                            f"下载器流量统计：样本种子取值({dtype})："
                            f"hash={_field_multi(sample, 'hash')} "
                            f"uploaded={_field_multi(sample, 'uploaded')} "
                            f"downloaded={_field_multi(sample, 'downloaded')} "
                            f"trackers={[_redact_url(x) for x in _sample_trackers]} "
                            f"site={self._resolve_site(_sample_trackers)}"
                        )
                    except Exception:
                        pass
                    self._logged_dtypes = getattr(self, "_logged_dtypes", set()) | {dtype}
                self._process_torrents(torrents, dtype, date_str, year, month, ts)
            except Exception as e:
                logger.error(f"下载器流量统计：处理下载器 {sname} 异常：{e}")

        logger.info(f"下载器流量统计：本次共采集 {total_torrents} 个种子")

        # 月度阈值限速检查
        self._maybe_apply_monthly_limit(month)
        # 按「保留天数」清理过期历史记录（0=不清理）
        self._cleanup_retention()
        # 月初恢复限速由独立定时任务 DownloaderTrafficRecovery 驱动（见 get_service）

        logger.info("下载器流量统计：采集完成")

    def _maybe_apply_monthly_limit(self, month: str):
        """当月累计上传达到阈值时，给所选下载器设置全局上传/下载限速。"""
        if self._upload_threshold_gb <= 0 or (self._limit_speed_kb <= 0 and self._limit_download_kb <= 0):
            return
        if self._db is None:
            return

        threshold_bytes = int(self._upload_threshold_gb * 1024 * 1024 * 1024)
        month_upload = self._get_month_total(month, self._downloaders)
        if month_upload < threshold_bytes:
            logger.info(
                f"下载器流量统计：本月上传 {month_upload/1024**3:.2f} GB "
                f"未达阈值 {self._upload_threshold_gb} GB，不触发限速"
            )
            return

        logger.warning(
            f"下载器流量统计：本月上传 {month_upload/1024**3:.2f} GB "
            f"已达阈值 {self._upload_threshold_gb} GB，设置全局上传限速 "
            f"{self._limit_speed_kb} KB/s / 下载限速 {self._limit_download_kb} KB/s"
        )
        self._do_apply_speed(self._limit_speed_kb, self._limit_download_kb, reason="月度阈值限速")

    # =====================================================================
    # 状态存取（保留；月初恢复现已由独立定时任务 DownloaderTrafficRecovery 驱动）
    # =====================================================================
    def _load_state(self, key: str, default: str = "") -> str:
        if not self._db:
            return default
        try:
            with self._db_lock:
                cur = self._db.execute(
                    "SELECT value FROM plugin_state WHERE key=?",
                    (key,),
                )
                row = cur.fetchone()
                return row[0] if row else default
        except Exception:
            return default

    def _save_state(self, key: str, value: str):
        if not self._db:
            return
        try:
            with self._db_lock:
                self._db.execute(
                    "INSERT INTO plugin_state(key,value) VALUES(?,?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, value),
                )
                self._db.commit()
        except Exception as e:
            logger.debug(f"下载器流量统计：保存状态 {key} 失败：{e}")

    def _maybe_reset_monthly_limit(self):
        """
        已废弃：月初恢复限速改由配置的独立定时任务 DownloaderTrafficRecovery 驱动
        （见 get_service / _scheduled_recovery），触发时间由 recovery_cron 配置。
        """
        return

    def _do_apply_speed(self, up_kb: int, down_kb: int, reason: str = ""):
        """对所有目标下载器设置全局限速：上传=up_kb、下载=down_kb（0=不限）。返回成功数。"""
        targets = self._downloaders or None
        helper = self._downloader_helper
        if helper is None and DownloaderHelper is not None:
            helper = DownloaderHelper()
            self._downloader_helper = helper
        if helper is None:
            logger.warning("下载器流量统计：DownloaderHelper 不可用，无法设置限速")
            return 0
        try:
            services = helper.get_services(name_filters=targets) or {}
        except Exception as e:
            logger.error(f"下载器流量统计：获取下载器实例失败：{e}")
            return 0
        ok = []
        failed = []
        desc = f"上传 {up_kb} KB/s / 下载 {down_kb} KB/s"
        for sname, sinfo in services.items():
            try:
                if sinfo.instance.is_inactive():
                    failed.append(f"{sname}(离线)")
                    continue
                sinfo.instance.set_speed_limit(download_limit=down_kb, upload_limit=up_kb)
                ok.append(sname)
            except Exception as e:
                failed.append(f"{sname}({e})")
        if ok:
            logger.warning(f"下载器流量统计：{'，'.join(ok)} 已设置限速 {desc}"
                           f"{'，原因：' + reason if reason else ''}")
        if failed:
            logger.warning(f"下载器流量统计：以下下载器设置失败：{failed}")
        return len(ok)

    def _get_month_total(self, month: str, downloader_names: List[str]) -> int:
        """统计某自然月的累计上传字节数（用于月度阈值判断）。

        采集本身只针对配置勾选的下载器（name_filters），故 GLOBAL 行里只含有
        “生效下载器”的数据；这里不再按 downloader 过滤，避免配置里的下载器标识
        与写入行的引擎类型（transmission/qbittorrent）命名不一致时把本月读成 0。
        """
        if self._db is None:
            return 0
        with self._db_lock:
            try:
                cur = self._db.execute(
                    "SELECT COALESCE(SUM(uploaded),0) FROM traffic_records "
                    "WHERE month=? AND site='GLOBAL'",
                    [month]
                )
                return int(cur.fetchone()[0] or 0)
            except Exception as e:  # pragma: no cover
                logger.debug(f"下载器流量统计：统计月上传失败 {e}")
                return 0

    def _process_torrents(self, torrents, dtype: str,
                          date_str: str, year: int, month: str, ts: int):
        delta_by_site: Dict[str, Dict[str, int]] = {}
        global_up = global_down = 0
        new_snapshots: List[Tuple[str, str, int, int, int]] = []
        skipped = 0

        # 取上次采集时间戳：首次见到的种子若 added_on > last_ts，说明是
        # 上次采集之后新添加的，其当前累计上传/下载应计入当次增量（而非丢弃）。
        # last_ts=0 时（首次运行/清空历史后）用今天零点做 fallback：
        # 今天添加的种子计入，更早的只建基准。
        last_ts = 0
        try:
            with self._db_lock:
                row = self._db.execute(
                    "SELECT MAX(ts) FROM torrent_snapshots"
                ).fetchone()
            if row and row[0]:
                last_ts = int(row[0])
        except Exception:
            pass
        if not last_ts:
            import datetime as _dt
            last_ts = int(_dt.datetime.now()
                          .replace(hour=0, minute=0, second=0, microsecond=0)
                          .timestamp())

        for t in torrents:
            thash = _field_multi(t, "hash")
            if not thash:
                skipped += 1
                continue
            up = int(_field_multi(t, "uploaded", default=0) or 0)
            down = int(_field_multi(t, "downloaded", default=0) or 0)
            trackers = _field_multi(t, "trackers", default=[]) or []
            if isinstance(trackers, str):
                trackers = [trackers]
            site = self._resolve_site(trackers)

            prev = self._get_snapshot(thash, dtype)
            if prev is not None:
                # 已有基准快照：累加增量（下载器重启/重新添加会归零，已做保护）
                dup = up - prev[0]
                ddown = down - prev[1]
                if dup < 0:
                    dup = 0
                if ddown < 0:
                    ddown = 0
            else:
                # 首次见到该种子。下载器返回的是"生命周期累计值"——若直接整段回填
                # 会把前几个月的历史量误算进当月（v1.0.5 的教训）。但如果该种子是
                # 上次采集之后才添加的（added_on > last_ts），其当前累计值就是本次
                # 采集周期内产生的，应全额计入，而不是丢弃。
                added_on = _field_multi(t, "added_on", default=0) or 0
                try:
                    added_on = int(added_on)
                except (TypeError, ValueError):
                    added_on = 0
                if last_ts and added_on and added_on > last_ts:
                    # 本次采集周期内新增的种子：当前累计值即为本次增量
                    dup = up
                    ddown = down
                else:
                    # 旧种子（插件刚安装/种子早于采集周期）：只建基准，不回填历史
                    dup = 0
                    ddown = 0

            if dup or ddown:
                bucket = delta_by_site.setdefault(site, {"up": 0, "down": 0})
                bucket["up"] += dup
                bucket["down"] += ddown
                global_up += dup
                global_down += ddown

            new_snapshots.append((thash, dtype, up, down, ts))

        if skipped:
            logger.warning(f"下载器流量统计：{dtype} 有 {skipped} 个种子缺少 hash，已跳过")
        logger.info(
            f"下载器流量统计：{dtype} 本次入账 上传 {global_up/1024**3:.3f} GB / "
            f"下载 {global_down/1024**3:.3f} GB（种子数 {len(torrents)}）"
        )
        if delta_by_site:
            _dist = {k: f"U{v['up']/1024**3:.2f}G/D{v['down']/1024**3:.2f}G"
                    for k, v in delta_by_site.items()}
            logger.debug(f"下载器流量统计：{dtype} 站点分布 → {_dist}")

        # 写入 / 累加记录
        with self._db_lock:
            self._upsert_record(date_str, year, month, "GLOBAL", dtype, global_up, global_down, ts)
            for site, d in delta_by_site.items():
                self._upsert_record(date_str, year, month, site, dtype, d["up"], d["down"], ts)

            self._replace_snapshots(new_snapshots)
            self._db.commit()

    # =====================================================================
    # 站点归属
    # =====================================================================
    def _resolve_site(self, trackers) -> str:
        if not trackers:
            return "未知站点"
        host = ""
        for tr in trackers:
            # 字符串：transmission 的 trackers 常是纯 announce 地址
            # dict：qbittorrent-api 的 tracker（url/host/site 键）
            # 对象：transmission-rpc 的 Tracker，必须取真实 announce/url/host，不能 str()（会把内存地址当域名）
            url = ""
            if isinstance(tr, str):
                url = tr
            elif isinstance(tr, dict):
                url = tr.get("url") or tr.get("host") or tr.get("site") or ""
            else:
                url = _field(tr, "url", "announce", "host", "sitename", default="")
            host = _extract_domain(url)
            # 兜底：若解析结果仍是对象内存地址/对象 repr，视为无效
            if host and (host.startswith("<") or "object at" in host or host.startswith("0x")):
                host = ""
                continue
            if host:
                break
        if not host:
            return "未知站点"
        # 优先映射成 MP 站点名；映射不上则退回可读的 tracker 域名
        return self._map_domain_to_site(host) or host

    def _iter_site_mappings(self):
        """聚合 MP 站点的 (站点名, 域名字段) 候选。

        首选官方「站点数据统计」同款的 SiteOper()（无参，读到的是「站点设置」里的全部站点），
        再补 SitesHelper.get_indexers()，最后用 db_query 直查做兜底。
        """
        seen = set()

        def _emit(name, dom):
            name = (name or "").strip()
            if not name:
                return
            key = (name, str(dom))
            if key not in seen:
                seen.add(key)
                yield name, dom

        # 0) 手动站点域名映射（最高优先级）：解决 tracker 域名与站点设置域名不一致的站点
        for name, dom in self._site_domain_map:
            for d in _emit(name, dom):
                yield d

        # 1) SiteOper：站点设置里配置的站点（最贴合期望的站点名）
        try:
            if SiteOper is not None:
                oper = SiteOper()
                sites = None
                for m in ("list_active", "list"):
                    if hasattr(oper, m):
                        try:
                            sites = getattr(oper, m)() or []
                            if sites:
                                break
                        except Exception:  # pragma: no cover
                            continue
                for site in sites or []:
                    name = getattr(site, "name", "") or ""
                    dom = getattr(site, "domain", "") or getattr(site, "url", "") or ""
                    for d in _emit(name, dom):
                        yield d
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：SiteOper 站点映射失败 {e}")

        # 2) SitesHelper.get_indexers()
        try:
            if self._sites_helper is None and SitesHelper is not None:
                self._sites_helper = SitesHelper()
            if self._sites_helper is not None:
                indexers = self._sites_helper.get_indexers() or []
                if isinstance(indexers, dict):
                    indexers = list(indexers.values())
                for site in indexers:
                    if isinstance(site, dict):
                        name = site.get("name") or ""
                        dom = site.get("domain") or site.get("url") or ""
                    else:
                        name = getattr(site, "name", "") or ""
                        dom = getattr(site, "domain", "") or getattr(site, "url", "") or ""
                    for d in _emit(name, dom):
                        yield d
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：SitesHelper 站点映射失败 {e}")

        # 3) db_query 直查兜底
        try:
            for site in _query_all_sites() or []:
                name = getattr(site, "name", "") or ""
                dom = getattr(site, "domain", "") or getattr(site, "url", "") or ""
                for d in _emit(name, dom):
                    yield d
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：站点表兜底映射失败 {e}")

    def _map_domain_to_site(self, host: str) -> Optional[str]:
        """把 tracker 域名映射成 MP 站点设置里的站点名。

        命中必须满足「主机名边界」：tracker host 与站点域名相等，或互为子域（兼容
        www./tracker./on. 这类子域差）。不再用宽松的 in 子串匹配——否则会把
        on.springsunday.net 这类 host 误归到 domain 只是 sunday.net 之类子串的站点。
        多个候选里取「匹配到的域名字串最长」的一个（子域比其父域更具体，应优先）。
        domain 字段兼容字符串/逗号分隔/列表三种形态。
        """
        best, best_len = None, 0
        matches = []  # 仅用于一次性诊断日志
        for name, dom in self._iter_site_mappings():
            if isinstance(dom, str):
                doms = [d for d in dom.replace("，", ",").split(",") if d]
            else:
                doms = [d for d in (dom or []) if d]
            for sd in doms:
                sd = _extract_domain(str(sd))
                if not sd:
                    continue
                if host == sd or host.endswith("." + sd) or sd.endswith("." + host):
                    matches.append((name, sd))
                    if len(sd) > best_len:
                        best, best_len = name, len(sd)
        if best is not None and host not in self._diag_hosts:
            self._diag_hosts.add(host)
            logger.debug(
                f"下载器流量统计：站点映射诊断 host={host} 候选={matches} => 命中「{best}」"
            )
        return best

    # =====================================================================
    # SQLite 存取
    # =====================================================================
    def __init_db(self):
        db_path = self.get_data_path() / "traffic.db"
        # 定时采集在独立线程运行，API 查询也在别的线程：必须关闭单线程检查并用锁串行化
        self._db = sqlite3.connect(str(db_path), check_same_thread=False)
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS traffic_records (
                date      TEXT,
                year      INTEGER,
                month     TEXT,
                site      TEXT,
                downloader TEXT,
                uploaded  INTEGER,
                downloaded INTEGER,
                ts        INTEGER,
                PRIMARY KEY (date, site, downloader)
            )
        """)
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS torrent_snapshots (
                hash       TEXT,
                downloader TEXT,
                uploaded  INTEGER,
                downloaded INTEGER,
                ts        INTEGER,
                PRIMARY KEY (hash, downloader)
            )
        """)
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS plugin_state (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        self._db.commit()

    def _cleanup_bad_site_rows(self):
        """清理历史 bug 期间把 tracker 对象内存地址当站点名写入的残留行。"""
        if self._db is None:
            return
        try:
            with self._db_lock:
                cur = self._db.execute(
                    "DELETE FROM traffic_records WHERE site LIKE '<%' "
                    "OR site LIKE '%object at 0x%' OR site LIKE '0x%'",
                )
                self._db.commit()
                if cur.rowcount:
                    logger.warning(f"下载器流量统计：已清理 {cur.rowcount} 行非法站点名残留数据")
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：清理残留数据失败 {e}")

    def _cleanup_retention(self):
        """按「保留天数」删除过期历史记录；_retention_days<=0 表示不自动清理。"""
        if self._db is None or self._retention_days <= 0:
            return
        try:
            cutoff = (datetime.now() - datetime.timedelta(days=self._retention_days)) \
                .strftime("%Y-%m-%d")
            with self._db_lock:
                cur = self._db.execute(
                    "DELETE FROM traffic_records WHERE date <= ?",
                    (cutoff,),
                )
                self._db.commit()
                if cur.rowcount:
                    logger.info(
                        f"下载器流量统计：已按保留天数 {self._retention_days} 天"
                        f"清理 {cur.rowcount} 行过期历史记录"
                    )
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：清理过期数据失败 {e}")

    def _migrate_site_rows(self):
        """把历史误标记的站点桶合并/清理成 MP 站点名。

        站点名是 traffic_records 主键的一部分，改映射后旧桶不会自动改名，会继续显示
        t.hdhome.org / h / 未知站点 这些历史行。这里把「域名样」的桶重映射到 MP 站点名，
        无法归并的（单字符、未知站点）直接删除；GLOBAL 汇总行保留真实总量。
        """
        if self._db is None:
            return
        try:
            with self._db_lock:
                sites = [r[0] for r in self._db.execute(
                    "SELECT DISTINCT site FROM traffic_records") if r[0]]
            for s in sites:
                if not s or s == "GLOBAL":
                    continue
                if "." in s:  # 域名样（tracker 地址）
                    mapped = self._map_domain_to_site(s)
                    if mapped and mapped != s:
                        self._merge_site_rows(s, mapped)
                    else:
                        self._delete_site_rows(s, "未识别的 tracker 域名")
                elif len(s) <= 1 or s == "未知站点":
                    self._delete_site_rows(s, "未知/非法站点名")
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：历史站点名迁移失败 {e}")

    def _merge_site_rows(self, old: str, new: str):
        """把某个旧站点名下的所有记录合并进新站点名（累加）。"""
        with self._db_lock:
            rows = self._db.execute(
                "SELECT date, year, month, downloader, uploaded, downloaded "
                "FROM traffic_records WHERE site=?"
            ).fetchall()
            self._db.execute("DELETE FROM traffic_records WHERE site=?", (old,))
            for r in rows:
                self._upsert_record(r[0], r[1], r[2], new, r[3], r[4], r[5],
                                    int(datetime.now().timestamp()))
            self._db.commit()
            if rows:
                logger.warning(f"下载器流量统计：站点 {old} → {new}（合并 {len(rows)} 行）")

    def _delete_site_rows(self, s: str, reason: str):
        with self._db_lock:
            cur = self._db.execute("DELETE FROM traffic_records WHERE site=?", (s,))
            self._db.commit()
            if cur.rowcount:
                logger.warning(f"下载器流量统计：清理站点「{s}」({reason}) {cur.rowcount} 行；GLOBAL 汇总不失真")

    def _log_mapping_diag(self):
        """打印站点映射诊断：DB 是否可读、配置了几个站点、库里现存哪些站点名。"""
        try:
            names = [n for n, _ in self._iter_site_mappings() if n]
            logger.info(
                f"下载器流量统计：站点映射诊断——可用站点 {len(names)} 个：{names[:10]}"
            )
        except Exception as e:  # pragma: no cover
            logger.info(f"下载器流量统计：站点映射诊断异常 {e}")
        try:
            with self._db_lock:
                sites = [r[0] for r in self._db.execute(
                    "SELECT DISTINCT site FROM traffic_records") if r[0]]
            logger.info(f"下载器流量统计：当前库内站点名：{sites}")
        except Exception:  # pragma: no cover
            pass

    def _upsert_record(self, date_str, year, month, site, dtype, up, down, ts):
        with self._db_lock:
            self._db.execute(
                """
                INSERT INTO traffic_records (date, year, month, site, downloader, uploaded, downloaded, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(date, site, downloader) DO UPDATE SET
                    uploaded   = uploaded   + excluded.uploaded,
                    downloaded = downloaded + excluded.downloaded,
                    ts = excluded.ts
                """,
                (date_str, year, month, site, dtype, up, down, ts)
            )

    def _get_snapshot(self, thash: str, dtype: str) -> Optional[Tuple[int, int]]:
        with self._db_lock:
            cur = self._db.cursor()
            cur.execute(
                "SELECT uploaded, downloaded FROM torrent_snapshots WHERE hash=? AND downloader=?",
                (thash, dtype)
            )
            row = cur.fetchone()
        return (int(row[0]), int(row[1])) if row else None

    def _replace_snapshots(self, snapshots: List[Tuple[str, str, int, int, int]]):
        with self._db_lock:
            self._db.executemany(
                """
                INSERT INTO torrent_snapshots (hash, downloader, uploaded, downloaded, ts)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(hash, downloader) DO UPDATE SET
                    uploaded   = excluded.uploaded,
                    downloaded = excluded.downloaded,
                    ts = excluded.ts
                """,
                snapshots
            )

