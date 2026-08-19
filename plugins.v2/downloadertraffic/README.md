# 下载器流量统计（DownloaderTraffic）

按年 / 月 / 日统计 qBittorrent、Transmission 的上传 / 下载流量，并细分到每个 PT 站点。
配置页可从 MoviePilot 已配置下载器中选择；支持「月度上传阈值超限后自动全局限速」与「**每月 1 号 00:30 自动恢复限速**」。
详情页提供 Vue 图表（按站柱状图 + 趋势折线图）。

## 功能

- 定时采集所选下载器的做种上传 / 下载流量，按年、月、日聚合落库。
- 配置页下载器下拉直接从 MP 已配置下载器读取（多选）。
- 月度上传达阈值时，自动对所选下载器调用 `set_speed_limit` 全局限速。
- **每月 1 号 00:30 自动解除上传限速**（强制解除，恢复不限速状态，避免月初仍带着上月的限速）。
- 详情页图表化展示各 PT 站点流量占比与历史趋势。
- 详情页 / 配置页均有「**立即采集**」和「**立即解除限速**」两个按钮，方便排查问题。

## 配置

- **下载器**：从 MP 已配置下载器中选择（多选，留空统计全部）。
- **采集周期 (Cron)**：默认 `*/30 * * * *`（每 30 分钟）。
- **月度上传阈值 (GB)**：当月累计上传达到该值后触发限速；0 = 不触发。
- **超限后全局上传限速 (KB/s)**：触发后对各下载器设置的全局上传限速值；0 = 即使达到阈值也不限速。
- **月初恢复**：每月 1 号 00:30 自动调用 `set_speed_limit(upload_limit=0)` 解除限速，并把状态写入 `plugin_state` 去重。

## 接口（外部调用，token 见 `?token=API_TOKEN`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `plugin/downloadertraffic/records?period=day&value=2026-08-19` | 日 / 月 / 年聚合 |
| GET | `plugin/downloadertraffic/trend?period=month&value=2026-08` | 逐日 / 逐月趋势 |
| GET | `plugin/downloadertraffic/downloaders` | MP 已配置下载器 |
| GET | `plugin/downloadertraffic/collect` | 立即触发一次采集（同步返回 ok） |
| POST | `plugin/downloadertraffic/reset-limit` | 立即解除下载器上传限速 |

> 实际注册路径会随 MP 版本对 plugin_id（类名 / 文件夹名）的不同解析而异，
> 本插件 v1.2.0 起**每个接口同时注册三条路径**，覆盖各种约定。

## 版本与更新须知（重要）

MoviePilot 插件市场读取的版本号来自 **`package.v2.json` 中本插件的 `version` 字段**，
而**不是** `__init__.py` 里的 `plugin_version`。

**发布新版本时，两处必须同步修改，否则会出现「代码已更新、但 MP 市场仍显示旧版本 / 不提示更新」：**
1. `plugins.v2/downloadertraffic/__init__.py` 的 `plugin_version`
2. 仓库根 `package.v2.json` 中 `DownloaderTraffic.version`，并同步追加 `history` 变更说明

> 踩坑记录：v1.0.9 修复曾因只改了 `__init__.py` 而漏改 `package.v2.json`，导致 MP 一直显示 1.0.8。

**重启 MoviePilot 后路由才生效**。插件 API 路由（`/records`、`/trend`、`/downloaders`、`/collect`、`/reset-limit`）
在（重新）安装并**重启 MoviePilot** 后才重新注册。若详情页报 404、设置页下载器下拉为空，
请重启 MP 后查看启动日志「插件 init 完成」一行，里面会打印 `plugin_id` 实际值。

## 修复记录

### v1.2.0 —— 修复 404 + 调试按钮 + 月初自动恢复
- **修复详情页 404 与设置页下载器下拉为空**：`get_api` 同时注册三条路径
  （`/records`、`/DownloaderTraffic/records`、`/downloadertraffic/records`），覆盖
  MP 取 `plugin_id` 的不同约定（类名 vs 文件夹名）。启动时打印
  `plugin_id(类名)=XXX, module=YYY, enabled=...`，便于直接看到路由实际拼出来的 id。
- **新增调试按钮**：详情页工具栏与配置页底部均加入「立即采集」「立即解除限速」按钮，
  分别调 `GET /collect`、`POST /reset-limit`，用于排查 404 等异常（无需等 30 分钟）。
- **新增月初自动恢复（用户需求 #5）**：每月 1 号 00:30 自动判断是否处于限速；
  如是则调用 `set_speed_limit(upload_limit=0)` 解除限速，并把 `last_limit_reset_year_month`
  持久化到 `plugin_state` 表，避免重复触发。
- 新增 `plugin_state` 表用于跨进程记录状态键值对。

### v1.1.2 —— 修复 Transmission 流量恒为 0
- `_field` 增加兼容 `transmission-rpc` 的 `Torrent` 内部 `_fields` 字典取值。

### v1.1.1 —— 路由修复（撤掉误改的多路径）
- 核对 MP 源码确认 `core_plugin.py.get_plugin_apis` 会自动把插件 id 拼到 path 前，
  故 `get_api` 直接返回 `/records` 等不带 id 的单路径即正确。

### v1.0.9 —— 修复流量统计恒为 0
- **根因**：采集逻辑仅在「已有上次快照」时才累加增量，第一采集什么都不记；
  一旦快照未跨轮持久化，每轮都当「第一次」→ 永远 0 且不报错。
- **修复**：首次见到某种子即记录其当前累计上传 / 下载绝对值（`dup = max(0, up)`），
  后续轮再累加增量。

### v1.0.8 —— 修复线程间 SQLite 报错导致零数据
定时采集在独立线程运行，sqlite 默认禁止跨线程复用。改为 `connect(check_same_thread=False)`
并用 `threading.RLock` 串行化全部 DB 读写（采集与 API 查询互斥）。

### v1.0.7 及之前
见根仓库 README「插件说明」与 `package.v2.json` 的 `history` 字段。
