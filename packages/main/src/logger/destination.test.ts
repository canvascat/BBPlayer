import { afterEach, assert, test } from 'vitest'

import { resolveLogDestination, resolveLogSinks } from './destination.ts'

const ORIGINAL = { ...process.env }

afterEach(() => {
	process.env = { ...ORIGINAL }
})

test('dev pretty 默认只 stdout', () => {
	process.env.NODE_ENV = 'development'
	delete process.env.BBPLAYER_LOG_FILE
	delete process.env.BBPLAYER_LOG_PRETTY
	assert.deepEqual(resolveLogSinks({ defaultFilePath: '/tmp/x.log' }), {
		prettyStdout: true,
		filePath: null,
	})
})

test('BBPLAYER_LOG_FILE=1 时 pretty 与默认文件双写', () => {
	process.env.NODE_ENV = 'development'
	process.env.BBPLAYER_LOG_FILE = '1'
	assert.deepEqual(resolveLogSinks({ defaultFilePath: '/tmp/x.log' }), {
		prettyStdout: true,
		filePath: '/tmp/x.log',
	})
})

test('非 pretty 走默认路径', () => {
	process.env.NODE_ENV = 'production'
	delete process.env.BBPLAYER_LOG_FILE
	assert.deepEqual(
		resolveLogSinks({ defaultFilePath: '/data/logs/bbplayer.log' }),
		{ prettyStdout: false, filePath: '/data/logs/bbplayer.log' },
	)
})

test('绝对 BBPLAYER_LOG_FILE 优先', () => {
	process.env.NODE_ENV = 'production'
	process.env.BBPLAYER_LOG_FILE = '/var/log/bbplayer.log'
	assert.equal(
		resolveLogSinks({ defaultFilePath: '/data/logs/bbplayer.log' }).filePath,
		'/var/log/bbplayer.log',
	)
})

test('需要文件但缺少 defaultFilePath 时抛错', () => {
	process.env.NODE_ENV = 'production'
	delete process.env.BBPLAYER_LOG_FILE
	assert.throws(() => resolveLogSinks(), /defaultFilePath/)
})

test('resolveLogDestination 映射 stdout 或 file', () => {
	process.env.NODE_ENV = 'development'
	delete process.env.BBPLAYER_LOG_FILE
	assert.equal(
		resolveLogDestination({ defaultFilePath: '/tmp/x.log' }),
		'stdout',
	)
	process.env.NODE_ENV = 'production'
	assert.deepEqual(resolveLogDestination({ defaultFilePath: '/tmp/x.log' }), {
		file: '/tmp/x.log',
	})
})
