# 桌面端 IPC → tRPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 桌面端主进程与所有渲染窗口的通信改为 tRPC（query/mutation + RxJS 驱动的 subscription），应用代码中不再使用 IPC。

**Architecture:** 在 `app.ready` 前注册特权 `app://` scheme；`protocol.handle` 把 `/trpc` 交给 `fetchRequestHandler`。主进程用 RxJS `BehaviorSubject`/`Subject` 推送事件。渲染端共用 `createTRPCClient`（`httpBatchLink` + `httpSubscriptionLink`），不上 React Query。preload 只暴露 `trpcUrl`。

**Tech Stack:** `@trpc/server` ^11.4.3、`@trpc/client` ^11.4.3、`zod` ^3.25、`rxjs` ^7、现有 Electron 37 + Vite+。

## Global Constraints

- 应用代码禁止 `ipcMain.handle` / `ipcMain.on` / `ipcRenderer.invoke` / `ipcRenderer.send` / `ipcRenderer.on` / `webContents.send` / `sendToAux`
- preload 只暴露 `{ trpcUrl: 'app://localhost/trpc' }`
- 不上 `@trpc/tanstack-react-query`
- 不改音频代理、生产 `loadFile`、Vite 开发 URL
- 不改业务语义，只换通信层
- 命令在仓库根目录：`vp check`、`vp test`、`pnpm type-check`
- commit message 简体中文 Conventional Commits
- 依赖只加在 `apps/desktop/package.json`，用 pnpm
- `AppRouter` 对渲染端必须是 `import type`

---

## File map

**Create:**

- `apps/desktop/src/main/app-protocol.ts`
- `apps/desktop/src/main/trpc/trpc.ts`
- `apps/desktop/src/main/trpc/context.ts`
- `apps/desktop/src/main/trpc/events.ts`
- `apps/desktop/src/main/trpc/events.test.ts`
- `apps/desktop/src/main/trpc/observable.ts`
- `apps/desktop/src/main/trpc/observable.test.ts`
- `apps/desktop/src/main/trpc/router.ts`
- `apps/desktop/src/main/trpc/routers/settings.ts`
- `apps/desktop/src/main/trpc/routers/session.ts`
- `apps/desktop/src/main/trpc/routers/library.ts`
- `apps/desktop/src/main/trpc/routers/player.ts`
- `apps/desktop/src/main/trpc/routers/lyrics.ts`
- `apps/desktop/src/main/trpc/routers/mini.ts`
- `apps/desktop/src/main/trpc/routers/auth.ts`
- `apps/desktop/src/main/trpc/routers/bili.ts`
- `apps/desktop/src/main/trpc/routers/downloads.ts`
- `apps/desktop/src/main/trpc/routers/backup.ts`
- `apps/desktop/src/main/trpc/routers/account.ts`
- `apps/desktop/src/main/trpc/routers/share.ts`
- `apps/desktop/src/main/trpc/routers/desktop.ts`
- `apps/desktop/src/renderer/src/trpc.ts`

**Modify:**

- `apps/desktop/package.json` — 依赖
- `apps/desktop/src/main/index.ts` — 协议、context、删 `registerIpc`
- `apps/desktop/src/main/aux-windows.ts` — 删除 `sendToAux`
- `apps/desktop/src/main/phone-login.ts` — 极验完成改走 tRPC / 内部 Subject
- `apps/desktop/src/preload/index.ts` — 只留 `trpcUrl` 与类型
- `apps/desktop/src/renderer/src/env.d.ts`
- 所有使用 `window.bbplayer` 的渲染文件（见 Task 8）

对照表以 spec 为准：`docs/superpowers/specs/2026-08-21-desktop-trpc-design.md`。

---

### Task 1: 依赖、协议、空 router、RxJS 流

**Files:**

- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/main/app-protocol.ts`
- Create: `apps/desktop/src/main/trpc/trpc.ts`
- Create: `apps/desktop/src/main/trpc/events.ts`
- Create: `apps/desktop/src/main/trpc/events.test.ts`
- Create: `apps/desktop/src/main/trpc/observable.ts`
- Create: `apps/desktop/src/main/trpc/observable.test.ts`
- Create: `apps/desktop/src/main/trpc/context.ts`
- Create: `apps/desktop/src/main/trpc/router.ts`
- Create: `apps/desktop/src/renderer/src/trpc.ts`
- Modify: `apps/desktop/src/main/index.ts`（只加 scheme 注册与 protocol.handle，先保留现有 IPC）
- Modify: `apps/desktop/src/preload/index.ts`（增加 `trpcUrl`，暂留旧 API，避免这一步打断 UI）

**Interfaces:**

- Produces: `registerAppSchemePrivileged()`、`installAppProtocolHandler({ handleTrpc })`、`createDesktopEvents()`、`fromObservable()`、`appRouter`、`createTRPCContext`、`trpcClient`

- [ ] **Step 1: 写 RxJS 流测试**

```ts
import { firstValueFrom, skip } from 'rxjs'
import { test, assert } from 'vitest'

import { createDesktopEvents } from './events.ts'

test('BehaviorSubject 后订阅能拿到当前歌词元数据', async () => {
	const events = createDesktopEvents()
	events.lyricsMeta$.next({
		title: 'a',
		artist: 'b',
		playing: true,
		lyric: '',
		artwork: '',
	})
	const value = await firstValueFrom(events.lyricsMeta$)
	assert.equal(value.title, 'a')
})

test('playerCommands$ 不回放历史命令', async () => {
	const events = createDesktopEvents()
	events.playerCommands$.next('prev')
	let seen = ''
	const sub = events.playerCommands$.subscribe((c) => {
		seen = c
	})
	assert.equal(seen, '')
	events.playerCommands$.next('next')
	assert.equal(seen, 'next')
	sub.unsubscribe()
})

test('退订后不再收到 downloads 更新', () => {
	const events = createDesktopEvents()
	let count = 0
	const sub = events.downloads$.pipe(skip(1)).subscribe(() => {
		count += 1
	})
	sub.unsubscribe()
	events.downloads$.next({ records: [], tasks: {} })
	assert.equal(count, 0)
})
```

`events.ts` 先不存在，跑测试应失败。

- [ ] **Step 2: 跑测试确认失败**

Run: `vp test apps/desktop/src/main/trpc/events.test.ts`  
Expected: FAIL，找不到 `./events.ts`

- [ ] **Step 3: 实现 events + observable 并让测试通过**

`events.ts`：

```ts
import { BehaviorSubject, Subject } from 'rxjs'

export type QrUpdate = {
	status: 'generating' | 'polling' | 'expired' | 'success' | 'error'
	statusText: string
	url?: string
	dataUrl?: string
}

export type PlayerSnapshot = {
	title: string
	artist: string
	playing: boolean
	lyric: string
	artwork: string
}

export type DownloadsUpdate = {
	records: unknown[]
	tasks: Record<string, string>
}

export type ShareIncoming = { shareId?: string; inviteCode?: string }

export function createDesktopEvents() {
	return {
		qr$: new BehaviorSubject<QrUpdate | null>(null),
		shareIncoming$: new Subject<ShareIncoming>(),
		downloads$: new BehaviorSubject<DownloadsUpdate>({
			records: [],
			tasks: {},
		}),
		lyricsMeta$: new BehaviorSubject<PlayerSnapshot>({
			title: '',
			artist: '',
			playing: false,
			lyric: '',
			artwork: '',
		}),
		lyrics$: new BehaviorSubject<unknown>(null),
		playerCommands$: new Subject<string>(),
	}
}

export type DesktopEvents = ReturnType<typeof createDesktopEvents>
```

`observable.ts`：

```ts
import { observable } from '@trpc/server/observable'
import type { Observable } from 'rxjs'

