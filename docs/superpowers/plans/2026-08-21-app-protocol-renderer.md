# app:// 静态资源与开发转发 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 主窗口、歌词窗、迷你窗始终以 `app://localhost` 为文档 origin；开发时把非 `/trpc` 请求转发到 Vite，生产时从 `dist` 读文件。

**Architecture:** 把路径分流做成可单测纯函数。`protocol.handle('app')`：`/trpc` 仍走 tRPC；开发用注入的 `fetch` 拉 Vite；生产把路径安全映射到 `RENDERER_DIST` 再 `net.fetch(file URL)`。窗口 `loadURL(rendererUrl(page))`。Vite `server.hmr` 固定 `ws` + `127.0.0.1`，WebSocket 不走自定义协议。

**Tech Stack:** Electron 37 `protocol.handle` / `net.fetch`、Vite+ `vp test` / `vp check`、现有 `vite-plugin-electron` 提供的 `VITE_DEV_SERVER_URL`。

## Global Constraints

- 三个窗口只加载 `app://localhost/...`，开发不再 `loadURL(VITE_DEV_SERVER_URL)`，生产不再 `loadFile` 渲染页
- 不把 `audio-proxy` 迁到 `app://`
- 不代理 B 站封面图
- 不改极验窗的 `loadFile`
- 不收紧或重写整份 CSP；现有 `connect-src` 已含 `'self' http://127.0.0.1:* ws: wss:`，文档 origin 改为 `app://localhost` 后 `'self'` 覆盖 tRPC
- 静态路径只允许 GET/HEAD，其它方法 405；`/trpc` 方法由 tRPC 决定
- 开发转发失败 502；穿越或缺文件 404；禁止把 `app://` 的 `Host` 带给 Vite
- `app-protocol.ts` 顶层不要 `import from 'electron'`，否则 Vitest 会加载到 Electron 二进制而不是 API
- 命令在仓库根目录：`vp check`、`vp test`、`pnpm type-check`
- commit message 简体中文 Conventional Commits
- 对照 spec：`docs/superpowers/specs/2026-08-21-app-protocol-renderer-design.md`

---

## File map

**Create:**

- `apps/desktop/src/main/app-protocol.test.ts` — 分流、窗口 URL、Host 剥离、handler 转发/404/502

**Modify:**

- `apps/desktop/src/main/app-protocol.ts` — 纯函数 + `installAppProtocolHandler` 接转发/读文件
- `apps/desktop/src/main/index.ts` — `loadRenderer` 恒 `rendererUrl`；安装协议时传入 `rendererDist` 与 `VITE_DEV_SERVER_URL`
- `apps/desktop/vite.config.ts` — `server.hmr = { protocol: 'ws', host: '127.0.0.1' }`

**不改：** `audio-proxy.ts`、`bili-image.ts`、`phone-login.ts`、preload `trpcUrl`、三份 HTML CSP（现有已够用）。

---

### Task 1: app:// 路径分流纯函数

**Files:**

- Create: `apps/desktop/src/main/app-protocol.test.ts`
- Modify: `apps/desktop/src/main/app-protocol.ts`

**Interfaces:**

- Consumes: 无
- Produces:
  - `APP_SCHEME: 'app'`
  - `APP_ORIGIN: 'app://localhost'`
  - `rendererUrl(page: 'index.html' | 'lyrics.html' | 'mini.html'): string`
  - `headersWithoutHost(headers: Headers): Headers`
  - `resolveRendererFile(pathname: string, rendererDist: string): string | null`
  - `resolveAppRequest(requestUrl: string, method: string, env: { viteDevServerUrl?: string; rendererDist: string }): { type: 'trpc' } | { type: 'forward'; url: string } | { type: 'file'; absPath: string } | { type: 'error'; status: 404 | 405 }`
  - `registerAppSchemePrivileged()` / `installAppProtocolHandler` 本任务只改 electron 加载方式，行为仍是：`/trpc` 进 tRPC，其它 404

- [ ] **Step 1: Write the failing test**

创建 `apps/desktop/src/main/app-protocol.test.ts`：

