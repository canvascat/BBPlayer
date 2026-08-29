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
let inflight: Promise<string> | null = null

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
		const win = new BrowserWindow({
			parent: options.parent ?? undefined,
			modal: Boolean(options.parent),
			width: 820,
			height: 430,
			useContentSize: true,
			title: '登录哔哩哔哩',
			show: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			// closable: false,
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
	if (inflight) {
		loginWindow?.focus()
		return inflight
	}
	inflight = openWebLoginWindow(options).finally(() => {
		inflight = null
	})
	return inflight
}
