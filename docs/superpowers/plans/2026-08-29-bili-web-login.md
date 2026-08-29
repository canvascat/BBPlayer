# B 站网页登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页用官方网页登录替换自研扫码和手机号，Cookie 仍写入现有 store 并刷新账号。

**Architecture:** 主进程在隔离 partition `persist:bili-login` 中打开 B 站首页，点击登录弹层，从 `session.cookies` 采集 Cookie，转成请求头后走 `refreshAccount()`。纯函数与 tRPC 可单测；真正的 BrowserWindow 只在主进程装配。

**Tech Stack:** 现有 Electron、tRPC 11、Vitest（`vp test`）、zod。不新增依赖。

## Global Constraints

- 成功判定只走 `session.cookies`，不读 `document.cookie`（`SESSDATA` 为 HttpOnly）
- 登录窗不设 `preload`
- partition 必须是 `persist:bili-login`，禁止用 `defaultSession`
- 第三方登录子窗必须同 partition，禁止 `openExternal`
- 设置页去掉扫码区、`PhoneLogin` 和 Cookie 粘贴；渲染进程不再读写 Cookie 明文
- 官方弹层关闭按钮用 CSS 隐藏；登录窗 `closable: false`
- 本轮不删除 `auth.qrStart` / `phoneStart` / `phoneLogin` / 极验实现
- 命令在仓库根目录：`vp test`、`vp check`、`pnpm type-check`
- commit message 用本仓库 gitmoji Conventional Commits

对照 spec：`docs/superpowers/specs/2026-08-29-bili-web-login-design.md`

---

## File map

**Create:**

- `packages/main/src/web-login-cookies.ts` — 纯函数与常量
- `packages/main/src/web-login-cookies.test.ts`
- `packages/main/src/web-login.ts` — BrowserWindow 流程
- `packages/main/src/trpc/routers/auth.test.ts`

**Modify:**

- `packages/main/src/trpc/context.ts` — `openWebLogin` / `clearBiliLoginSession`
- `packages/main/src/trpc/mock-context.ts` — 默认实现
- `packages/main/src/trpc/routers/auth.ts` — `webStart`；`logout` 清 partition
- `packages/main/src/index.ts` — 把窗口函数注入 context
- `packages/renderer/src/App.tsx` — 设置页入口
- `packages/renderer/src/PhoneLogin.tsx` — 删除

---

### Task 1: Cookie 与弹窗 URL 纯函数

**Files:**

- Create: `packages/main/src/web-login-cookies.ts`
- Create: `packages/main/src/web-login-cookies.test.ts`

**Interfaces:**

- Produces: `CookieLike`、`REQUIRED_LOGIN_COOKIES`、`BILI_WEB_LOGIN_PARTITION`、`BILI_HOME_URL`、`BILI_PASSPORT_LOGIN_URL`、`LOGIN_ENTRY_SELECTOR`、`COOKIE_DEBOUNCE_MS`、`LOGIN_MODAL_CSS`、`WEB_LOGIN_UA`、`isCompleteBiliLoginCookies`、`electronCookiesToHeader`、`isAllowedLoginPopupUrl`

- [ ] **Step 1: Write the failing test**

