const KEYS = new Set([
	'cookie',
	'musicaiapikey',
	'sessdata',
	'bili_jct',
	'dedeuserid',
	'dedeuserid__ckmd5',
])

const COOKIE_RE =
	/\b(SESSDATA|bili_jct|DedeUserID|DedeUserID__ckMd5)=([^;\s]+)/gi

export function redact(value: unknown): unknown {
	if (typeof value === 'string') {
		return value.replace(COOKIE_RE, '$1=[redacted]')
	}
	if (value instanceof Error) {
		const copy = new Error(String(redact(value.message)))
		copy.name = value.name
		copy.stack = value.stack
		return copy
	}
	if (Array.isArray(value)) return value.map((item) => redact(item))
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {}
		for (const [key, nested] of Object.entries(value)) {
			out[key] = KEYS.has(key.toLowerCase()) ? '[redacted]' : redact(nested)
		}
		return out
	}
	return value
}
