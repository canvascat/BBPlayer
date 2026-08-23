import QRCode from 'qrcode'

export const QrStatusCode = {
	SUCCESS: 0,
	EXPIRED: 86038,
	SCANNED: 86090,
	WAIT: 86101,
} as const

export type QrPhase = 'generating' | 'polling' | 'expired' | 'success' | 'error'

export function qrStatusText(code: number) {
	if (code === QrStatusCode.WAIT) return '等待扫码'
	if (code === QrStatusCode.SCANNED) return '已扫码，等待确认'
	if (code === QrStatusCode.EXPIRED) return '二维码已过期'
	if (code === QrStatusCode.SUCCESS) return '登录成功'
	return `未知状态 ${code}`
}

export function setCookiesToHeader(setCookies: string[]) {
	const map = new Map<string, string>()
	for (const raw of setCookies) {
		const pair = raw.split(';')[0] ?? ''
		const eq = pair.indexOf('=')
		if (eq <= 0) continue
		const name = pair.slice(0, eq).trim()
		const value = pair.slice(eq + 1).trim()
		if (name) map.set(name, value)
	}
	return [...map.entries()]
		.map(([name, value]) => `${name}=${value}`)
		.join('; ')
}

export function formatDuration(seconds: number) {
	if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
	const total = Math.floor(seconds)
	const m = Math.floor(total / 60)
	const s = total % 60
	return `${m}:${String(s).padStart(2, '0')}`
}

const PASSPORT_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0'

export async function generateLoginQr() {
	const response = await fetch(
		'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
		{ headers: { 'User-Agent': PASSPORT_UA } },
	)
	const json = (await response.json()) as {
		code: number
		message?: string
		data?: { url: string; qrcode_key: string }
	}
	if (json.code !== 0 || !json.data?.url || !json.data.qrcode_key) {
		throw new Error(json.message || '获取二维码失败')
	}
	const dataUrl = await QRCode.toDataURL(json.data.url, {
		margin: 1,
		width: 240,
		color: { dark: '#1a1c20', light: '#ffffff' },
	})
	return {
		url: json.data.url,
		qrcodeKey: json.data.qrcode_key,
		dataUrl,
	}
}

export async function pollLoginQr(qrcodeKey: string) {
	const response = await fetch(
		`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`,
		{ headers: { 'User-Agent': PASSPORT_UA } },
	)
	const json = (await response.json()) as {
		code: number
		message?: string
		data?: { code: number; message?: string }
	}
	if (json.code !== 0) {
		throw new Error(json.message || '获取二维码登录状态失败')
	}
	const status = json.data?.code ?? -1
	let cookie = ''
	if (status === QrStatusCode.SUCCESS) {
		const setCookies =
			typeof response.headers.getSetCookie === 'function'
				? response.headers.getSetCookie()
				: []
		cookie = setCookiesToHeader(setCookies)
		if (!cookie) {
			const fallback = response.headers.get('set-cookie')
			cookie = fallback ? setCookiesToHeader([fallback]) : ''
		}
		if (!cookie) throw new Error('未获取到 Set-Cookie 头信息')
	}
	return {
		status,
		statusText: qrStatusText(status),
		cookie,
	}
}
