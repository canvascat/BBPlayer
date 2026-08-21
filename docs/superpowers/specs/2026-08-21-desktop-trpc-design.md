# 桌面端 IPC → tRPC 设计

日期：2026-08-21  
范围：`apps/desktop` 主进程与渲染进程通信

## 目标

去掉应用代码里所有 `ipcMain` / `ipcRenderer` 调用。主进程与主窗口、歌词窗、迷你窗、极验窗之间的请求、响应和推送全部走 tRPC。音频代理、Vite 开发服务器、`loadFile` 生产加载方式保持不变。

成功标准：

- `apps/desktop` 中不再出现 `ipcMain.handle`、`ipcMain.on`、`ipcRenderer.invoke`、`ipcRenderer.send`、`ipcRenderer.on`、`webContents.send`（含 `sendToAux`）
- preload 只暴露 `{ trpcUrl: 'app://localhost/trpc' }`
- 渲染端用原生 `trpcClient`（不上 React Query）
- 现有 `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 不上 `@trpc/tanstack-react-query` / `useQuery`
- 不把生产静态资源迁到 `app://`（生产仍 `loadFile`）
- 不替换 `audio-proxy` 的本机 HTTP
- 不把 `index.ts` 里的业务逻辑改语义，只换通信层并按域拆文件

## 传输