```ts
import { test, assert } from 'vitest'

import {
	electronCookiesToHeader,
	isAllowedLoginPopupUrl,
	isCompleteBiliLoginCookies,
} from './web-login-cookies.ts'

test('三个核心 Cookie 齐全才算登录完成', () => {
	assert.equal(isCompleteBiliLoginCookies([]), false)
	assert.equal(
		isCompleteBiliLoginCookies([{ name: 'SESSDATA', value: 'a' }]),
		false,
	)
	assert.equal(
		isCompleteBiliLoginCookies([
			{ name: 'SESSDATA', value: 'a' },
			{ name: 'bili_jct', value: 'b' },
			{ name: 'DedeUserID', value: '' },
		]),
		false,
	)
	assert.equal(
		isCompleteBiliLoginCookies([
			{ name: 'SESSDATA', value: 'a' },
			{ name: 'bili_jct', value: 'b' },
			{ name: 'DedeUserID', value: '1' },
		]),
		true,
	)
})

test('只把 bili 域 Cookie 拼成请求头，同名后者覆盖', () => {
	const header = electronCookiesToHeader([
		{ name: 'SESSDATA', value: 'old', domain: '.bilibili.com' },
		{ name: 'tracker', value: 'x', domain: '.example.com' },
		{ name: 'SESSDATA', value: 'new', domain: '.bilibili.com' },
		{ name: 'bili_jct', value: 'csrf', domain: 'bilibili.com' },
		{ name: 'buvid3', value: 'dev' },
	])
	assert.equal(header, 'SESSDATA=new; bili_jct=csrf; buvid3=dev')
})

test('仅允许 B 站与微信 QQ 微博登录弹窗', () => {
	assert.equal(
		isAllowedLoginPopupUrl('https://passport.bilibili.com/login'),
		true,
	)
	assert.equal(
		isAllowedLoginPopupUrl('https://open.weixin.qq.com/connect'),
		true,
	)
	assert.equal(isAllowedLoginPopupUrl('https://graph.qq.com/oauth2.0'), true)
	assert.equal(isAllowedLoginPopupUrl('https://api.weibo.com/oauth2'), true)
	assert.equal(isAllowedLoginPopupUrl('https://evil.example/phish'), false)
	assert.equal(isAllowedLoginPopupUrl('not a url'), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/web-login-cookies.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Write minimal implementation**

```ts
export type CookieLike = {
	name: string
	value: string
	domain?: string
}

export const REQUIRED_LOGIN_COOKIES = [
	'SESSDATA',
	'bili_jct',
	'DedeUserID',
] as const

export const BILI_WEB_LOGIN_PARTITION = 'persist:bili-login'
export const BILI_HOME_URL = 'https://www.bilibili.com/'
export const BILI_PASSPORT_LOGIN_URL = 'https://passport.bilibili.com/login'
export const LOGIN_ENTRY_SELECTOR = '.header-login-entry'
export const COOKIE_DEBOUNCE_MS = 400

export const WEB_LOGIN_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const LOGIN_MODAL_CSS = `
body > *:not(.bili-mini-mask) {
  visibility: hidden !important;
}
.bili-mini-mask {
  visibility: visible !important;
  background: #fff !important;
}
.bili-mini-close-icon {
  display: none !important;
}
`

export function isCompleteBiliLoginCookies(cookies: CookieLike[]) {
	const map = new Map(cookies.map((item) => [item.name, item.value]))
	return REQUIRED_LOGIN_COOKIES.every((name) => Boolean(map.get(name)?.trim()))
}

export function electronCookiesToHeader(cookies: CookieLike[]) {
	const map = new Map<string, string>()
	for (const cookie of cookies) {
		const domain = cookie.domain ?? ''
		if (domain && !domain.includes('bilibili.com')) continue
		if (!cookie.name) continue
		map.set(cookie.name, cookie.value)
	}
	return [...map.entries()]
		.map(([name, value]) => `${name}=${value}`)
		.join('; ')
}

