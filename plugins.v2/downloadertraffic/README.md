# 下载器流量统计（DownloaderTraffic）

按年 / 月 / 日统计 qBittorrent、Transmission 的上传 / 下载流量，并细分到每个 PT 站点。
配置页可从 MoviePilot 已配置下载器中选择；支持「月度上传阈值超限后自动全局限速」。
详情页提供 Vue 图表（按站柱状图 + 趋势折线图）。

## 功能

- 定时采集所选下载器的做种上传 / 下载流量，按年、月、日聚合落库。
- 配置页下载器下拉直接从 MP 已配置下载器读取（多选）。
- 月度上传达阈值时，自动对所选下载器调用 `set_speed_limit` 全局限速。
- 详情页图表化展示各 PT 站点流量占比与历史趋势。

## 配置

- **下载器**：从 MP 已配置下载器中选择（多选）。
- **月度上传阈值 (GB)**：当月累计上传达到该值后触发限速；留空 / 0 表示不触发。
- **超限后全局上传限速 (KB/s)**：触发后对各下载器设置的全局上传限速值。

## 版本与更新须知（重要）

MoviePilot 插件市场读取的版本号来自 **`package.v2.json` 中本插件的 `version` 字段**，
而**不是** `__init__.py` 里的 `plugin_version`。

**发布新版本时，两处必须同步修改，否则会出现「代码已更新、但 MP 市场仍显示旧版本 / 不提示更新」：**
1. `plugins.v2/downloadertraffic/__init__.py` 的 `plugin_version`
2. 仓库根 `package.v2.json` 中 `DownloaderTraffic.version`，并同步追加 `history` 变更说明

> 踩坑记录：v1.0.9 修复曾因只改了 `__init__.py` 而漏改 `package.v2.json`，导致 MP 一直显示 1.0.8。

另外，插件 API 路由（`/records`、`/trend`、`/downloaders`）在插件（重新）安装并**重启 MoviePilot** 后才重新注册。
若详情页报 404、设置页下载器下拉为空，优先排查是否未重启。

## 修复记录

### v1.0.9 —— 修复流量统计恒为 0
- **根因**：采集逻辑仅在「已有上次快照」时才累加增量，第一采集什么都不记；一旦快照未跨轮持久化，每轮都当「第一次」→ 永远 0 且不报错。
- **修复**：首次见到某种子即记录其当前累计上传 / 下载绝对值（`dup = max(0, up)`），后续轮再累加增量。只要有上传数据，立即可见。
- 新增 `_field_multi` 多字段名兜底，兼容不同 MP 版本 `TorrentInformation` 字段差异（`uploaded` / `uploadedEver` / `uploaded_total` 等）。
- 兼容 `get_torrents()` 返回 `(list, error)` 元组，或以 hash 为键的字典。
- 增加自诊断日志：本次种子总数、首个种子真实字段名样例、各下载器本次入账 GB 数、被跳过（缺 hash）的种子数。

### v1.0.8 —— 修复线程间 SQLite 报错导致零数据
定时采集在独立线程运行，sqlite 默认禁止跨线程复用。改为 `connect(check_same_thread=False)`
并用 `threading.RLock` 串行化全部 DB 读写（采集与 API 查询互斥）。

### v1.0.7 及之前
见根仓库 README「插件说明」与 `package.v2.json` 的 `history` 字段。
