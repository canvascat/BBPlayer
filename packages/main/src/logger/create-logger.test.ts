import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, assert, test } from 'vitest'

import { createLogger } from './create-logger.ts'

let tempDir: string

afterEach(() => {
	if (tempDir) rmSync(tempDir, { recursive: true, force: true })
})

test('非 pretty 时按级别写 JSON 行', async () => {
	tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-log-'))
	const file = path.join(tempDir, 'logs', 'bbplayer.log')
	const log = createLogger({
		name: 'test',
		level: 'warn',
		defaultFilePath: file,
		env: { NODE_ENV: 'production', BBPLAYER_LOG_LEVEL: 'warn' },
	})
	log.warn({ ok: true }, 'hello-file')
	log.info('should-not-appear')
	await new Promise((r) => setTimeout(r, 20))
	const body = readFileSync(file, 'utf8')
	assert.ok(body.includes('hello-file'))
	assert.ok(!body.includes('should-not-appear'))
	assert.ok(body.includes('"name":"test"'))
})

test('为日志文件创建父目录', () => {
	tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-log-'))
	const file = path.join(tempDir, 'a', 'b', 'bbplayer.log')
	const log = createLogger({
		defaultFilePath: file,
		env: { NODE_ENV: 'production' },
	})
	log.error('mkdir-ok')
	assert.ok(readFileSync(file, 'utf8').includes('mkdir-ok'))
})

test('写入时脱敏 cookie', async () => {
	tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-log-'))
	const file = path.join(tempDir, 'logs', 'bbplayer.log')
	const log = createLogger({
		level: 'warn',
		defaultFilePath: file,
		env: { NODE_ENV: 'production', BBPLAYER_LOG_LEVEL: 'warn' },
	})
	log.warn({ cookie: 'SESSDATA=abc' }, 'x')
	await new Promise((r) => setTimeout(r, 20))
	const body = readFileSync(file, 'utf8')
	assert.ok(!body.includes('SESSDATA=abc'))
	assert.ok(body.includes('[redacted]'))
})
