import { trpcClient } from './trpc'

type Level = 'error' | 'warn' | 'info' | 'debug'

async function report(
	level: Level,
	message: string,
	context?: Record<string, unknown>,
) {
	try {
		await trpcClient.desktop.reportLog.mutate({
			level,
			message,
			context,
			stack: typeof context?.stack === 'string' ? context.stack : undefined,
		})
	} catch (error) {
		const write = level === 'error' ? console.error : console.warn
		write('[log]', message, error)
	}
}

export const log = {
	error(message: string, context?: Record<string, unknown>) {
		void report('error', message, context)
	},
	warn(message: string, context?: Record<string, unknown>) {
		void report('warn', message, context)
	},
	info(message: string, context?: Record<string, unknown>) {
		void report('info', message, context)
	},
	debug(message: string, context?: Record<string, unknown>) {
		void report('debug', message, context)
	},
}

export function installRendererErrorHandlers() {
	window.addEventListener('error', (event) => {
		log.error(event.message, {
			stack: event.error instanceof Error ? event.error.stack : undefined,
		})
	})
	window.addEventListener('unhandledrejection', (event) => {
		const reason = event.reason
		log.error(reason instanceof Error ? reason.message : String(reason), {
			stack: reason instanceof Error ? reason.stack : undefined,
		})
	})
}
