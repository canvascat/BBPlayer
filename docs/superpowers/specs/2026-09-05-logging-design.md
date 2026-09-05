# 日志系统（Pino）

日期：2026-09-05  
范围：`packages/main` 的 Pino 模块与 tRPC；`packages/renderer` 的 logger、全局错误与设置页。参考 `~/workspace/motrix` 的主进程 Pino，并补上 Motrix 二期才做的渲染进程上报与设置页。

## 目标

主进程用 Pino 打结构化日志。渲染进程用薄 API 经 tRPC 上报，不引入 IPC。用户能在设置页改级别、看到路径、打开日志目录。

成功标准：

- 开发默认 pretty 打终端，不落盘；`BBPLAYER_LOG_FILE=1` 时可双写
- 打包后 JSON 写入 `userData/logs/bbplayer.log`
- 级别：`BBPLAYER_LOG_LEVEL` > 设置页 `logLevel` > 默认 `warn`
- 设置页有诊断区：级别、只读路径、「在文件夹中显示」；帮助菜单同一入口
- 渲染进程 `log.*`、`window.error` / `unhandledrejection`、Error Boundary 都能进主进程日志
- Cookie / API Key 打日志时脱敏
- 不新增应用层 IPC
- `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 不拦截 `console.*`
- 不引入 Sentry / OpenTelemetry
- 不做文件轮转
- 不改 `packages/core`
- 不改 `packages/main/scripts/dev.ts` 的编排 `console`（继续用 `[main:dev]`）
- 设置页不提供 fatal / trace（只给 error / warn / info / debug）

## 方案

采用 Motrix 的 Pino + multistream，放在 `packages/main/src/logger/`（不新建 workspace 包）。渲染进程不装 Pino，只走 `desktop.reportLog`。

## 架构

```text
packages/main/src/logger/          # 纯 Node：createLogger / sink / env
        ↑
packages/main/src/logger/runtime.ts # 单例 root + child，无 electron
        ↑                    ↑
index.ts（Electron 初始化）   node-context / 各 router
        ↑