```ts
import assert from 'node:assert/strict'
import { resolve } from 'node:path'

import { test } from 'vitest'

import {
	headersWithoutHost,
	rendererUrl,
	resolveAppRequest,
	resolveRendererFile,
} from './app-protocol.ts'

const dist = resolve('/tmp/bbplayer-renderer-dist')
const vite = 'http://127.0.0.1:5173/'

test('三个窗口 URL 都在 app://localhost', () => {
	assert.equal(rendererUrl('index.html'), 'app://localhost/')
	assert.equal(rendererUrl('lyrics.html'), 'app://localhost/lyrics.html')
	assert.equal(rendererUrl('mini.html'), 'app://localhost/mini.html')
})

test('去掉 Host，保留其它头', () => {
	const next = headersWithoutHost(
		new Headers({ Host: 'localhost', Accept: 'text/html' }),
	)
	assert.equal(next.has('host'), false)
	assert.equal(next.get('accept'), 'text/html')
})

test('/trpc 与 /trpc/* 走 tRPC，含 POST', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/trpc', 'POST', { rendererDist: dist }),
		{ type: 'trpc' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/trpc/settings.get?batch=1', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'trpc' },
	)
})

test('开发转发 pathname 与 search 到 Vite，不进文件', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'forward', url: 'http://127.0.0.1:5173/' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/lyrics.html', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'forward', url: 'http://127.0.0.1:5173/lyrics.html' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/@vite/client?v=1', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'forward', url: 'http://127.0.0.1:5173/@vite/client?v=1' },
	)
})

test('开发非 GET/HEAD 的静态路径 405', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/src/main.tsx', 'POST', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'error', status: 405 },
	)
})

test('生产 / 映射 dist/index.html，其它路径落在 dist 内', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/', 'GET', { rendererDist: dist }),
		{
			type: 'file',
			absPath: resolve(dist, 'index.html'),
		},
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/mini.html', 'GET', {
			rendererDist: dist,
		}),
		{ type: 'file', absPath: resolve(dist, 'mini.html') },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/assets/x.js', 'HEAD', {
			rendererDist: dist,
		}),
		{ type: 'file', absPath: resolve(dist, 'assets/x.js') },
	)
})

test('URL 里的 .. 被规范化后仍不能用绝对路径逃出 dist', () => {
	const route = resolveAppRequest(
		'app://localhost/%2e%2e/%2e%2e/etc/passwd',
		'GET',
		{
			rendererDist: dist,
		},
	)
	assert.equal(route.type, 'file')
	if (route.type !== 'file') throw new Error('expected file')
	assert.equal(route.absPath.startsWith(dist), true)
	assert.equal(route.absPath.includes('..'), false)
})

test('未规范化的 .. 与 %2e%2e 被 resolveRendererFile 拒绝', () => {
	assert.equal(resolveRendererFile('/../secret', dist), null)
	assert.equal(resolveRendererFile('/%2e%2e/secret', dist), null)
	assert.equal(resolveRendererFile('/assets/../../secret', dist), null)
})

test('非法 percent-encoding 返回 404', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/%E0%A4%A', 'GET', {
			rendererDist: dist,
		}),
		{ type: 'error', status: 404 },
	)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test apps/desktop/src/main/app-protocol.test.ts
```

Expected: FAIL，`app-protocol.ts` 没有 `resolveAppRequest` / `rendererUrl` 等导出。

- [ ] **Step 3: Write minimal implementation**

重写 `apps/desktop/src/main/app-protocol.ts`（保留现有 `installAppProtocolHandler` 的 tRPC/404 行为，但用 `createRequire` 加载 electron）：

```ts
import { createRequire } from 'node:module'
import { isAbsolute, relative, resolve } from 'node:path'

const electronRequire = createRequire(import.meta.url)

function electron() {
	return electronRequire('electron') as typeof import('electron')
}

export const APP_SCHEME = 'app'
export const APP_ORIGIN = 'app://localhost'

export type RendererPage = 'index.html' | 'lyrics.html' | 'mini.html'

export function rendererUrl(page: RendererPage) {
	return page === 'index.html' ? `${APP_ORIGIN}/` : `${APP_ORIGIN}/${page}`
}

export function headersWithoutHost(headers: Headers) {
	const next = new Headers(headers)
	next.delete('host')
	return next
}

export type AppRequestEnv = {
	viteDevServerUrl?: string
	rendererDist: string
}

export type AppRequestRoute =
	| { type: 'trpc' }
	| { type: 'forward'; url: string }
	| { type: 'file'; absPath: string }
	| { type: 'error'; status: 404 | 405 }

export function resolveRendererFile(pathname: string, rendererDist: string) {
	let decoded: string
	try {
		decoded = decodeURIComponent(pathname)
	} catch {
		return null
	}
	const relativePath =
		decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
	if (!relativePath || relativePath.endsWith('/')) return null
	const root = resolve(rendererDist)
	const abs = resolve(root, relativePath)
	const rel = relative(root, abs)
	if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
	return abs
}

export function resolveAppRequest(
	requestUrl: string,
	method: string,
	env: AppRequestEnv,
): AppRequestRoute {
	let url: URL
	try {
		url = new URL(requestUrl)
	} catch {
		return { type: 'error', status: 404 }
	}
	if (url.pathname === '/trpc' || url.pathname.startsWith('/trpc/')) {
		return { type: 'trpc' }
	}
	const upper = method.toUpperCase()
	if (upper !== 'GET' && upper !== 'HEAD') {
		return { type: 'error', status: 405 }
	}
	if (env.viteDevServerUrl) {
		return {
			type: 'forward',
			url: new URL(url.pathname + url.search, env.viteDevServerUrl).href,
		}
	}
	const absPath = resolveRendererFile(url.pathname, env.rendererDist)
	if (!absPath) return { type: 'error', status: 404 }
	return { type: 'file', absPath }
}

export function registerAppSchemePrivileged() {
	electron().protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
			},
		},
	])
}

export function installAppProtocolHandler({
	handleTrpc,
}: {
	handleTrpc: (request: Request) => Response | Promise<Response>
}) {
	electron().protocol.handle(APP_SCHEME, (request) => {
		const { pathname } = new URL(request.url)
		if (pathname === '/trpc' || pathname.startsWith('/trpc/')) {
			return handleTrpc(request)
		}
		return new Response(null, { status: 404 })
	})
}
```

