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


class DownloaderTraffic(_PluginBase):
    # ----------------------- 插件元信息 -----------------------
    plugin_name = "下载器流量统计"
    plugin_version = "1.3.4"
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
        self.__init_db()
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
                                    "hint": "0=达到阈值也不限速"
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
            "limit_speed_kb": 0
        }

    # =====================================================================
    # 定时服务 + 远程命令
    # =====================================================================
    def get_service(self) -> List[Dict[str, Any]]:
        if not self._enabled:
            return []
        return [{
            "id": "DownloaderTrafficCollect",
            "name": "下载器流量采集",
            "trigger": CronTrigger.from_crontab(self._cron),
            "func": self._collect,
            "kwargs": {}
        }]

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
                "path": "/reset-limit",
                "endpoint": self.api_reset_limit,
                "methods": ["POST", "GET"],
                "auth": "bear",
                "summary": "手动解除下载器上传限速",
                "description": "立即把 upload_limit 设为 0（无限制），用于月初自动恢复或调试",
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
            sql = "SELECT month, SUM(uploaded), SUM(downloaded) FROM traffic_records WHERE year=?"
            args: List[Any] = [int(value)]
            label = "month"
        else:  # month（默认）
            value = params.get("value") or datetime.now().strftime("%Y-%m")
            sql = "SELECT date, SUM(uploaded), SUM(downloaded) FROM traffic_records WHERE month=?"
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

        return {
            "period": period,
            "value": value,
            "total_uploaded": sum(d["uploaded"] for d in data),
            "total_downloaded": sum(d["downloaded"] for d in data),
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

    def api_reset_limit(self, request: Request):
        """手动解除下载器上传限速。POST 也支持 GET 以方便某些版本下手动调用。"""
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
        n = self._do_reset_limit(reason=reason)
        ym = datetime.now().strftime("%Y-%m")
        self._save_state("last_limit_reset_year_month", ym)
        self._save_state("last_limit_reset_at", str(int(datetime.now().timestamp())))
        return {
            "ok": True,
            "reset_count": n,
            "year_month": ym,
            "reason": reason,
        }

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
                        logger.info(
                            f"下载器流量统计：样本种子取值({dtype})："
                            f"hash={_field_multi(sample, 'hash')} "
                            f"uploaded={_field_multi(sample, 'uploaded')} "
                            f"downloaded={_field_multi(sample, 'downloaded')} "
                            f"trackers={_sample_trackers} "
                            f"site={self._resolve_site(_sample_trackers)}"
                        )
                    except Exception:
                        pass
                    self._logged_dtypes = getattr(self, "_logged_dtypes", set()) | {dtype}
                self._process_torrents(torrents, dtype, date_str, year, month, ts)
            except Exception as e:
                logger.error(f"下载器流量统计：处理下载器 {sname} 异常：{e}")

        logger.info(f"下载器流量统计：本次共采集 {total_torrents} 个种子")

        # 月度上传阈值限速检查
        self._maybe_apply_monthly_limit(month)
        # 月初自动恢复（如果当前已处于限速、且到时间了）
        self._maybe_reset_monthly_limit()

        logger.info("下载器流量统计：采集完成")

    def _maybe_apply_monthly_limit(self, month: str):
        """当月累计上传达到阈值时，给所选下载器设置全局上传限速。"""
        if self._upload_threshold_gb <= 0 or self._limit_speed_kb <= 0:
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
            f"已达阈值 {self._upload_threshold_gb} GB，设置全局上传限速 {self._limit_speed_kb} KB/s"
        )
        targets = self._downloaders or None
        try:
            helper = self._downloader_helper or (DownloaderHelper() if DownloaderHelper else None)
            if helper is None:
                return
            services = helper.get_services(name_filters=targets)
            for sname, sinfo in (services or {}).items():
                try:
                    if sinfo.instance.is_inactive():
                        logger.warning(f"下载器流量统计：下载器 {sname} 未连接，跳过限速")
                        continue
                    # download_limit=0 表示不限下载；upload_limit 单位 KB/s
                    sinfo.instance.set_speed_limit(download_limit=0, upload_limit=self._limit_speed_kb)
                    logger.warning(f"下载器流量统计：已对 {sname} 设置全局上传限速 {self._limit_speed_kb} KB/s")
                except Exception as e:
                    logger.error(f"下载器流量统计：设置 {sname} 限速失败：{e}")
        except Exception as e:
            logger.error(f"下载器流量统计：获取下载器实例失败 {e}")

    # =====================================================================
    # 月初自动恢复限速
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
        在采集收尾时检查：是否到达「本月 1 号 00:30」。若是，且插件并未在本月
        已经恢复过、且当前正在限速（阈值 > 0、配置限速 > 0），则解除限速并
        把 upload_limit 设为 0（不限制）。

        通过 plugin_state 表的 last_limit_reset_year_month 字段去重，避免重复
        推送。
        """
        try:
            # 用户没有启用限速 → 一切免谈
            if self._upload_threshold_gb <= 0 or self._limit_speed_kb <= 0:
                return
            now = datetime.now()
            ym = now.strftime("%Y-%m")
            # 仅在今天是 1 号、且过了 00:30 时才触发（用户配置 "每月 1 号 00:30"）
            is_window_open = now.day == 1 and (now.hour, now.minute) >= (0, 30)
            if not is_window_open:
                return
            last_ym = self._load_state("last_limit_reset_year_month")
            if last_ym == ym:
                return  # 本月已恢复过，不再重复
            self._do_reset_limit(reason="月初 00:30 自动恢复")
            self._save_state("last_limit_reset_year_month", ym)
            self._save_state("last_limit_reset_at", str(int(now.timestamp())))
        except Exception as e:
            logger.error(f"下载器流量统计：月初限速恢复检查失败：{e}")

    def _do_reset_limit(self, reason: str = ""):
        """对所有目标下载器解除上传限速（upload_limit=0）。"""
        targets = self._downloaders or None
        helper = self._downloader_helper
        if helper is None and DownloaderHelper is not None:
            helper = DownloaderHelper()
            self._downloader_helper = helper
        if helper is None:
            logger.warning("下载器流量统计：DownloaderHelper 不可用，无法恢复限速")
            return 0
        try:
            services = helper.get_services(name_filters=targets) or {}
        except Exception as e:
            logger.error(f"下载器流量统计：获取下载器实例失败：{e}")
            return 0
        reset_ok = []
        reset_failed = []
        for sname, sinfo in services.items():
            try:
                if sinfo.instance.is_inactive():
                    reset_failed.append(f"{sname}(离线)")
                    continue
                sinfo.instance.set_speed_limit(download_limit=0, upload_limit=0)
                reset_ok.append(sname)
            except Exception as e:
                reset_failed.append(f"{sname}({e})")
        if reset_ok:
            logger.warning(
                f"下载器流量统计：已{'，原因：' + reason if reason else ''}"
                f"解除上传限速(0=不限) → {', '.join(reset_ok)}"
            )
        if reset_failed:
            logger.warning(f"下载器流量统计：以下下载器解除限速失败：{reset_failed}")
        return len(reset_ok)

    def _get_month_total(self, month: str, downloader_names: List[str]) -> int:
        """统计某自然月（含指定下载器）的累计上传字节数。"""
        if self._db is None:
            return 0
        with self._db_lock:
            try:
                if downloader_names:
                    placeholders = ",".join("?" * len(downloader_names))
                    cur = self._db.execute(
                        f"SELECT COALESCE(SUM(uploaded),0) FROM traffic_records "
                        f"WHERE month=? AND downloader IN ({placeholders})",
                        [month] + list(downloader_names)
                    )
                else:
                    cur = self._db.execute(
                        "SELECT COALESCE(SUM(uploaded),0) FROM traffic_records WHERE month=?",
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

        for t in torrents:
            thash = _field_multi(t, "hash")
            if not thash:
                skipped += 1
                continue
            up = int(_field_multi(t, "uploaded", default=0) or 0)
            down = int(_field_multi(t, "downloaded", default=0) or 0)
            trackers = _field_multi(t, "trackers", default=[]) or []
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
                # 首次见到该种子：把当前累计值作为基准直接入账，
                # 避免「永远等不到上一次快照」导致数据永久为 0。
                dup = max(0, up)
                ddown = max(0, down)

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
            # dict：qbittorrent-api 的 tracker（url/host/site 键）
            # 对象：transmission-rpc 的 Tracker，必须取真实 announce/url/host，不能 str()（会把内存地址当域名）
            url = ""
            if isinstance(tr, dict):
                url = tr.get("url") or tr.get("host") or tr.get("site") or ""
            else:
                url = _field(tr, "url", "announce", "host", "sitename", default="")
            host = _extract_domain(url)
            if host:
                break
        if not host:
            return "未知站点"
        # 优先映射成 MP 站点名；映射不上则退回可读的 tracker 域名
        return self._map_domain_to_site(host) or host

    def _map_domain_to_site(self, host: str) -> Optional[str]:
        """用 SitesHelper 把 tracker 域名映射成 MP 里添加的 PT 站点名。

        兼容 get_sites() 返回 dict({域名或id: 站点}) 或 list([站点, ...])，
        且站点的 domain 字段可能是字符串/逗号分隔/列表三种形态。
        """
        if self._sites_helper is None:
            return None
        try:
            raw = self._sites_helper.get_sites() or []
            # 归一化成 list[dict]
            if isinstance(raw, dict):
                site_list = list(raw.values())
            else:
                site_list = list(raw)
            for site in site_list:
                if isinstance(site, dict):
                    name = site.get("name") or ""
                    dom = site.get("domain") or site.get("url") or ""
                else:
                    name = getattr(site, "name", None) or ""
                    dom = getattr(site, "domain", None) or getattr(site, "url", "") or ""
                if not name:
                    continue
                # domain 可能是列表或逗号分隔字符串
                if isinstance(dom, str):
                    doms = [d for d in dom.replace("，", ",").split(",") if d]
                else:
                    doms = list(dom or [])
                for sd in doms:
                    sd = _extract_domain(str(sd))
                    if sd and (sd in host or host in sd):
                        return name
        except Exception as e:  # pragma: no cover
            logger.debug(f"下载器流量统计：站点映射失败 {e}")
        return None

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