export function fromObservable<T>(source: Observable<T>) {
	return observable<T>((emit) => {
		const sub = source.subscribe({
			next: (value) => emit.next(value),
			error: (err) => emit.error(err),
			complete: () => emit.complete(),
		})
		return () => sub.unsubscribe()
	})
}
```

`observable.test.ts`：订阅 `fromObservable` 包装的 `Subject`，`next` 能收到，unsubscribe 后不再收到。

在 `apps/desktop` 目录：`pnpm add @trpc/server@^11.4.3 @trpc/client@^11.4.3 zod@^3.25.76 rxjs@^7`（从仓库根执行 `pnpm --filter @bbplayer/desktop add ...`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `vp test apps/desktop/src/main/trpc/events.test.ts apps/desktop/src/main/trpc/observable.test.ts`  
Expected: PASS

- [ ] **Step 5: 空 tRPC 栈与协议**

`trpc.ts`：

```ts
import { initTRPC } from '@trpc/server'
import type { TrpcContext } from './context.ts'

const t = initTRPC.context<TrpcContext>().create({
	sse: {
		ping: { enabled: true, intervalMs: 2000 },
		client: { reconnectAfterInactivityMs: 5000 },
	},
})

export const router = t.router
export const publicProcedure = t.procedure
```

`context.ts`：先定义 `TrpcContext = { events: DesktopEvents }`，后续任务往上加 store/db。

`router.ts`：

```ts
import { publicProcedure, router } from './trpc.ts'

export const appRouter = router({
	health: router({
		ping: publicProcedure.query(() => ({ ok: true as const })),
	}),
})

export type AppRouter = typeof appRouter
```

`app-protocol.ts`：按 spec 实现 `APP_SCHEME`、`registerAppSchemePrivileged`、`installAppProtocolHandler`。`handleTrpc` 使用：

```ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
```

在 `index.ts` **文件顶部、任何 `app.whenReady` 之前**调用 `registerAppSchemePrivileged()`。在 `whenReady` 里 `installAppProtocolHandler({ handleTrpc: (req) => fetchRequestHandler({ endpoint: '/trpc', req, router: appRouter, createContext: () => ({ events }) }) })`。本步先 `const events = createDesktopEvents()` 并暂存，后续任务把 `events` 接到现有 `emitQr` 等。

preload 在现有 `api` 上增加 `trpcUrl: 'app://localhost/trpc'`。

`renderer/src/trpc.ts`：

```ts
import type { AppRouter } from '../../main/trpc/router'
import {
	createTRPCClient,
	httpBatchLink,
	httpSubscriptionLink,
	splitLink,
} from '@trpc/client'

export const trpc = createTRPCClient<AppRouter>({
	links: [
		splitLink({
			condition: (op) => op.type === 'subscription',
			true: httpSubscriptionLink({
				url: () => window.bbplayer.trpcUrl,
			}),
			false: httpBatchLink({
				url: () => window.bbplayer.trpcUrl,
			}),
		}),
	],
})
```

必须是 `import type { AppRouter }`。

- [ ] **Step 6: 校验**

Run: `vp check`、`vp test`、`pnpm type-check`  
Expected: 全部通过。若 `import type` 导致 TS 仍解析 electron，给 renderer tsconfig 或 vite 配 `isolatedModules`（已有）即可，不要改成值导入。

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml apps/desktop/src/main/app-protocol.ts apps/desktop/src/main/trpc apps/desktop/src/renderer/src/trpc.ts apps/desktop/src/preload/index.ts apps/desktop/src/main/index.ts
git commit -m "$(cat <<'EOF'
feat(desktop): 接入 app:// tRPC 传输与 RxJS 事件流

EOF
)"
```

---

### Task 2: settings / session / library / desktop 无推送 API

**Files:**

- Create: `routers/settings.ts` `session.ts` `library.ts` `desktop.ts`
- Modify: `context.ts`、`router.ts`、`index.ts`（把对应 `ipcMain.handle` 改成调用同一套函数，或直接删 handle 并改 UI）
- Modify: `App.tsx` 等已用到的 getSettings/setSettings/listPlaylists/openExternal/copyText/checkUpdate/session

**Interfaces:**

- Consumes: `publicProcedure`、`TrpcContext`
- Produces: `settingsRouter`、`sessionRouter`、`libraryRouter`、`desktopRouter` 挂到 `appRouter`

