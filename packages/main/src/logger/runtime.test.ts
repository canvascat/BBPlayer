import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, assert, test } from 'vitest'

import {
	getDefaultLogFilePath,
	getLogFilePath,
	getLogger,
	initLogger,
	resetLoggerForTests,
	setLogLevel,
} from './runtime.ts'

let tempDir: string

afterEach(() => {
	resetLoggerForTests()
	if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

test('initLogger 后 child 带 name，改级别影响 root', () => {
	tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-rt-'))
	const file = path.join(tempDir, 'bbplayer.log')
	initLogger({
		defaultFilePath: file,
		env: { NODE_ENV: 'production', BBPLAYER_LOG_LEVEL: 'warn' },
	})
	const child = getLogger('renderer')
	assert.equal(child.bindings().name, 'renderer')
	setLogLevel('error')
	assert.equal(getLogger('desktop').level, 'error')
	assert.equal(getDefaultLogFilePath(), file)
	assert.equal(getLogFilePath(), file)
})

test('child 日志行含 app 且 name 只出现一次', async () => {
	tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-rt-'))
	const file = path.join(tempDir, 'bbplayer.log')
	initLogger({
		defaultFilePath: file,
		env: { NODE_ENV: 'production', BBPLAYER_LOG_LEVEL: 'info' },
	})
	getLogger('renderer').info('child-name-once')
	await new Promise((r) => setTimeout(r, 20))
	const line = readFileSync(file, 'utf8')
		.split('\n')
		.find((item) => item.includes('child-name-once'))
	assert.ok(line)
	assert.ok(line.includes('"app":"bbplayer"'))
	assert.ok(line.includes('"name":"renderer"'))
	assert.equal(line.split('"name":').length - 1, 1)
})

test('pretty 未落盘时 getLogFilePath 仍给默认路径', () => {
	tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-rt-'))
	const file = path.join(tempDir, 'bbplayer.log')
	initLogger({
		defaultFilePath: file,
		env: { NODE_ENV: 'development' },
	})
	assert.equal(getLogFilePath(), file)
})
