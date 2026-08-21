# 桌面端 app:// 静态资源与开发转发

日期：2026-08-21  
范围：`apps/desktop` 窗口加载、`app://` 协议处理、Vite HMR、CSP

## 目标

主窗口、歌词窗、迷你窗始终以 `app://localhost` 为文档 origin。页面、脚本、样式与 tRPC 同源。开发时非 `/trpc` 请求由主进程转发到 Vite；生产时从 `dist` 读文件。

成功标准：

- 三个窗口的 `loadURL` 都是 `app://localhost/...`，开发不再加载 `VITE_DEV_SERVER_URL`，生产不再 `loadFile`
- 渲染进程 `fetch('app://localhost/trpc')` 不再触发 CSP `connect-src` 拦截
- 开发时 Vite HMR 仍可用（WebSocket 连 `127.0.0.1` 上的 Vite 端口）
- 生产构建能打开三个 HTML 入口及其 hashed 资源
- 现有 `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 不把 `audio-proxy` 迁到 `app://`（仍 `http://127.0.0.1:<port>`）
- 不代理 B 站封面图
- 不改极验窗的 `loadFile`
- 不收紧或重写整份 CSP，只保证 `'self'` 覆盖 tRPC、HMR/音频现有例外仍在

## 背景

当前 `protocol.handle('app')` 只响应 `/trpc`，其它路径 404。窗口开发期加载 `http://127.0.0.1:5173`（或 `localhost`），文档 origin 与 `app://localhost/trpc` 不同源。HTML CSP 的 `connect-src` 含 `'self'` 与 `http://127.0.0.1:*`，不含 `app:`，于是 tRPC `fetch` 被拒。

## 窗口加载

`loadRenderer` 不再分支环境：

| 页面   | URL                           |
| ------ | ----------------------------- |
| 主窗口 | `app://localhost/`            |
| 歌词   | `app://localhost/lyrics.html` |
| 迷你   | `app://localhost/mini.html`   |

`/` 在协议层映射为 `index.html`。不要用 `app://./` 这类非 standard-host URL。

## 协议处理

继续在 `app.ready` 前 `registerSchemesAsPrivileged`（已有特权不变）。`app.ready` 后同一个 `protocol.handle('app', ...)` 按路径分流：

1. `pathname === '/trpc'` 或 `pathname.startsWith('/trpc/')` → 现有 `fetchRequestHandler`
2. 若存在 `VITE_DEV_SERVER_URL` → 开发转发
3. 否则 → 生产静态文件

把可单测的分流 / 路径解析抽到 `app-protocol.ts` 的纯函数，Electron `protocol.handle` / `net.fetch` 只做适配。

### 开发转发

目标 URL：`new URL(pathname + search, VITE_DEV_SERVER_URL)`。用 Electron `net.fetch` 拉取 Vite，并把 Response 原样返回给渲染进程。

- 只转发 GET/HEAD（静态与 Vite 模块）。其它方法对非 `/trpc` 路径返回 405
- 不要把 `app://` 请求的 `Host` 原样带给 Vite；按目标 HTTP URL 生成 Host
- `bypassCustomProtocolHandlers: true`，避免再进自定义协议
- Vite 未启动或 `net.fetch` 失败：返回 502，不要抛进 `protocol.handle` 导致窗口空白无状态码

Vite 注入的 `/@vite/client`、`/@fs/...`、`/src/...` 都是以 `/` 开头的路径，文档 origin 为 `app://localhost` 时会变成 `app://localhost/@vite/client` 等，转发即可。

### 生产静态文件

`pathname === '/'` → `index.html`，否则去掉前导 `/` 作为相对路径。与 `rendererDist`（现有 `RENDERER_DIST`）拼接后：

- `decodeURIComponent` 后再解析
- `path.normalize` 后必须仍位于 `rendererDist` 目录内（含边界：`dist` 本身不允许当文件读出）
- 穿越或文件不存在 → 404
- 存在则 `net.fetch(pathToFileURL(abs).href)`，让 Chromium 填 MIME

不引入 SPA fallback：未知路径 404，不重写到 `index.html`。

## HMR

自定义协议不能承载 WebSocket。Vite 配置：

```ts
server: {
  hmr: {
    protocol: 'ws',
    host: '127.0.0.1',
  },
}
```

不写死端口：`__HMR_PORT__` 用 Vite 实际监听端口（可能不是 5173）。客户端连 `ws://127.0.0.1:<port>`，而不是空的 `app://` `location.port`。

现有 `server.fs.allow` 保留。

## CSP

三份 HTML 的 `connect-src` 在 `'self'` 之外继续允许 `http://127.0.0.1:*`（音频，及 Vite 偶发 HTTP）和 `ws:` / `wss:`（HMR）。文档 origin 改为 `app://localhost` 后，`'self'` 覆盖 tRPC，不必再单独写 `app:`。

`script-src 'self' 'unsafe-eval'` 保留（Vite 开发需要）。

## 错误处理

| 情况                   | 行为                   |
| ---------------------- | ---------------------- |
| 路径穿越、缺文件       | 404                    |
| 开发转发失败           | 502                    |
| 非 GET/HEAD 的静态路径 | 405                    |
| `/trpc` 错误           | 仍由 tRPC handler 决定 |

## 测试

`apps/desktop/src/main/app-protocol.test.ts` 覆盖纯函数：

- `/trpc`、`/trpc/settings.get` → trpc，不进 Vite/文件
- 开发：`/`、`/lyrics.html`、`/@vite/client?v=1` 的目标 URL 拼到 Vite origin
- 生产：`/` → `index.html`；`/mini.html`、`/assets/x.js` 落在 dist 内
- `../`、`%2e%2e` 穿越 → 拒绝
- 开发转发不把 `Host: localhost` 传给目标

不测真实 Electron `protocol.handle`。

## 涉及文件

- `apps/desktop/src/main/app-protocol.ts`：分流、安全解析、转发/读文件
- `apps/desktop/src/main/app-protocol.test.ts`：新增
- `apps/desktop/src/main/index.ts`：`loadRenderer` 恒为 `app://`；`installAppProtocolHandler` 传入 `rendererDist` 与 `VITE_DEV_SERVER_URL`
- `apps/desktop/vite.config.ts`：`server.hmr`
- `apps/desktop/src/renderer/{index,lyrics,mini}.html`：仅在现有 CSP 无法覆盖 HMR/音频时微调 `connect-src`

preload 的 `trpcUrl: 'app://localhost/trpc'` 不变。