export function isAllowedLoginPopupUrl(url: string) {
	try {
		const host = new URL(url).hostname.toLowerCase()
		return (
			host === 'bilibili.com' ||
			host.endsWith('.bilibili.com') ||
			host === 'qq.com' ||
			host.endsWith('.qq.com') ||
			host === 'weibo.com' ||
			host.endsWith('.weibo.com')
		)
	} catch {
		return false
	}
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `vp test packages/main/src/web-login-cookies.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/web-login-cookies.ts packages/main/src/web-login-cookies.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 抽出 B 站网页登录 Cookie 判定

EOF
)"
```

---

### Task 2: tRPC `webStart` 与退出时清 partition

**Files:**

- Modify: `packages/main/src/trpc/context.ts`
- Modify: `packages/main/src/trpc/mock-context.ts`
- Modify: `packages/main/src/trpc/routers/auth.ts`
- Create: `packages/main/src/trpc/routers/auth.test.ts`

**Interfaces:**

- Consumes: Task 1 的纯函数不在本任务直接调用；本任务只接 context 注入
- Produces: `TrpcContext.openWebLogin(): Promise<string>`、`TrpcContext.clearBiliLoginSession(): Promise<void>`、`auth.webStart` 返回 `{ cookie: string, account: { mid, name, face } | null }`

- [ ] **Step 1: Write the failing test**

`packages/main/src/trpc/routers/auth.test.ts`：

```ts
import { test, assert } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context'

import { authRouter } from './auth'

test('webStart 把网页登录 Cookie 写入 store 并刷新账号', async () => {
	const store = memoryStore()
	const account = { mid: 1, name: '测试', face: 'https://example/face.png' }
	const caller = authRouter.createCaller(
		mockTrpcContext({
			store,
			openWebLogin: async () => 'SESSDATA=abc; bili_jct=csrf; DedeUserID=1',
			refreshAccount: async () => {
				store.set('account', account)
				return account
			},
		}),
	)
	const result = await caller.webStart()
	assert.equal(store.get('cookie'), 'SESSDATA=abc; bili_jct=csrf; DedeUserID=1')
	assert.deepEqual(result.account, account)
	assert.equal(result.cookie, 'SESSDATA=abc; bili_jct=csrf; DedeUserID=1')
})

test('logout 清空登录态并清理网页登录 session', async () => {
	const store = memoryStore({
		cookie: 'SESSDATA=abc',
		account: { mid: 1, name: '测试', face: '' },
	})
	let cleared = 0
	const caller = authRouter.createCaller(
		mockTrpcContext({
			store,
			clearBiliLoginSession: async () => {
				cleared += 1
			},
		}),
	)
	await caller.logout()
	assert.equal(store.get('cookie'), '')
	assert.equal(store.get('account'), null)
	assert.equal(cleared, 1)
})
```

此时 `createCaller` 还没有 `webStart`，`TrpcContext` 也还没有这两个字段。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/auth.test.ts`

Expected: FAIL（类型或 `webStart` 不存在）。

- [ ] **Step 3: Write minimal implementation**

在 `TrpcContext` 中、`openGeetest` 旁增加：

```ts
openWebLogin: () => Promise<string>
clearBiliLoginSession: () => Promise<void>
```

`mock-context.ts` 的默认实现：

```ts
		openWebLogin: async () => {
			throw new Error('unused')
		},
		clearBiliLoginSession: async () => undefined,
```

`auth.ts` 的 `logout` 改为：

```ts
	logout: publicProcedure.mutation(async ({ ctx }) => {
		stopQr()
		ctx.store.set('cookie', '')
		ctx.store.set('account', null)
		clearWbiCache()
		await ctx.clearBiliLoginSession()
		return true
	}),
```

在 `qrCancel` 之前加入：

```ts
	webStart: publicProcedure.mutation(async ({ ctx }) => {
		const cookieHeader = await ctx.openWebLogin()
		ctx.store.set('cookie', cookieHeader)
		await ctx.refreshAccount()
		return {
			cookie: cookieFrom(ctx.store),
			account: ctx.store.get('account') ?? null,
		}
	}),
```

其余 qr / phone procedure 不动。

- [ ] **Step 4: Run tests and make sure they pass**

Run: `vp test packages/main/src/trpc/routers/auth.test.ts packages/main/src/trpc/routers/settings.test.ts`

Expected: PASS（`settings` 确认 mock context 没有把旧测试打挂）。

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/trpc/context.ts packages/main/src/trpc/mock-context.ts packages/main/src/trpc/routers/auth.ts packages/main/src/trpc/routers/auth.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 网页登录写入 Cookie 并在退出时清 session

EOF
)"
```

---

### Task 3: Electron 登录窗

**Files:**

- Create: `packages/main/src/web-login.ts`

**Interfaces:**

- Consumes: Task 1 全部导出；`verifyAccount(cookie: string) => Promise<boolean>`
- Produces: `openWebLogin(options): Promise<string>`、`clearBiliLoginSession(): Promise<void>`

本任务不强行给 BrowserWindow 写自动化测试；Cookie 判定已在 Task 1 覆盖。实现必须遵守 spec 的 settled / debounce / 无 preload。

- [ ] **Step 1: Implement `web-login.ts`**

```ts
import { BrowserWindow, session } from 'electron'

import {
	BILI_HOME_URL,
	BILI_PASSPORT_LOGIN_URL,
	BILI_WEB_LOGIN_PARTITION,
	COOKIE_DEBOUNCE_MS,
	LOGIN_ENTRY_SELECTOR,
	LOGIN_MODAL_CSS,
	WEB_LOGIN_UA,
	electronCookiesToHeader,
	isAllowedLoginPopupUrl,
	isCompleteBiliLoginCookies,
} from './web-login-cookies'

export type WebLoginOptions = {
	parent?: Electron.BrowserWindow | null
	verifyAccount: (cookie: string) => Promise<boolean>
}

let loginWindow: BrowserWindow | null = null

function biliSession() {
	const ses = session.fromPartition(BILI_WEB_LOGIN_PARTITION)
	ses.setUserAgent(WEB_LOGIN_UA)
	return ses
}

export async function clearBiliLoginSession() {
	await biliSession().clearStorageData({ storages: ['cookies'] })
}

async function harvestHeader(ses: Electron.Session) {
	const cookies = await ses.cookies.get({ url: BILI_HOME_URL })
	if (!isCompleteBiliLoginCookies(cookies)) return null
	return electronCookiesToHeader(cookies)
}

export async function peekBiliLoginCookie(
	verifyAccount: WebLoginOptions['verifyAccount'],
) {
	const header = await harvestHeader(biliSession())
	if (!header) return null
	if (!(await verifyAccount(header))) return null
	return header
}

function delay(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

async function tryOpenOfficialModal(win: BrowserWindow) {
	const hasEntry = await win.webContents.executeJavaScript(
		`Boolean(document.querySelector(${JSON.stringify(LOGIN_ENTRY_SELECTOR)}))`,
		true,
	)
	if (!hasEntry) return false
	await win.webContents.executeJavaScript(
		`document.querySelector(${JSON.stringify(LOGIN_ENTRY_SELECTOR)})?.click()`,
		true,
	)
	await delay(300)
	const hasMask = await win.webContents.executeJavaScript(
		`Boolean(document.querySelector('.bili-mini-mask'))`,
		true,
	)
	if (!hasMask) return false
	await win.webContents.insertCSS(LOGIN_MODAL_CSS)
	return true
}

function openWebLoginWindow(options: WebLoginOptions) {
	return new Promise<string>((resolve, reject) => {
		const ses = biliSession()
		if (loginWindow && !loginWindow.isDestroyed()) {
			loginWindow.focus()
			return
		}
		const win = new BrowserWindow({
			parent: options.parent ?? undefined,
			modal: Boolean(options.parent),
			width: 880,
			height: 520,
			title: '登录哔哩哔哩',
			show: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			closable: false,
			webPreferences: {
				partition: BILI_WEB_LOGIN_PARTITION,
				sandbox: true,
				contextIsolation: true,
			},
		})
		loginWindow = win
		let settled = false
		let debounceTimer: ReturnType<typeof setTimeout> | null = null

		const finish = (error: Error | null, header?: string) => {
			if (settled) return
			settled = true
			if (debounceTimer) clearTimeout(debounceTimer)
			ses.cookies.removeListener('changed', onChanged)
			if (!win.isDestroyed()) win.close()
			loginWindow = null
			if (error) reject(error)
			else if (header) resolve(header)
			else reject(new Error('已取消登录'))
		}

		const tryComplete = () => {
			void (async () => {
				const header = await harvestHeader(ses)
				if (!header) return
				if (!(await options.verifyAccount(header))) return
				finish(null, header)
			})()
		}

		const onChanged = (
			_event: Electron.Event,
			cookie: Electron.Cookie,
			_cause: string,
			removed: boolean,
		) => {
			if (removed) return
			if (!['SESSDATA', 'bili_jct', 'DedeUserID'].includes(cookie.name)) {
				return
			}
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(tryComplete, COOKIE_DEBOUNCE_MS)
		}

		ses.cookies.on('changed', onChanged)

		win.webContents.setWindowOpenHandler(({ url }) => {
			if (!isAllowedLoginPopupUrl(url)) return { action: 'deny' }
			return {
				action: 'allow',
				overrideBrowserWindowOptions: {
					parent: win,
					webPreferences: {
						partition: BILI_WEB_LOGIN_PARTITION,
					},
				},
			}
		})

		win.webContents.once('did-finish-load', () => {
			void (async () => {
				const existing = await harvestHeader(ses)
				if (existing && (await options.verifyAccount(existing))) {
					finish(null, existing)
					return
				}
				const opened = await tryOpenOfficialModal(win)
				if (!opened && !win.isDestroyed()) {
					await win.loadURL(BILI_PASSPORT_LOGIN_URL)
				}
				if (!win.isDestroyed()) win.show()
			})()
		})

		win.on('closed', () => {
			loginWindow = null
			finish(new Error('已取消登录'))
		})

		void win.loadURL(BILI_HOME_URL)
	})
}

export async function openWebLogin(options: WebLoginOptions) {
	const existing = await peekBiliLoginCookie(options.verifyAccount)
	if (existing) return existing
	return openWebLoginWindow(options)
}
```

注意：若已有窗口时 `openWebLoginWindow` 只 `focus()` 而不返回 Promise，会导致第二次调用挂起。实现时若 `loginWindow` 仍在，应 `return` **同一个** in-flight Promise。用模块级 `let inflight: Promise<string> | null`：已有 inflight 则直接 return 它；`finish` 时置空。

修正后的入口：

```ts
let inflight: Promise<string> | null = null

export async function openWebLogin(options: WebLoginOptions) {
	const existing = await peekBiliLoginCookie(options.verifyAccount)
	if (existing) return existing
	if (inflight) {
		loginWindow?.focus()
		return inflight
	}
	inflight = openWebLoginWindow(options).finally(() => {
		inflight = null
	})
	return inflight
}
```

此时 `openWebLoginWindow` 开头不再需要「已有窗口则 focus 并 return」。

- [ ] **Step 2: Typecheck the new file**

Run: `pnpm type-check`

Expected: `web-login.ts` 无新增错误。若 `cookies.on` 的 listener 类型不匹配，按 Electron 的 `Electron.Cookies` 事件签名微调，不要改业务语义。

- [ ] **Step 3: Commit**

```bash
git add packages/main/src/web-login.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 用隔离窗口打开 B 站官网登录

EOF
)"
```

---

### Task 4: 主进程注入 context

**Files:**

- Modify: `packages/main/src/index.ts`

**Interfaces:**

- Consumes: `openWebLogin`、`clearBiliLoginSession`；现有 `getAccount`
- Produces: tRPC context 可真实打开登录窗

- [ ] **Step 1: Wire context**

在 `index.ts` 增加 import：

```ts
import { clearBiliLoginSession, openWebLogin } from './web-login'
```

在 `openGeetest` 旁增加：

```ts
function openBiliWebLogin() {
	return openWebLogin({
		parent: mainWindow,
		verifyAccount: async (cookieHeader) =>
			Boolean(await getAccount(cookieHeader)),
	})
}
```

`createTRPCContext({...})` 中 `openGeetest` 旁加入：

```ts
						openWebLogin: openBiliWebLogin,
						clearBiliLoginSession,
```

`getAccount` 在 cookie 为空或未登录时返回 `null`，`Boolean(null)` 为 false，符合 spec。

- [ ] **Step 2: Typecheck**

Run: `pnpm type-check`

Expected: PASS（context 缺字段会在这里爆）。

- [ ] **Step 3: Commit**

```bash
git add packages/main/src/index.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 将网页登录窗接到 tRPC context

EOF
)"
```

---

### Task 5: 设置页入口

**Files:**

- Modify: `packages/renderer/src/App.tsx`
- Delete: `packages/renderer/src/PhoneLogin.tsx`

**Interfaces:**

- Consumes: `trpcClient.auth.webStart.mutate()` 返回 `{ cookie, account }`（渲染层只用 `account`）
- Produces: 未登录显示「连接 Bilibili」；已登录仍是资料卡；无 Cookie 输入

- [ ] **Step 1: Remove QR / phone / cookie UI**

删除：

- `import { PhoneLogin } from './PhoneLogin'`
- `qr` state、`cookie` state
- `auth.qrUpdates` 的 `useEffect`
- 启动时 `setCookie(settings.cookie)`
- `logout` 里的 `setQr(null)`、`setCookie('')`
- Cookie `<Field>` / `<Textarea>`
- `saveSettings` 里的 `cookie` 字段

增加：

```ts
const [loginBusy, setLoginBusy] = useState(false)
const [loginMessage, setLoginMessage] = useState('')
```

`connectBili`：

```ts
const connectBili = async () => {
	setLoginBusy(true)
	setLoginMessage('')
	try {
		const result = await trpcClient.auth.webStart.mutate()
		setAccount(result.account)
		await loadRemoteLibrary()
		setLoginMessage('登录成功')
	} catch (err) {
		setLoginMessage(err instanceof Error ? err.message : String(err))
	} finally {
		setLoginBusy(false)
	}
}
```

`saveSettings` 只保存其它选项：

```ts
await trpcClient.settings.set.mutate({
	continuePlayingAfterClose,
	menuBarShowLyrics,
	autoCache,
	skin,
})
```

`CardDescription` 改为：

```
在官方页面登录后可打开收藏夹、合集和稍后再看。
```

未登录分支（替换原来的二维码 + `PhoneLogin`）为：

```tsx
<div className='flex flex-col gap-3'>
	<Button
		type='button'
		variant='secondary'
		disabled={loginBusy}
		onClick={() => void connectBili()}
	>
		{loginBusy ? '登录中…' : '连接 Bilibili'}
	</Button>
	{loginMessage && <p className='text-muted-foreground'>{loginMessage}</p>}
</div>
```

开关、保存按钮保持不变。已登录分支保持资料卡 + 退出。`settings.set` 的 `cookie` 字段留在主进程，本任务不要从 UI 调用。

- [ ] **Step 2: Delete `PhoneLogin.tsx`**

确认没有其它引用后再删。

- [ ] **Step 3: Check**

Run: `vp check`

Expected: 格式与 lint 通过。若 `App.tsx` 有未使用变量，删干净。

- [ ] **Step 4: Commit**

```bash
git add packages/renderer/src/App.tsx packages/renderer/src/PhoneLogin.tsx
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 设置页改为打开官网登录

EOF
)"
```

---

### Task 6: 全量校验

- [ ] **Step 1: 自动验证**

Run:

```bash
vp test
vp check
pnpm type-check
```

Expected: 全部通过。

- [ ] **Step 2: 手动验证（实现者在 `pnpm desktop` 下做）**

- 未登录点「连接 Bilibili」→ 出现登录窗和官方弹层（或通行证页）
- 弹层没有关闭按钮；窗口红绿灯不可点关
- 扫码成功 → 设置页资料卡、音乐库收藏夹；登录窗自动关掉
- 退出后再连接 → 会重新出登录窗
- 设置页没有 Cookie 输入框；保存其它设置不会改 Cookie

手动项不写入自动测试。做完把结果记在 PR / 对话里即可。
