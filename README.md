# MoviePilot 第三方插件库（mp_plugins）

个人维护的 MoviePilot 第三方插件库，包含若干个基于社区插件的兼容性 / bug 修复版。所有插件均通过 MoviePilot 插件市场安装，仓库地址即插件源。

> 本项目是个人修复集合，不代表 MoviePilot 官方插件。

## 插件列表

| 插件 | 版本 | 说明 | 标签 |
| --- | --- | --- | --- |
| 清理媒体文件（Jellyfin修复版） | v2.16.1 | 修复 Jellyfin 删除整个媒体目录时硬链接未同步清理 | 文件整理,媒体库,Jellyfin,硬链接 |
| 自动限速（KB单位修复版） | v1.1.6 | 修复 qBittorrent 限速单位错误，qB 与 Transmission 统一以 KB 为单位 | 下载器,限速,qBittorrent,Transmission,PT |

## 安装

1. 在 MoviePilot 的 `PLUGIN_MARKET` 变量中加入本仓库地址（多个仓库用英文逗号分隔）：
   ```
   https://github.com/BigRiceFrog/mp_plugins
   ```
2. 在 MoviePilot 设置中填写 **GitHub Token**（插件市场需调用 GitHub API 下载/更新，避免匿名限流）。
3. 刷新插件市场，搜索插件名称安装。

仓库默认分支为 `main`，MoviePilot 仅读取 `main` 分支。

## 插件说明

### 清理媒体文件（Jellyfin修复版）v2.16.1

基于 MoviePilot「清理媒体文件」v2.16 的个人兼容性修正版。

**修复内容**：Jellyfin 删除整个媒体目录时，文件监控只收到目录删除事件，导致原插件没有继续进入文件级硬链接清理流程。修正版利用插件已有的 `file_state` 找出该目录下原先记录的文件，并继续调用原有的文件删除处理流程，保留 v2.16 原有的延迟删除、inode/device 硬链接判断、硬链接同步清理、STRM 监控、刮削文件处理、转移记录处理及重新硬链接保护逻辑。

**注意**：请不要同时启用原版「清理媒体文件」和本修正版，避免两个插件同时监控相同目录。

### 自动限速（KB单位修复版）v1.1.6

基于 ClarkChen「自动限速」v1.1.5 的个人修复版，给 qBittorrent / Transmission 的种子按标签限速。

**修复内容**：原版给 qBittorrent 限速时直接调用 qB 原始 API（单位字节/秒），而给 Transmission 走 MoviePilot 封装（单位 KB/秒），导致同一份配置下 qB 限速偏小 1024 倍（需填 `102400` 才约等于 100 KB/s）。修正版让 qB 也走 `change_torrent` 封装，二者统一以 **KB/秒** 为单位。

**配置变更**：qB 与 Transmission 现在使用同一套 KB 值，例如 `1PTBA:100`、`52pt:100` 均表示 100 KB/s（旧 qB 需填 `102400` 的写法作废）。

## 通用注意事项

- 仓库内各插件均为独立修复版，请勿与对应的原版插件同时启用，避免配置/监控冲突。
- **发布新版本必须同步两处版本号**，否则 MP 市场不提示更新、仍显示旧版本：
  1. 插件代码内的 `plugin_version`（如 `plugins.v2/limit/__init__.py`）；
  2. 仓库根 `package.json` / `package.v2.json` 中对应插件的 `version` 字段（MoviePilot 实际读取的是这一处），并同步追加 `history` 变更说明。
  > 踩坑：曾只改了 `plugin_version` 而漏改 `package.v2.json`，导致 MP 长时间显示旧版本。
- 插件 API 路由在安装 / 更新后需**重启 MoviePilot** 才会重新注册；详情页 404、设置页下拉为空时优先排查是否未重启。
