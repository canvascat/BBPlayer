# Node tRPC 开发服务

日期：2026-09-04  
范围：`packages/trpc-dev`、以及 `packages/main` 中为 Node 加载 router 做的最小拆分

## 目标

在不启动 Electron 的情况下，用 Node 跑同一份 `appRouter`，并用类似 Swagger 的 Panel 浏览、调试 procedure。登录态只从环境变量 `BILI_COOKIE` 注入。

成功标准：

- `pnpm trpc-dev` 启动 HTTP 服务；`/` 为 Panel，`/trpc` 为 tRPC
- 调用桌面专用 context（窗口、托盘、系统对话框、剪贴板、更新器等）时抛出 `PRECONDITION_FAILED`
- 加载 `appRouter` 不再经过 `import 'electron'`
- `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 不实现网页登录窗、极验窗、系统文件对话框、托盘刷新
- 不接入 `audioProxy` / `player.resolve` 的真实播放
- Panel 不保证能调试 subscription
- renderer 不改连这个服务

## 传输

- 适配器：`@trpc/server/adapters/standalone` 的 `createHTTPHandler`
- 默认端口 `4000`，可用 `PORT` 覆盖
- Cookie：进程启动时读取 `BILI_COOKIE` 写入内存 store；界面不单独管登录

## 结构

```
packages/main/src/phone-sms.ts          # 短信登录 HTTP，无 electron
packages/main/src/trpc/node-context.ts  # Node runtime + 桌面方法抛错
packages/trpc-dev/src/index.ts          # 读 env、listen
packages/trpc-dev/src/server.ts         # HTTP：Panel + /trpc
```

`auth` router 从 `phone-sms.ts` 引入短信函数；`phone-login.ts` 只保留极验窗。

## Context

每个进程一份 runtime（内存 store + `PlayerDatabase.open(':memory:')` + RxJS events），`createContext` 每请求复用它。

实现：`refreshAccount`（B 站 HTTP）。

抛错：`refreshShell`、`openExternal`、`copyText`、`checkUpdate`、`showMain`、`openGeetest`、`openWebLogin`、`clearBiliLoginSession`、`exportDownloads`、`exportBackup`、`importBackup`、`resolvePlay`。
