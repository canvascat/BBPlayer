<div align="center">
<h1>BBPlayer</h1>

本地优先的 Bilibili 音频播放器。macOS 桌面端。

[![Website](https://img.shields.io/badge/Website-bbplayer.roitium.com-blue?style=flat-square)](https://bbplayer.roitium.com)

</div>

---

**[前往官网查看更多详情和上手指南 ➔](https://bbplayer.roitium.com)**

## 开发

```bash
pnpm install
pnpm desktop
```

## 项目结构

- **[apps/desktop](./apps/desktop)**: macOS 桌面客户端（Electron + React + Vite+）
- **[apps/docs](./apps/docs)**: 项目文档站点
- **[packages/](./packages)**: 共享库
  - **[@bbplayer/core](./packages/core)**: 搜索策略、BV/AV、歌词转换
  - **[@bbplayer/splash](./packages/splash)**: 歌词解析与转换

桌面端播放界面歌词使用 [AMLL](https://amll.dev/)，按 **AGPL-3.0** 分发。

## 捐赠支持

捐赠方式见 [官网](https://bbplayer.roitium.com)。
