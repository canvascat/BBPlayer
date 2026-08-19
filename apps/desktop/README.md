# BBPlayer 桌面端

macOS 客户端，业务对齐 Android 版。播放界面歌词使用 [AMLL](https://amll.dev/)（AGPL-3.0），因此 **本应用按 AGPL-3.0 分发**。歌词文件仍使用 SPL，经 `@bbplayer/splash` 解析后再转成 AMLL 行模型。

## 开发

在仓库根目录：

```bash
pnpm install
pnpm --filter @bbplayer/desktop dev
```

## 当前能力

- 主窗口：主页 / 音乐库 / 设置
- 搜索 BV、AV、关键词、b23 短链
- 分 P 列表点播（本机音频代理注入 Referer/Cookie）
- 底栏播控、空格播放暂停（输入框内除外）
- 关闭窗口后继续在菜单栏驻留（可关）
- 网易云自动匹配歌词并在播放页用 AMLL 渲染

尚未接入：扫码登录、收藏夹同步、共享歌单、备份包、迷你窗。Cookie 可在设置中粘贴。