说明：`new URL('app://localhost/%2e%2e/..')` 会把路径折回站点根（例如 `/etc/passwd`），再 `resolve(dist, 'etc/passwd')` 仍在 dist 内。真正逃逸靠 `resolveRendererFile` 拒绝含 `..` 的未规范化 pathname；`replace(/^\/+/, '')` 避免 `path.join(dist, '/etc/passwd')` 落到系统根。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
vp test apps/desktop/src/main/app-protocol.test.ts
```

Expected: PASS。若 `/%E0%A4%A` 被 `new URL` 直接抛错，应得到 `{ type: 'error', status: 404 }`（catch 分支）；若 URL 构造成功但 `decodeURIComponent` 失败，同样 404。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/app-protocol.ts apps/desktop/src/main/app-protocol.test.ts
git commit -m "$(cat <<'EOF'
feat(desktop): 抽出 app:// 路径分流与窗口 URL

先把可单测的解析从 Electron 协议回调里拆开，避免 Vitest 加载 electron 二进制。
EOF
)"
```

---

### Task 2: protocol.handle 开发转发与生产读文件

**Files:**

- Modify: `apps/desktop/src/main/app-protocol.ts`
- Modify: `apps/desktop/src/main/app-protocol.test.ts`

**Interfaces:**

- Consumes: Task 1 的 `resolveAppRequest`、`headersWithoutHost`、`APP_SCHEME`
- Produces: `installAppProtocolHandler({ handleTrpc, rendererDist, viteDevServerUrl?, handle?, fetch?, isFile? })`。未注入时用 `electron().protocol.handle` 与 `electron().net.fetch`。`fetch` 签名为 `(input: string, init?: RequestInit & { bypassCustomProtocolHandlers?: boolean }) => Promise<Response>`。`isFile(absPath)` 为真才读文件。

- [ ] **Step 1: Write the failing test**

在 `apps/desktop/src/main/app-protocol.test.ts` 增加（保留 Task 1 的 import 与测试）：

