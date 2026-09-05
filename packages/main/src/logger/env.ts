const PINO_LEVELS = new Set([
	'fatal',
	'error',
	'warn',
	'info',
	'debug',
	'trace',
])

export function mapPrdLogLevel(level: string): string {
	const normalized = level.trim().toLowerCase()
	if (normalized === 'verbose') return 'debug'
	if (normalized === 'silly') return 'trace'
	if (PINO_LEVELS.has(normalized)) return normalized
	return 'warn'
}

export function resolveLogLevel(env: NodeJS.ProcessEnv = process.env): string {
	const raw = env.BBPLAYER_LOG_LEVEL?.trim()
	if (!raw) return 'warn'
	return mapPrdLogLevel(raw)
}

export function shouldUsePretty(options?: {
	env?: NodeJS.ProcessEnv
	isPackaged?: boolean
}): boolean {
	if (options?.isPackaged) return false
	const env = options?.env ?? process.env
	const forced = env.BBPLAYER_LOG_PRETTY?.trim()
	if (forced === '1' || forced === 'true') return true
	if (forced === '0' || forced === 'false') return false
	return env.NODE_ENV === 'development'
}

export function parseLogFileEnv(
	value: string | undefined,
): 'off' | 'default' | { path: string } {
	const raw = value?.trim()
	if (!raw) return 'off'
	if (raw === '1' || raw.toLowerCase() === 'true') return 'default'
	return { path: raw }
}