参考 [motrix](https://github.com/canvascat/motrix) 的 `app://` + `fetchRequestHandler`。

1. `app.ready` 之前调用 `protocol.registerSchemesAsPrivileged`，scheme 为 `app`，特权：`standard`、`secure`、`supportFetchAPI`、`corsEnabled`、`stream`（SSE 订阅需要）。
2. `app.ready` 之后 `protocol.handle('app', ...)`：路径 `/trpc` 或 `/trpc/*` 交给 `fetchRequestHandler({ endpoint: '/trpc', router, createContext })`；其它路径返回 404。不在此协议下提供静态文件。
3. 开发：窗口仍加载 `VITE_DEV_SERVER_URL`；生产仍 `loadFile`。渲染进程 `fetch('app://localhost/trpc')`。
4. 不新开 tRPC HTTP 端口，不用 Electron IPC link。

preload：

```ts
contextBridge.exposeInMainWorld('bbplayer', {
	trpcUrl: 'app://localhost/trpc',
})
```

`window.bbplayer` 不再暴露业务方法。

## 客户端

`apps/desktop/src/renderer/src/trpc.ts`：

- `createTRPCClient<AppRouter>`
- `splitLink`：subscription → `httpSubscriptionLink`，其它 → `httpBatchLink`
- URL 来自 `window.bbplayer.trpcUrl`
- 主窗口、歌词窗、迷你窗共用这一份 client
- 调用形态：`trpc.settings.get.query()`、`trpc.player.sendCommand.mutate({ command })`、`trpc.auth.qrUpdates.subscribe({ onData })`

`AppRouter` 用 `import type` 从主进程 router 文件引入，避免把 Electron/Node 打进渲染包。

极验窗没有完整 client：注入脚本对 `auth.completeGeetest` 发一次 POST（tRPC HTTP 单 procedure 格式），不经过 `window.bbplayer.completeGeetest`。

## 主进程结构

```
apps/desktop/src/main/
  app-protocol.ts          # 特权 scheme + protocol.handle
  trpc/
    trpc.ts                # initTRPC、SSE ping、publicProcedure
    context.ts             # Store / DB / 窗口辅助 / streams
    events.ts              # RxJS Subject / BehaviorSubject
    observable.ts          # Observable → tRPC subscription
    router.ts              # appRouter 汇总
    routers/
      settings.ts
      session.ts
      library.ts
      player.ts
      lyrics.ts
      mini.ts
      auth.ts
      bili.ts
      downloads.ts
      backup.ts
      account.ts
      share.ts
      desktop.ts
  index.ts                 # 窗口 / 托盘 / 协议注册，无 ipcMain
```

`createContext` 注入：`store`、`playerDb`、`downloadManager`、打开/查询辅助窗的函数、cookie/settings 读取、以及 `events` 上的流。procedure 不直接抓全局 `BrowserWindow`，通过 context 调用。

输入用 Zod。错误用 `TRPCError`；需要给用户看的中文 `message` 保持现有文案（例如「登录状态失效，请重新登录」）。

## 事件：RxJS

不用裸 `EventEmitter`。主进程用 RxJS：

| 流 | 类型 | 用途 |
|---|---|---|
| `qr$` | `BehaviorSubject<QrUpdate \| null>` | 二维码；后订阅能拿到当前状态 |
| `shareIncoming$` | `Subject<ShareIncoming>` | 深链；冷启动仍用已有 `pendingShareUrl` + `share.pending` query |
| `downloads$` | `BehaviorSubject<{ records; tasks }>` | 缓存列表/进度；订阅立刻推当前值 |
| `lyricsMeta$` | `BehaviorSubject<PlayerSnapshot>` | 迷你窗/歌词窗元数据 |
| `lyrics$` | `BehaviorSubject<unknown>` | 歌词推送 |
| `playerCommands$` | `Subject<string>` | 播放控制；不回放历史命令 |

订阅 procedure 把 Observable 转成 tRPC `observable()`（`@trpc/server/observable`）。退订时 `unsubscribe`，窗口关闭靠 `AbortSignal` / tRPC 取消。

原先 `webContents.send` / `sendToAux` 全部改为 `next()` 到对应流。辅助窗自己订阅 `lyrics.updates` / `lyrics.meta`，主进程不再向指定 `webContents` 推 IPC。

托盘、全局快捷键、歌词窗的「上一首/播放/下一首」调用 `playerCommands$.next(command)`（或走 `player.sendCommand` mutation，内部同样 `next`）。主窗口订阅 `player.commands`。

`player.reportState` mutation：去重后更新 snapshot、`lyricsMeta$.next`、刷新托盘。不再 `sendToAux('lyrics:meta')`。

`lyrics.push` mutation：保存 `lastLyrics`、`lyrics$.next`。

## Procedure 对照

现有 IPC 全部映射，名称用 camelCase，不再使用 `namespace:action` 字符串。

### settings

| 旧 IPC | tRPC |
|---|---|
| `settings:get` | `settings.get` query |
| `settings:set` | `settings.set` mutation |

### session

| 旧 IPC | tRPC |
|---|---|
| `session:get` | `session.get` query |
| `session:set` | `session.set` mutation |

### library

| 旧 IPC | tRPC |
|---|---|
| `library:list` | `library.list` query |
| `library:get` | `library.get` query |
| `library:create` | `library.create` mutation |
| `library:rename` | `library.rename` mutation |
| `library:delete` | `library.delete` mutation |
| `library:addTracks` | `library.addTracks` mutation |
| `library:removeTrack` | `library.removeTrack` mutation |

### player

| 旧 IPC | tRPC |
|---|---|
| `player:resolve` | `player.resolve` mutation |
| `player:snapshot` | `player.snapshot` query |
| `player:state` (send) | `player.reportState` mutation |
| `player:command-from-ui` (send) | `player.sendCommand` mutation |
| `player:command` (on) | `player.commands` subscription |
| `search:match` | `player.matchSearch` query |

### lyrics / mini

| 旧 IPC | tRPC |
|---|---|
| `lyrics:push` (send) | `lyrics.push` mutation |
| `lyrics:current` | `lyrics.current` query |
| `lyrics:toggle` | `lyrics.toggle` mutation |
| `lyrics:visible` | `lyrics.visible` query |
| `lyrics:update` (on) | `lyrics.updates` subscription |
| `lyrics:meta` (on) | `lyrics.meta` subscription |
| `mini:toggle` | `mini.toggle` mutation |
| `mini:visible` | `mini.visible` query |

### auth

| 旧 IPC | tRPC |
|---|---|
| `auth:me` | `auth.me` query |
| `auth:refresh` | `auth.refresh` mutation |
| `auth:logout` | `auth.logout` mutation |
| `auth:qrStart` | `auth.qrStart` mutation |
| `auth:qrCancel` | `auth.qrCancel` mutation |
| `auth:qr` (on) | `auth.qrUpdates` subscription |
| `auth:phoneStart` | `auth.phoneStart` mutation |
| `auth:phoneLogin` | `auth.phoneLogin` mutation |
| `geetest:done` (send) | `auth.completeGeetest` mutation |

### bili

| 旧 IPC | tRPC |
|---|---|
| `bili:library` | `bili.library` query |
| `bili:favorite` | `bili.favorite` query |
| `bili:collection` | `bili.collection` query |
| `bili:toview` | `bili.watchLater` query |
| `bili:uploader` | `bili.uploader` query |
| `bili:search` | `bili.search` query |
| `bili:video` | `bili.video` query |
| `bili:comments` | `bili.comments` query |
| `bili:commentReplies` | `bili.commentReplies` query |
| `bili:commentLike` | `bili.commentLike` mutation |
| `bili:garbSearch` | `bili.garbSearch` query |
| `skin:cover` | `bili.skinCover` query |

### downloads / backup

| 旧 IPC | tRPC |
|---|---|
| `downloads:list` | `downloads.list` query |
| `downloads:status` | `downloads.status` query |
| `downloads:start` | `downloads.start` mutation |
| `downloads:remove` | `downloads.remove` mutation |
| `downloads:export` | `downloads.export` mutation |
| `downloads:update` (on) | `downloads.updates` subscription |
| `backup:export` | `backup.export` mutation |
| `backup:import` | `backup.import` mutation |

### account（原 `bbplayer:*`）

| 旧 IPC | tRPC |
|---|---|
| `bbplayer:login` | `account.login` mutation |
| `bbplayer:register` | `account.register` mutation |
| `bbplayer:logout` | `account.logout` mutation |
| `bbplayer:updateProfile` | `account.updateProfile` mutation |
| `bbplayer:fillFromBili` | `account.fillFromBili` mutation |
| `bbplayer:refresh` | `account.refresh` mutation |
| `bbplayer:restore` | `account.restore` mutation |

### share

| 旧 IPC | tRPC |
|---|---|
| `share:preview` | `share.preview` query |
| `share:pending` | `share.pending` query |
| `share:enable` | `share.enable` mutation |
| `share:subscribe` | `share.subscribe` mutation |
| `share:pull` | `share.pull` mutation |
| `share:copyLink` | `share.copyLink` mutation |
| `share:rotateInvite` | `share.rotateInvite` mutation |
| `share:incoming` (on) | `share.incoming` subscription |

### desktop

| 旧 IPC | tRPC |
|---|---|
| `shell:open` | `desktop.openExternal` mutation |
| `clipboard:write` | `desktop.copyText` mutation |
| `updater:check` | `desktop.checkUpdate` mutation |

`desktop.openExternal` 只允许 `http:` / `https:`（与 motrix 一致）。

## 渲染端替换

`App.tsx`、`usePlayback.ts`、`LyricsApp.tsx`、`MiniApp.tsx`、`CommentsPanel.tsx`、`SkinPicker.tsx`、`PhoneLogin.tsx`、`BbplayerAccount.tsx` 中所有 `window.bbplayer.*` 改为对应 `trpc.*`。

订阅在 `useEffect` 里 `subscribe`，cleanup `unsubscribe`。`env.d.ts` 的 `Window.bbplayer` 缩成只含 `trpcUrl`。

## 错误处理

- Zod 失败 → `BAD_REQUEST`
- 业务 `throw new Error('中文')` 可继续用，client 读 `error.message`
- 未登录/失效 → `UNAUTHORIZED` 或现有 `-101` 文案
- 订阅错误不打爆整个 client；单路 `onError` 即可

## 测试

- `events.test.ts`：`BehaviorSubject` 后订阅能拿到当前值；`Subject` 不回放；退订后不再收到
- `observable.test.ts`：包装后 next/unsubscribe 行为
- 薄 procedure 测试：`settings.get/set`、`player.sendCommand`（mock store / mock subject）
- 渲染测试里把 `window.bbplayer` mock 改成 `trpc` mock 或直接 mock `@/trpc`
- 不测 `protocol.handle` 本身

## 依赖

加在 `@bbplayer/desktop`：

- `@trpc/server` ^11.4.3
- `@trpc/client` ^11.4.3
- `zod` ^3.25（或与仓库其它包对齐的 3.x）
- `rxjs` ^7

不加 React Query。`typescript` 仍用根目录版本。

## 迁移顺序

一次功能换完，按提交拆：

1. 依赖、协议、空 router、client、RxJS 流与测试
2. 按域迁移 procedure + 对应 UI（settings/session → library → player/lyrics/mini → auth → bili → downloads/backup → account/share → desktop）
3. 删剩余 IPC 与 `sendToAux`，preload 只留 `trpcUrl`
4. `vp check`、`vp test`、`pnpm type-check`

## 风险

- 开发时从 `http://127.0.0.1:5173` fetch `app://`：依赖特权 scheme 的 `corsEnabled` + `supportFetchAPI`。若失败，再查 CSP / `webSecurity`，不改回 IPC。
- SSE 在自定义协议上必须 `stream: true`。
- 类型：`import type { AppRouter }` 不得变成值导入。
- 极验 `fetch` 必须与 tRPC HTTP 单次调用格式一致（`POST /trpc/auth.completeGeetest`）。