```ts
import { pathToFileURL } from 'node:url'

import { installAppProtocolHandler } from './app-protocol.ts'

async function dispatch(
	options: Parameters<typeof installAppProtocolHandler>[0],
	request: Request,
) {
	let listener: ((request: Request) => Response | Promise<Response>) | undefined
	installAppProtocolHandler({
		...options,
		handle: (_scheme, next) => {
			listener = next
		},
	})
	if (!listener) throw new Error('missing listener')
	return listener(request)
}

test('开发转发 fetch 目标为 Vite，且不含 Host', async () => {
	const calls: { url: string; init?: RequestInit }[] = []
	const res = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			viteDevServerUrl: vite,
			fetch: async (url, init) => {
				calls.push({ url, init })
				return new Response('vite')
			},
		},
		new Request('app://localhost/@vite/client?v=1', {
			headers: { Host: 'localhost', Accept: '*/*' },
		}),
	)
	assert.equal(await res.text(), 'vite')
	assert.equal(calls.length, 1)
	assert.equal(calls[0]?.url, 'http://127.0.0.1:5173/@vite/client?v=1')
	const headers = new Headers(calls[0]?.init?.headers)
	assert.equal(headers.has('host'), false)
	assert.equal(headers.get('accept'), '*/*')
	assert.equal(
		(calls[0]?.init as { bypassCustomProtocolHandlers?: boolean })
			?.bypassCustomProtocolHandlers,
		true,
	)
})

test('开发转发失败返回 502', async () => {
	const res = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			viteDevServerUrl: vite,
			fetch: async () => {
				throw new Error('vite down')
			},
		},
		new Request('app://localhost/'),
	)
	assert.equal(res.status, 502)
})

test('生产存在的文件走 file URL，缺失 404', async () => {
	const index = resolve(dist, 'index.html')
	const fetched: string[] = []
	const ok = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			isFile: (absPath) => absPath === index,
			fetch: async (url) => {
				fetched.push(url)
				return new Response('html')
			},
		},
		new Request('app://localhost/'),
	)
	assert.equal(await ok.text(), 'html')
	assert.deepEqual(fetched, [pathToFileURL(index).href])

	const missing = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			isFile: () => false,
			fetch: async () => new Response('nope'),
		},
		new Request('app://localhost/missing.js'),
	)
	assert.equal(missing.status, 404)
})

test('POST /trpc 仍进 handleTrpc', async () => {
	const res = await dispatch(
		{
			handleTrpc: async () => new Response('trpc-ok'),
			rendererDist: dist,
			viteDevServerUrl: vite,
			fetch: async () => new Response('should-not-forward'),
		},
		new Request('app://localhost/trpc/auth.qrStart?batch=1', {
			method: 'POST',
		}),
	)
	assert.equal(await res.text(), 'trpc-ok')
})
```

