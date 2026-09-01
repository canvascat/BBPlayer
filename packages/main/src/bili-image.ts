const BILI_REFERER = 'https://www.bilibili.com/'

export const BILI_IMAGE_URL_FILTER = [
	'https://*.hdslb.com/*',
	'http://*.hdslb.com/*',
	'https://*.biliimg.com/*',
	'http://*.biliimg.com/*',
]

export function coverUrl(input: string | undefined) {
	if (!input) return ''
	const trimmed = input.trim()
	if (!trimmed) return ''
	if (trimmed.startsWith('https://')) return trimmed
	if (trimmed.startsWith('http://')) return `https://${trimmed.slice(7)}`
	if (trimmed.startsWith('//')) return `https:${trimmed}`
	if (trimmed.startsWith('data:')) return trimmed
	return `https://${trimmed.replace(/^\/+/, '')}`
}

export function withBiliImageHeaders(headers: Record<string, string>) {
	const next: Record<string, string> = {}
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === 'referer') continue
		next[key] = value
	}
	next.Referer = BILI_REFERER
	return next
}

export function withBiliImageCorsHeaders(
	headers: Record<string, string | string[] | undefined>,
) {
	const next: Record<string, string[]> = {}
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined) continue
		if (key.toLowerCase() === 'access-control-allow-origin') continue
		next[key] = Array.isArray(value) ? value : [value]
	}
	next['Access-Control-Allow-Origin'] = ['*']
	return next
}
