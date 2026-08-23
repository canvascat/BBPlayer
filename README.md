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

- **[apps/docs](./apps/docs)**: 项目文档站点
- **[packages/main](./packages/main)**: Electron 主进程与打包
- **[packages/renderer](./packages/renderer)**: 渲染进程（React + Vite）
- **[packages/common](./packages/common)**: 主进程与渲染进程共享常量
- **[packages/core](./packages/core)**: 搜索策略、BV/AV、歌词解析与转换

桌面端播放界面歌词使用 [AMLL](https://amll.dev/)，按 **AGPL-3.0** 分发。

`pnpm desktop` 会编排 renderer 的 Vite、main/preload 的 `vp pack --watch`，以及 Electron。不要用根目录的 `vp dev` 启动桌面端。

## 捐赠支持

捐赠方式见 [官网](https://bbplayer.roitium.com)。
