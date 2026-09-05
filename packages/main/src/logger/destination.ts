import { parseLogFileEnv, shouldUsePretty } from './env.ts'

export type LogDestination = 'stdout' | { file: string }

export type ResolvedLogSinks = {
	prettyStdout: boolean
	filePath: string | null
}

function requireDefaultFilePath(defaultFilePath: string | undefined): string {
	if (!defaultFilePath) {
		throw new Error('defaultFilePath is required when file logging is enabled')
	}
	return defaultFilePath
}

export function resolveLogSinks(options?: {
	defaultFilePath?: string
	env?: NodeJS.ProcessEnv
	isPackaged?: boolean
}): ResolvedLogSinks {
	const env = options?.env ?? process.env
	const prettyStdout = shouldUsePretty({ env, isPackaged: options?.isPackaged })
	const fileMode = parseLogFileEnv(env.BBPLAYER_LOG_FILE)

	let filePath: string | null

	if (typeof fileMode === 'object') {
		filePath = fileMode.path
	} else if (fileMode === 'default') {
		filePath = requireDefaultFilePath(options?.defaultFilePath)
	} else if (!prettyStdout) {
		filePath = requireDefaultFilePath(options?.defaultFilePath)
	} else {
		filePath = null
	}

	return { prettyStdout, filePath }
}

export function resolveLogDestination(options?: {
	defaultFilePath?: string
	env?: NodeJS.ProcessEnv
	isPackaged?: boolean
}): LogDestination {
	const { filePath } = resolveLogSinks(options)
	if (filePath) {
		return { file: filePath }
	}
	return 'stdout'
}
