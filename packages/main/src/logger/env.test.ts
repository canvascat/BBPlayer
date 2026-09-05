import { afterEach, assert, test } from 'vitest'

import {
	mapPrdLogLevel,
	parseLogFileEnv,
	resolveLogLevel,
	shouldUsePretty,
} from './env.ts'

const ORIGINAL = { ...process.env }

afterEach(() => {
	process.env = { ...ORIGINAL }
})

test('resolveLogLevel 默认 warn', () => {
	delete process.env.BBPLAYER_LOG_LEVEL
	assert.equal(resolveLogLevel(), 'warn')
})

test('resolveLogLevel 读 BBPLAYER_LOG_LEVEL 并映射别名', () => {
	process.env.BBPLAYER_LOG_LEVEL = 'verbose'
	assert.equal(resolveLogLevel(), 'debug')
	process.env.BBPLAYER_LOG_LEVEL = 'silly'
	assert.equal(resolveLogLevel(), 'trace')
	process.env.BBPLAYER_LOG_LEVEL = 'nope'
	assert.equal(resolveLogLevel(), 'warn')
})

test('shouldUsePretty 尊重 BBPLAYER_LOG_PRETTY 与 isPackaged', () => {
	process.env.NODE_ENV = 'production'
	process.env.BBPLAYER_LOG_PRETTY = '1'
	assert.equal(shouldUsePretty(), true)
	process.env.BBPLAYER_LOG_PRETTY = '0'
	process.env.NODE_ENV = 'development'
	assert.equal(shouldUsePretty(), false)
	delete process.env.BBPLAYER_LOG_PRETTY
	process.env.NODE_ENV = 'development'
	assert.equal(shouldUsePretty(), true)
	assert.equal(
		shouldUsePretty({
			isPackaged: true,
			env: { NODE_ENV: 'development', BBPLAYER_LOG_PRETTY: '1' },
		}),
		false,
	)
})

test('parseLogFileEnv 解析 off / default / 绝对路径', () => {
	assert.equal(parseLogFileEnv(undefined), 'off')
	assert.equal(parseLogFileEnv(''), 'off')
	assert.equal(parseLogFileEnv('1'), 'default')
	assert.equal(parseLogFileEnv('true'), 'default')
	assert.deepEqual(parseLogFileEnv('/tmp/bbplayer.log'), {
		path: '/tmp/bbplayer.log',
	})
})

test('mapPrdLogLevel 映射 verbose/silly 并透传 pino 级别', () => {
	assert.equal(mapPrdLogLevel('verbose'), 'debug')
	assert.equal(mapPrdLogLevel('silly'), 'trace')
	assert.equal(mapPrdLogLevel('info'), 'info')
	assert.equal(mapPrdLogLevel('NOPE'), 'warn')
})
