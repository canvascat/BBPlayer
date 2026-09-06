# BBPlayer

本地优先的 Bilibili 音频播放器。macOS 桌面端。

## 开发

```bash
vp install
vpr desktop
```

## 项目结构

- **[packages/main](./packages/main)**: Electron 主进程与打包
- **[packages/renderer](./packages/renderer)**: 渲染进程（React + Vite）
- **[packages/common](./packages/common)**: 主进程与渲染进程共享常量
- **[packages/core](./packages/core)**: 搜索策略、BV/AV、歌词解析与转换

`vpr desktop` 会编排 renderer 的 Vite、main/preload 的 `vp pack --watch`，以及 Electron。不要用根目录的 `vp dev` 启动桌面端。
