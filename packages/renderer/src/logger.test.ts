import { assert, test, vi } from 'vitest'

const mutate = vi.fn()

vi.mock('./trpc.ts', () => ({
	trpcClient: {
		desktop: {
			reportLog: { mutate },
		},
	},
}))

const { log, installRendererErrorHandlers } = await import('./logger.ts')

async function flushReport() {
	await vi.waitFor(() => {
		assert.ok(mutate.mock.calls.length > 0)
	})
}

test('log.error 经 desktop.reportLog 上报 message 与 context', async () => {
	mutate.mockReset().mockResolvedValue(undefined)
	log.error('boom', { title: 'x' })
	await flushReport()
	assert.deepEqual(mutate.mock.calls[0]?.[0], {
		level: 'error',
		message: 'boom',
		context: { title: 'x' },
		stack: undefined,
	})
})

test('context.stack 为字符串时单独传给 reportLog', async () => {
	mutate.mockReset().mockResolvedValue(undefined)
	log.warn('oops', { stack: 'Error: oops' })
	await flushReport()
	assert.deepEqual(mutate.mock.calls[0]?.[0], {
		level: 'warn',
		message: 'oops',
		context: { stack: 'Error: oops' },
		stack: 'Error: oops',
	})
})

test('log.info 与 log.debug 使用对应级别', async () => {
	mutate.mockReset().mockResolvedValue(undefined)
	log.info('hello')
	await flushReport()
	assert.equal(mutate.mock.calls[0]?.[0].level, 'info')
	mutate.mockReset().mockResolvedValue(undefined)
	log.debug('trace-ish')
	await flushReport()
	assert.equal(mutate.mock.calls[0]?.[0].level, 'debug')
})

test('上报失败时 error 只写 console.error，不再调用 log.*', async () => {
	mutate.mockReset().mockRejectedValue(new Error('offline'))
	const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
	const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
	log.error('boom')
	await vi.waitFor(() => {
		assert.equal(errorSpy.mock.calls.length, 1)
	})
	assert.equal(errorSpy.mock.calls[0]?.[0], '[log]')
	assert.equal(errorSpy.mock.calls[0]?.[1], 'boom')
	assert.equal(warnSpy.mock.calls.length, 0)
	assert.equal(mutate.mock.calls.length, 1)
	errorSpy.mockRestore()
	warnSpy.mockRestore()
})

test('上报失败时非 error 级别写 console.warn', async () => {
	mutate.mockReset().mockRejectedValue(new Error('offline'))
	const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
	const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
	log.debug('quiet')
	await vi.waitFor(() => {
		assert.equal(warnSpy.mock.calls.length, 1)
	})
	assert.equal(warnSpy.mock.calls[0]?.[0], '[log]')
	assert.equal(errorSpy.mock.calls.length, 0)
	errorSpy.mockRestore()
	warnSpy.mockRestore()
})

test('window error 与 unhandledrejection 上报 log.error', async () => {
	mutate.mockReset().mockResolvedValue(undefined)
	const listeners = new Map<string, Array<(event: object) => void>>()
	vi.stubGlobal('window', {
		addEventListener(type: string, handler: (event: object) => void) {
			const list = listeners.get(type) ?? []
			list.push(handler)
			listeners.set(type, list)
		},
	})
	installRendererErrorHandlers()
	const thrown = new Error('window boom')
	listeners.get('error')?.[0]?.({
		message: 'window boom',
		error: thrown,
	})
	await flushReport()
	assert.deepEqual(mutate.mock.calls[0]?.[0], {
		level: 'error',
		message: 'window boom',
		context: { stack: thrown.stack },
		stack: thrown.stack,
	})
	mutate.mockReset().mockResolvedValue(undefined)
	const rejected = new Error('unhandled')
	listeners.get('unhandledrejection')?.[0]?.({ reason: rejected })
	await flushReport()
	assert.deepEqual(mutate.mock.calls[0]?.[0], {
		level: 'error',
		message: 'unhandled',
		context: { stack: rejected.stack },
		stack: rejected.stack,
	})
	vi.unstubAllGlobals()
})
