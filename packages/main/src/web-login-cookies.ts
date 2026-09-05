import { getLogger } from './logger/runtime.ts'

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
html, body {
  overflow: hidden !important;
}
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
	} catch (error) {
		getLogger('web-login-cookies').warn(
			{ err: error },
			'parse login popup url failed',
		)
		return false
	}
}