desktop.reportLog  ←  renderer logger / 全局错误 / Error Boundary
```

一个 root logger，`getLogger(name)` 返回 `child({ name })`。改级别只写 root，child 跟着变。

`logger/` 与 `runtime.ts` 不得 `import 'electron'`，避免 `appRouter` 再次绑上 Electron。`index.ts` 在最早时机调用 `initLogger`，传入打包态与默认路径。

## 环境变量与落盘

| 变量                              | 行为                                    |
| --------------------------------- | --------------------------------------- |
| （无）+ pretty 为真               | pretty → stdout，不写文件               |
| （无）+ pretty 为假               | JSON → 默认路径                         |
| `BBPLAYER_LOG_LEVEL`              | 覆盖级别                                |
| `BBPLAYER_LOG_FILE=1` / `true`    | 写默认路径；pretty 开启时与 stdout 双写 |
| `BBPLAYER_LOG_FILE=/abs/path.log` | 写指定文件                              |
| `BBPLAYER_LOG_PRETTY=1` / `0`     | 强制开 / 关 pretty                      |

pretty 判定（优先级）：

1. 已打包（`app.isPackaged`）→ 不 pretty
2. `BBPLAYER_LOG_PRETTY=1` / `true` → pretty
3. `BBPLAYER_LOG_PRETTY=0` / `false` → 不 pretty
4. 否则 `NODE_ENV === 'development'` → pretty

落盘路径：

| 场景                           | 路径                                        |
| ------------------------------ | ------------------------------------------- |
| 未打包 / Node tRPC 服务        | `<repo>/.data/logs/bbplayer.log`            |
| 已打包                         | `app.getPath('userData')/logs/bbplayer.log` |
| `BBPLAYER_LOG_FILE` 为绝对路径 | 该路径                                      |

`<repo>` 从 `packages/main` 的源码或 `dist/main.mjs` 向上三级。目录不存在时递归创建。`.data/` 加入根 `.gitignore`。

destination 用 `pino.destination({ dest, mkdir: true, sync: true })`，避免 Electron 下 worker transport 问题。`pino` 与 `pino-pretty` 加入 `packages/main/vite.config.ts` 的 `alwaysBundle`。

开发编排给 Electron 子进程注入 `NODE_ENV=development`（现有已有）。需要看启动日志时设 `BBPLAYER_LOG_LEVEL=info`。

## 级别

设置页与 store 使用：`error` | `warn` | `info` | `debug`。默认 `warn`。

环境变量若写 `verbose` → `debug`，`silly` → `trace`（与 Motrix 映射一致）。非法值回退 `warn`。

热更新：`settings.set({ logLevel })` 后若无 `BBPLAYER_LOG_LEVEL`，则 `root.level = ...`。有环境变量时设置页仍写入 store，运行中级别不变；诊断区说明「启动时设置了 BBPLAYER_LOG_LEVEL 则以环境变量为准」。

## tRPC

`settings.get` 增加：

- `logLevel`：当前 store 值（无则 `warn`）
- `logPath`：只读。始终给「将要 / 正在」使用的文件路径，即使当前 pretty 未落盘

`settings.set` 增加可选 `logLevel`。

`desktop.reportLog`：

```ts
{
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace'
  message: string
  context?: Record<string, unknown>
  stack?: string
}
```

主进程：`getLogger('renderer')[level]({ ...redact(context), stack }, message)`。

`desktop.openLogsFolder`：确保日志目录存在；文件已在则 `shell.showItemInFolder`，否则 `shell.openPath(dir)`。

`reportLog` 在 router 内直接调 logger，不进 `TrpcContext`。`openLogsFolder` 注入 context（Electron 用 `shell`；Node 服务 mkdir 后用系统打开命令，失败则 `PRECONDITION_FAILED`）。

tRPC 错误中间件：procedure 失败打 `error`（含 path / type / code）。**跳过** `desktop.reportLog`，避免循环。

## 渲染进程

`packages/renderer/src/logger.ts`：

- `log.error / warn / info / debug(message, context?)`
- 经 `trpcClient.desktop.reportLog.mutate`
- 上报失败只写 `console.error` / `console.warn`，不再调用 `log.*`

启动时（`main.tsx` 里 `createRoot` 之前）挂：

- `window.error` → `log.error`
- `unhandledrejection` → `log.error`

根上包一层 Error Boundary：记录一条 `log.error`（含 component stack），展示简单回退（说明出错 + 重新加载）。不拦截 `console.*`。

## 设置与菜单

设置页新增「诊断」区块：

- 日志级别：与现有 ToggleGroup 风格一致
- 只读路径：`logPath`
- 按钮：「在文件夹中显示」→ `desktop.openLogsFolder`

帮助菜单增加同一项，主进程直接打开目录（不必绕 tRPC）。

`app-context` 增加 `logLevel` / `setLogLevel`，与其它设置一样走 `settings.set` 并 `setSaved`。

## 主进程埋点

`index.ts` 在 `app.setName` 之后立刻 `initLogger`，并注册：

- `uncaughtException` → `fatal`
- `unhandledRejection` → `error`

关键失败（协议、更新、下载、登录、`whenReady`）打日志。现有空 `catch` 至少 `log.warn`。业务模块用 `getLogger('desktop' | 'protocol' | 'bili' | 'auth' | 'downloads' | 'updater')`。

## 脱敏

写入前递归处理对象与字符串：

- store 字段：`cookie`、`musicAiApiKey`
- Cookie 名：`SESSDATA`、`bili_jct`、`DedeUserID`、`DedeUserID__ckMd5`
- 命中后替换为 `[redacted]`

测试覆盖：含这些键的对象被替换；普通字段保留。

## 结构

```text
packages/main/src/logger/
  create-logger.ts
  destination.ts
  env.ts
  redact.ts
  runtime.ts
  index.ts
  *.test.ts
packages/main/src/desktop-logger.ts   # 仅 Electron 入口调用：算路径 + initLogger
packages/renderer/src/logger.ts
packages/renderer/src/error-boundary.tsx
```

## 验收

- [ ] Dev 默认 pretty、无 `.data/logs/bbplayer.log`
- [ ] `BBPLAYER_LOG_FILE=1` 后双写
- [ ] 打包或非 pretty 时写入约定路径
- [ ] 设置页改级别后新日志按新级别过滤；有 env 时 env 优先
- [ ] 设置页与帮助菜单能打开日志目录
- [ ] 渲染进程显式日志、全局错误、Error Boundary 出现在主进程日志，且 `name` / child 为 `renderer`
- [ ] Cookie / API Key 不出现在日志文本
- [ ] 无新增 `ipcMain` / `ipcRenderer` / `webContents.send`
- [ ] `vp check`、`vp test`、`pnpm type-check` 通过
