import { join } from 'node:path'

import { createLogger, type Logger } from './create-logger.ts'
import { resolveLogSinks } from './destination.ts'
import { mapPrdLogLevel, resolveLogLevel } from './env.ts'

export type InitLoggerOptions = {
	defaultFilePath: string
	isPackaged?: boolean
	level?: string
	env?: NodeJS.ProcessEnv
}

let root: Logger | undefined
let options: InitLoggerOptions | undefined

function fallbackOptions(): InitLoggerOptions {
	return {
		defaultFilePath: join(process.cwd(), '.data', 'logs', 'bbplayer.log'),
	}
}

export function initLogger(next: InitLoggerOptions): Logger {
	options = next
	root = createLogger({
		defaultFilePath: next.defaultFilePath,
		isPackaged: next.isPackaged,
		level: next.level ?? resolveLogLevel(next.env),
		env: next.env,
	})
	return root
}

export function getRootLogger(): Logger {
	if (!root) initLogger(options ?? fallbackOptions())
	return root as Logger
}

export function getLogger(name: string): Logger {
	return getRootLogger().child({ name })
}

export function setLogLevel(level: string): void {
	getRootLogger().level = mapPrdLogLevel(level)
}

export function getDefaultLogFilePath(): string {
	return (options ?? fallbackOptions()).defaultFilePath
}

export function getLogFilePath(): string {
	const current = options ?? fallbackOptions()
	const sinks = resolveLogSinks({
		defaultFilePath: current.defaultFilePath,
		env: current.env,
		isPackaged: current.isPackaged,
	})
	return sinks.filePath ?? current.defaultFilePath
}

export function resetLoggerForTests(): void {
	root = undefined
	options = undefined
}