`installAppProtocolHandler` 此时还没有 `rendererDist` / `fetch` / `handle` 参数，这些测试会编译失败或运行失败。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
vp test apps/desktop/src/main/app-protocol.test.ts
```

Expected: FAIL（类型/参数不匹配，或 handler 仍对静态路径 404）。

- [ ] **Step 3: Write minimal implementation**

把 `installAppProtocolHandler` 换成（文件其余部分保持 Task 1）：

```ts
import { existsSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export type AppAssetFetch = (
	input: string,
	init?: RequestInit & { bypassCustomProtocolHandlers?: boolean },
) => Promise<Response>

export function installAppProtocolHandler({
	handleTrpc,
	rendererDist,
	viteDevServerUrl,
	handle: handleScheme = (scheme, listener) =>
		electron().protocol.handle(scheme, listener),
	fetch: fetchAsset = (input, init) => electron().net.fetch(input, init),
	isFile = (absPath) => existsSync(absPath) && statSync(absPath).isFile(),
}: {
	handleTrpc: (request: Request) => Response | Promise<Response>
	rendererDist: string
	viteDevServerUrl?: string
	handle?: (
		scheme: string,
		listener: (request: Request) => Response | Promise<Response>,
	) => void
	fetch?: AppAssetFetch
	isFile?: (absPath: string) => boolean
}) {
	handleScheme(APP_SCHEME, async (request) => {
		const route = resolveAppRequest(request.url, request.method, {
			rendererDist,
			viteDevServerUrl,
		})
		switch (route.type) {
			case 'trpc':
				return handleTrpc(request)
			case 'error':
				return new Response(null, { status: route.status })
			case 'forward':
				try {
					return await fetchAsset(route.url, {
						method: request.method,
						headers: headersWithoutHost(request.headers),
						bypassCustomProtocolHandlers: true,
					})
				} catch {
					return new Response(null, { status: 502 })
				}
			case 'file':
				if (!isFile(route.absPath)) {
					return new Response(null, { status: 404 })
				}
				return fetchAsset(pathToFileURL(route.absPath).href)
		}
	})
}
```

同一 Step 改 `apps/desktop/src/main/index.ts` 里 `installAppProtocolHandler({` 的实参：在现有 `handleTrpc` 旁边加上两行，不要改 `handleTrpc` 函数体、不要改 `loadRenderer`：

```ts
		rendererDist: RENDERER_DIST,
		viteDevServerUrl: process.env.VITE_DEV_SERVER_URL,
```

插入位置：`installAppProtocolHandler({` 之后、`handleTrpc:` 之前。`RENDERER_DIST` 已在 `index.ts` 定义。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
vp test apps/desktop/src/main/app-protocol.test.ts
```

Expected: PASS。

再跑：

```bash
pnpm type-check
```

Expected: 通过（`installAppProtocolHandler` 新必填项已在 `index.ts` 补上）。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/app-protocol.ts apps/desktop/src/main/app-protocol.test.ts apps/desktop/src/main/index.ts
git commit -m "$(cat <<'EOF'
feat(desktop): app:// 开发转发 Vite、生产读 dist

静态资源与 tRPC 共用同一协议入口，开发不再把非 trpc 路径 404 掉。
EOF
)"
```

---

### Task 3: 窗口恒加载 app://，Vite HMR 走 127.0.0.1

**Files:**

- Modify: `apps/desktop/src/main/index.ts:162-173`
- Modify: `apps/desktop/vite.config.ts:44-48`

**Interfaces:**

- Consumes: Task 1 的 `rendererUrl`
- Produces: `loadRenderer(win, page)` 对任意环境都 `win.loadURL(rendererUrl(page))`；Vite 开发服务器 `server.hmr.protocol === 'ws'` 且 `server.hmr.host === '127.0.0.1'`（不写死端口）

- [ ] **Step 1: Write the failing test**

Task 1 已覆盖 `rendererUrl` 映射表。本任务不新增测试文件。若 `loadRenderer` 仍加载 `VITE_DEV_SERVER_URL` 或 `loadFile`，用 grep 作为失败门闩：

```bash
rg "VITE_DEV_SERVER_URL|loadFile" apps/desktop/src/main/index.ts
```

Expected（改之前）: `loadRenderer` 里仍能看到这两处。改完后 `index.ts` 的 `loadRenderer` 不得再出现它们；`process.env.VITE_DEV_SERVER_URL` 只允许出现在 `installAppProtocolHandler` 实参里。`phone-login.ts` 的 `loadFile` 必须仍在。

- [ ] **Step 2: 改 loadRenderer 与 Vite HMR**

`apps/desktop/src/main/index.ts` 增加 import：

```ts
import {
	installAppProtocolHandler,
	registerAppSchemePrivileged,
	rendererUrl,
} from './app-protocol'
```

替换 `loadRenderer`：

```ts
function loadRenderer(
	win: BrowserWindow,
	page: 'index.html' | 'lyrics.html' | 'mini.html',
) {
	void win.loadURL(rendererUrl(page))
}
```

`apps/desktop/vite.config.ts` 的 `server`：

```ts
	server: {
		fs: {
			allow: [join(root, '../..')],
		},
		hmr: {
			protocol: 'ws',
			host: '127.0.0.1',
		},
	},
```

不要设置 `hmr.port` / `clientPort`，让 Vite 把实际监听端口注入 `__HMR_PORT__`。

不要改三份 HTML 的 CSP：`index.html` / `lyrics.html` / `mini.html` 的 `connect-src` 已包含 `'self' http://127.0.0.1:* ws: wss:`。文档 origin 变为 `app://localhost` 后 `'self'` 覆盖 tRPC，HMR 走 `ws://127.0.0.1:<port>`。

- [ ] **Step 3: 用 grep 确认约束**

Run:

```bash
rg "loadFile|loadURL|VITE_DEV_SERVER_URL|rendererUrl" apps/desktop/src/main/index.ts apps/desktop/src/main/phone-login.ts
```

Expected:

- `index.ts`：`loadRenderer` 只有 `rendererUrl`；`VITE_DEV_SERVER_URL` 只出现在 `installAppProtocolHandler`
- `phone-login.ts`：仍有 `loadFile`（极验窗）
- 不要出现 `win.loadFile(join(RENDERER_DIST`

- [ ] **Step 4: 跑门禁**

Run:

```bash
vp test apps/desktop/src/main/app-protocol.test.ts
vp check
vp test
pnpm type-check
```

Expected: 全部通过。`vp check` 若改了格式，把格式化结果一并纳入提交。

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/main/index.ts apps/desktop/vite.config.ts
git commit -m "$(cat <<'EOF'
feat(desktop): 窗口改为加载 app:// 并固定 Vite HMR 主机

开发和生产共用 app://localhost origin，HMR 不再依赖空的自定义协议端口。
EOF
)"
```

---

## 手动验收（实现后由人点一次，不写入自动化）

1. `pnpm desktop`（或 `vp dev`）打开主窗口，DevTools 文档 URL 为 `app://localhost/`，控制台无 CSP `app://localhost/trpc` 拦截。
2. 改一个渲染文件，HMR 生效（WebSocket 连 `127.0.0.1`，不是 `app:`）。
3. 打开歌词窗、迷你窗，地址分别为 `app://localhost/lyrics.html`、`app://localhost/mini.html`。
4. 播放一首歌，音频仍走 `http://127.0.0.1:<audio-proxy-port>`（本计划不改）。
