# BBPlayer 桌面端

macOS 客户端。构建使用 [Vite+](https://viteplus.dev/)：渲染进程走 `vp build` / `vp dev`，主进程与 preload 走 `vp pack`。播放界面歌词使用 [AMLL](https://amll.dev/)（AGPL-3.0），因此 **本应用按 AGPL-3.0 分发**。歌词文件仍使用 SPL，经 `@bbplayer/core` 解析后再转成 AMLL 行模型。

## 开发

在仓库根目录：

```bash
pnpm install
pnpm desktop
```

`pnpm desktop` 会编排渲染进程 Vite、主进程/preload 的 `vp pack --watch`，以及 Electron。不要用根目录的 `vp dev` 启动桌面端，那只会起渲染进程。

打包 macOS 安装包（会生成 `.dmg` / `.zip`，zip 供 electron-updater 使用）：

```bash
pnpm --filter @bbplayer/desktop pack:mac
```

发版时把安装包推到 GitHub Release（需 `GH_TOKEN`）：

```bash
pnpm --filter @bbplayer/desktop release:mac
```

## 当前能力

- 主窗口：主页 / 音乐库 / 设置
- 搜索 BV、AV、关键词、b23 短链
- 分 P 列表点播（本机音频代理注入 Referer/Cookie）
- 底栏播控、空格播放暂停（输入框内除外）
- 关闭窗口后继续在菜单栏驻留（可关）
- B 站登录：Cookie、扫码、手机号 + Geetest
- 本机 SQLite 歌单库、备份导入/导出
- 缓存音频与导出 m4a
- 网易云自动匹配歌词，播放页 / 独立歌词窗用 AMLL 渲染
- BBPlayer 账号与共享歌单
- 只读评论、装扮皮肤子集、检查更新
