import { mkdirSync } from 'node:fs'
import path from 'node:path'

import pino from 'pino'
import type { DestinationStream } from 'pino'
// Static import so Electron `vp pack` (alwaysBundle) can inline it.
// createRequire leaves a runtime require() that fails from dist/main.mjs.
import pretty from 'pino-pretty'

import { resolveLogSinks } from './destination.ts'
import { resolveLogLevel } from './env.ts'

export type CreateLoggerOptions = {
	name?: string
	level?: string
	defaultFilePath?: string
	isPackaged?: boolean
	env?: NodeJS.ProcessEnv
}

export type Logger = pino.Logger

export function createLogger(options: CreateLoggerOptions = {}): Logger {
	const env = options.env ?? process.env
	const level = options.level ?? resolveLogLevel(env)
	const sinks = resolveLogSinks({
		defaultFilePath: options.defaultFilePath,
		env,
		isPackaged: options.isPackaged,
	})

	const streams: Array<{ stream: DestinationStream; level?: pino.Level }> = []

	if (sinks.prettyStdout) {
		streams.push({
			stream: pretty({
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname',
			}),
		})
	}

	if (sinks.filePath) {
		mkdirSync(path.dirname(sinks.filePath), { recursive: true })
		streams.push({
			stream: pino.destination({
				dest: sinks.filePath,
				mkdir: true,
				sync: true,
			}),
		})
	}

	if (streams.length === 0) {
		streams.push({ stream: pino.destination(1) })
	}

	return pino(
		{
			name: options.name ?? 'bbplayer',
			level,
		},
		pino.multistream(streams),
	)
}