本任务把「无 subscription」的 CRUD 迁完。`index.ts` 里对应 handle 删除；UI 改为 `trpc.settings.get.query()` 等。

- [ ] **Step 1: 写 settings.get 失败测试**

`apps/desktop/src/main/trpc/routers/settings.test.ts`：用内存 store mock 调 `settingsRouter.createCaller({ store, ... })` 的 `get`/`set`。先写 caller 测试，router 不存在则失败。

- [ ] **Step 2: 跑测试确认失败**

Run: `vp test apps/desktop/src/main/trpc/routers/settings.test.ts`  
Expected: FAIL

- [ ] **Step 3: 实现四个 router，逻辑从 `index.ts` 的 handle 原样搬迁**

`desktop.openExternal` 用 Zod `z.string().url()`，仅允许 `http:`/`https:`。

`context.ts` 扩展为包含 `store`、`playerDb`、以及 `refreshAccount` / `applyAuxSettings` 等 settings.set 需要的函数（从 index 传入，不要在 router 里 import BrowserWindow 单例）。

`index.ts`：`whenReady` 里组装完整 context；删除已迁移的 `ipcMain.handle`。

渲染：`window.bbplayer.getSettings()` → `trpc.settings.get.query()`，对照 spec 表。本任务覆盖：

- settings.get/set
- session.get/set
- library.*
- desktop.openExternal / copyText / checkUpdate

- [ ] **Step 4: 跑测试**

Run: `vp test`、`vp check`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(desktop): 设置、歌单与系统 API 改走 tRPC

EOF
)"
```

---

### Task 3: player / lyrics / mini 与跨窗推送

**Files:**

- Create: `routers/player.ts` `lyrics.ts` `mini.ts`
- Modify: `index.ts`（`emit` 改为 `events.*.next`；删 `sendCommand` 的 `webContents.send`）
- Modify: `aux-windows.ts` 删除 `sendToAux`
- Modify: `usePlayback.ts`、`App.tsx`、`LyricsApp.tsx`、`MiniApp.tsx`

**Interfaces:**

- Consumes: `DesktopEvents`、`fromObservable`
- Produces: `player.commands` / `lyrics.updates` / `lyrics.meta` subscriptions

- [ ] **Step 1: 写 player.sendCommand 测试**

调用 `createCaller` 的 `sendCommand`，断言 `playerCommands$` 收到 `'playpause'`。

- [ ] **Step 2: 跑测试确认失败**

Expected: FAIL

- [ ] **Step 3: 实现**

- `player.reportState`：现有去重逻辑，然后 `events.lyricsMeta$.next(snapshot)`，`refreshShell()`
- `lyrics.push`：`events.lyrics$.next(payload)`
- `player.sendCommand`：`events.playerCommands$.next(command)`；托盘/快捷键同样 `next`，禁止 `webContents.send`
- subscriptions 用 `fromObservable(events.xxx$)`；`qr$`/`downloads$`/`lyrics$`/`lyricsMeta$` 用 BehaviorSubject 保证后打开的歌词窗能拿到当前值
- `player.commands` 用 Subject，不回放
- 删 `sendToAux`
- 渲染：`onCommand` → `trpc.player.commands.subscribe`；`onLyricsUpdate` → `trpc.lyrics.updates.subscribe`；`onLyricsMeta` → `trpc.lyrics.meta.subscribe`

- [ ] **Step 4: 跑 `vp test` `vp check`**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(desktop): 播放控制与歌词窗改为 tRPC 订阅

EOF
)"
```

---

### Task 4: auth、极验、bili

**Files:**

- Create: `routers/auth.ts` `routers/bili.ts`
- Modify: `index.ts` `phone-login.ts`
- Modify: `App.tsx` `PhoneLogin.tsx` `CommentsPanel.tsx` `SkinPicker.tsx`

- [ ] **Step 1: 写 auth.completeGeetest 与 qr$ 测试**

