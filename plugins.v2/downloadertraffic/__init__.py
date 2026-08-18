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


def _field(obj: Any, *names: str, default: Any = None) -> Any:
    """从对象或字典里按多个候选字段名取值。"""
    for name in names:
        if isinstance(obj, dict):
            if name in obj and obj[name] is not None:
                return obj[name]
        else:
            val = getattr(obj, name, None)
            if val is not None:
                return val
    return default


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
    plugin_version = "1.0.2"
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
    _db: Optional[sqlite3.Connection] = None
    _downloader_helper: Optional[DownloaderHelper] = None
    _sites_helper: Optional[SitesHelper] = None

    # =====================================================================
    # 生命周期
    # =====================================================================
    def init_plugin(self, config: dict = None):
        config = config or {}
        self._enabled = bool(config.get("enabled"))
        self._cron = config.get("cron") or "*/30 * * * *"
        # downloaders 在表单里以逗号分隔的字符串存储
        raw = config.get("downloaders") or ""
        if isinstance(raw, list):
            self._downloaders = [str(x).strip() for x in raw if str(x).strip()]
        else:
            self._downloaders = [s.strip() for s in str(raw).split(",") if s.strip()]
        self._downloader_helper = DownloaderHelper() if DownloaderHelper else None
        self._sites_helper = SitesHelper() if SitesHelper else None
        self.__init_db()
        # 事件总线注册（可选，失败不影响核心功能）
        if eventmanager is not None and EventType is not None:
            try:
                eventmanager.register(EventType.PluginAction)(self.handle_command)
            except Exception as e:  # pragma: no cover
                logger.debug(f"下载器流量统计：事件注册失败 {e}")

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
        return [{
            "component": "VForm",
            "content": [
                {
                    "component": "VSwitch",
                    "props": {"model": "enabled", "label": "启用插件"}
                },
                {
                    "component": "VTextField",
                    "props": {
                        "model": "cron",
                        "label": "采集周期 (Cron 表达式)",
                        "placeholder": "*/30 * * * *",
                        "hint": "默认每 30 分钟采集一次，建议不要太密集"
                    }
                },
                {
                    "component": "VTextField",
                    "props": {
                        "model": "downloaders",
                        "label": "指定下载器 (留空=全部，多个用逗号分隔)",
                        "placeholder": "QB-Main,TR-Seed",
                        "hint": "下载器名称可在 设定-下载器 中查看"
                    }
                }
            ]
        }], {
            "enabled": False,
            "cron": "*/30 * * * *",
            "downloaders": ""
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
        return [{
            "path": "/records",
            "endpoint": self.api_records,
            "methods": ["GET"],
            "summary": "查询流量统计",
            "description": "按 年/月/日 查询上传/下载流量，可按站点、下载器过滤"
        }, {
            "path": "/trend",
            "endpoint": self.api_trend,
            "methods": ["GET"],
            "summary": "查询流量时间趋势",
            "description": "按月/年返回逐日或逐月的累计上传/下载趋势，用于绘制折线图"
        }]

    def get_render_mode(self):
        """启用 Vue 模块联邦页面（图表化详情页）。宿主会从 dist/assets/remoteEntry.js 加载组件。"""
        return ("vue", "dist/assets")

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
                        "通过接口获取 JSON 数据（需带 <code>?token=API_TOKEN</code>）：<br/>"
                        "<code>GET /plugin/downloadertraffic/records?period=day&amp;value=2026-08-18</code><br/>"
                        "<code>GET /plugin/downloadertraffic/records?period=month&amp;value=2026-08</code><br/>"
                        "<code>GET /plugin/downloadertraffic/records?period=year&amp;value=2026</code><br/><br/>"
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

        for sname, sinfo in services.items():
            try:
                if sinfo.instance.is_inactive():
                    logger.warning(f"下载器流量统计：下载器 {sname} 未连接，跳过")
                    continue
                downloader = sinfo.instance
                dtype = sinfo.type  # "qbittorrent" / "transmission"
                torrents, error = downloader.get_torrents()
                if error:
                    logger.error(f"下载器流量统计：获取 {sname} 种子失败：{error}")
                    continue
                self._process_torrents(torrents or [], dtype, date_str, year, month, ts)
            except Exception as e:
                logger.error(f"下载器流量统计：处理下载器 {sname} 异常：{e}")

        logger.info("下载器流量统计：采集完成")

    def _process_torrents(self, torrents, dtype: str,
                          date_str: str, year: int, month: str, ts: int):
        delta_by_site: Dict[str, Dict[str, int]] = {}
        global_up = global_down = 0
        new_snapshots: List[Tuple[str, str, int, int, int]] = []

        for t in torrents:
            thash = _field(t, "hash", "hashString")
            if not thash:
                continue
            up = int(_field(t, "uploaded", "uploadedEver", default=0) or 0)
            down = int(_field(t, "downloaded", "downloadedEver", default=0) or 0)
            trackers = _field(t, "trackers", default=[]) or []
            site = self._resolve_site(trackers)

            prev = self._get_snapshot(thash, dtype)
            if prev is not None:
                dup = up - prev[0]
                ddown = down - prev[1]
                # 计数器重置（下载器重启 / 种子重新添加）保护
                if dup < 0:
                    dup = 0
                if ddown < 0:
                    ddown = 0
                if dup or ddown:
                    bucket = delta_by_site.setdefault(site, {"up": 0, "down": 0})
                    bucket["up"] += dup
                    bucket["down"] += ddown
                    global_up += dup
                    global_down += ddown

            new_snapshots.append((thash, dtype, up, down, ts))

        # 写入 / 累加记录
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
        domain = ""
        for tr in trackers:
            url = ""
            if isinstance(tr, dict):
                url = tr.get("url") or tr.get("host") or tr.get("site") or ""
            else:
                url = str(tr)
            domain = _extract_domain(url)
            if domain:
                break
        if not domain:
            return "未知站点"
        return self._map_domain_to_site(domain) or domain

    def _map_domain_to_site(self, domain: str) -> Optional[str]:
        """用 SitesHelper 把 tracker 域名映射成 PT 站点名。"""
        if self._sites_helper is None:
            return None
        try:
            sites = self._sites_helper.get_sites() or {}
            for site_domain, site in sites.items():
                if not site_domain:
                    continue
                sd = site_domain.lower().replace("https://", "").replace("http://", "")
                sd = sd.split("/")[0]
                # 域名匹配（站点域名包含于 tracker 域名，或反之）
                if sd and (sd in domain or domain in sd):
                    name = getattr(site, "name", None) or site_domain
                    return name
        except Exception as e:
            logger.debug(f"下载器流量统计：站点映射失败 {e}")
        return None

    # =====================================================================
    # SQLite 存取
    # =====================================================================
    def __init_db(self):
        db_path = self.get_data_path() / "traffic.db"
        self._db = sqlite3.connect(str(db_path))
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
        self._db.commit()

    def _upsert_record(self, date_str, year, month, site, dtype, up, down, ts):
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
        cur = self._db.cursor()
        cur.execute(
            "SELECT uploaded, downloaded FROM torrent_snapshots WHERE hash=? AND downloader=?",
            (thash, dtype)
        )
        row = cur.fetchone()
        return (int(row[0]), int(row[1])) if row else None

    def _replace_snapshots(self, snapshots: List[Tuple[str, str, int, int, int]]):
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
