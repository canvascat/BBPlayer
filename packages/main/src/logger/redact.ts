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

export function redact(value: unknown, seen?: WeakSet<object>): unknown {
	if (typeof value === 'string') {
		return value.replace(COOKIE_RE, '$1=[redacted]')
	}
	if (value instanceof Error) {
		const copy = new Error(String(redact(value.message, seen)))
		copy.name = value.name
		copy.stack =
			typeof value.stack === 'string'
				? (redact(value.stack, seen) as string)
				: value.stack
		return copy
	}
	if (Array.isArray(value)) {
		const visited = seen ?? new WeakSet<object>()
		if (visited.has(value)) return '[Circular]'
		visited.add(value)
		return value.map((item) => redact(item, visited))
	}
	if (value && typeof value === 'object') {
		const visited = seen ?? new WeakSet<object>()
		if (visited.has(value)) return '[Circular]'
		visited.add(value)
		const out: Record<string, unknown> = {}
		for (const [key, nested] of Object.entries(value)) {
			out[key] = KEYS.has(key.toLowerCase())
				? '[redacted]'
				: redact(nested, visited)
		}
		return out
	}
	return value
}
