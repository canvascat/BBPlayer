import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assert, test, vi } from 'vitest'

const logError = vi.fn()

vi.mock('./logger.ts', () => ({
	log: {
		error: logError,
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}))

const { ErrorBoundary } = await import('./error-boundary.tsx')

test('componentDidCatch 上报 error.message、stack 与 componentStack', () => {
	logError.mockReset()
	const boundary = new ErrorBoundary({ children: null })
	const error = new Error('ui crash')
	boundary.componentDidCatch(error, { componentStack: 'at Boom' })
	assert.deepEqual(logError.mock.calls[0], [
		'ui crash',
		{ stack: error.stack, componentStack: 'at Boom' },
	])
})

test('回退文案为「界面出错了」且按钮为「重新加载」', () => {
	const source = readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), 'error-boundary.tsx'),
		'utf8',
	)
	assert.match(source, /界面出错了/)
	assert.match(source, /重新加载/)
	assert.match(source, /window\.location\.reload\(\)/)
	assert.match(source, /class ErrorBoundary/)
})