`completeGeetest` 向内部 `Subject` 推 payload（phone-login 的 wait 改订阅该 Subject，不再 `ipcMain.on('geetest:done')`）。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

- `emitQr` 改为 `events.qr$.next(payload)`
- 删除全部 `auth:*`、`bili:*`、`skin:cover`、`geetest:done` IPC
- 极验 HTML 内改为 `fetch` `app://localhost/trpc/auth.completeGeetest`（tRPC 11 单次 mutation：`POST`，body 为 JSON input）。若格式与 batch 不一致，在 `phone-login.ts` 旁加极小 helper，单测其 URL/body，不要用 IPC 垫片
- `auth.qrUpdates`：`fromObservable(events.qr$)`，过滤 `null` 或让 UI 忽略 null

- [ ] **Step 4: `vp test` `vp check`**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(desktop): 登录与 B 站 API 改走 tRPC

EOF
)"
```

---

### Task 5: downloads、backup、account、share

**Files:**

- Create: `routers/downloads.ts` `backup.ts` `account.ts` `share.ts`
- Modify: `index.ts`（`downloadManager.onChange` 改为 `events.downloads$.next`；`emitShareLink` 改为 `shareIncoming$.next`）
- Modify: `App.tsx` `BbplayerAccount.tsx`

- [ ] **Step 1: 写 downloads.updates 测试**

`onChange` 触发后，caller 订阅（或直接读 `downloads$`）能拿到 records。

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现并删对应 IPC**

`share.incoming` 用 `fromObservable(events.shareIncoming$)`。冷启动仍保留 `share.pending` query + `pendingShareUrl`。

- [ ] **Step 4: `vp test` `vp check`**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(desktop): 下载、账号与共享歌单改走 tRPC

EOF
)"
```

---

### Task 6: 拆除剩余 IPC 与 preload 业务 API

**Files:**

- Modify: `preload/index.ts`（只留 trpcUrl）
- Modify: `env.d.ts`
- Modify: `index.ts`（确认无 `ipcMain`、`webContents.send`）
- Modify: `aux-windows.ts`、`phone-login.ts`
- Grep 全 `apps/desktop`

- [ ] **Step 1: 写失败门禁测试或 grep 脚本**

在 `apps/desktop/src/main/trpc/no-ipc.test.ts`：读取 `src` 下 ts/tsx（排除本测试），断言不匹配 `\bipcMain\b`、`\bipcRenderer\b`、`webContents\.send`、`sendToAux`。preload 允许 `contextBridge` 与读取 `trpcUrl` 常量，不允许 `ipcRenderer`。

先跑：若仍有 IPC，测试失败（这是门禁，失败则修代码而不是放宽正则）。

- [ ] **Step 2: 跑测试**

Expected: 若还有 IPC 则 FAIL

- [ ] **Step 3: 删光剩余 IPC**

preload：

```ts
import { contextBridge } from 'electron'

const bbplayer = {
	trpcUrl: 'app://localhost/trpc',
}

contextBridge.exposeInMainWorld('bbplayer', bbplayer)

export type DesktopApi = typeof bbplayer
```

`env.d.ts` 的 `Window.bbplayer` 与 `DesktopApi` 对齐。

`index.ts` 删除 `registerIpc`、删除 `ipcMain` import。`phone-login.ts` 删除 `ipcMain`。

渲染文件不得再出现 `window.bbplayer.` 除 `trpcUrl` 外的属性。

- [ ] **Step 4: 跑门禁测试 + `vp check` + `vp test` + `pnpm type-check`**

Expected: 全部 PASS；grep `ipcRenderer`/`ipcMain` 在 `apps/desktop/src` 为零（preload 也零）。

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(desktop): 移除 IPC 与 preload 业务桥

EOF
)"
```

---

## 验收

- `vp check`、`vp test`、`pnpm type-check` 通过
- 手动：`pnpm desktop` — 搜索播放、歌词窗/迷你窗控制、二维码登录、下载进度、共享链接、极验（若可测）
- `apps/desktop/src` 无 `ipcMain` / `ipcRenderer` / `webContents.send`
