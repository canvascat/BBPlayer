import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { TRPCError } from '@trpc/server'
import { test, assert, expect } from 'vitest'

import { initLogger, resetLoggerForTests } from '../../logger/runtime.ts'
import { mockTrpcContext } from '../mock-context'

import { desktopRouter } from './desktop'

test('desktop.openExternal 允许 https 并拒绝非 http(s)', async () => {
	const opened: string[] = []
	const caller = desktopRouter.createCaller(
		mockTrpcContext({
			openExternal: async (url: string) => {
				opened.push(url)
			},
		}),
	)
	await caller.openExternal({ url: 'https://example.com/path' })
	assert.deepEqual(opened, ['https://example.com/path'])

	await expect(
		caller.openExternal({ url: 'ftp://example.com/file' }),
	).rejects.toSatisfy((error: unknown) => {
		assert.ok(error instanceof TRPCError)
		assert.equal(error.code, 'BAD_REQUEST')
		return true
	})
	assert.deepEqual(opened, ['https://example.com/path'])
})

test('desktop.reportLog 写入 renderer 日志并脱敏', async () => {
	const tempDir = mkdtempSync(path.join(tmpdir(), 'bbplayer-rpt-'))
	const file = path.join(tempDir, 'bbplayer.log')
	initLogger({
		defaultFilePath: file,
		env: { NODE_ENV: 'production', BBPLAYER_LOG_LEVEL: 'info' },
	})
	try {
		const caller = desktopRouter.createCaller(mockTrpcContext())
		await caller.reportLog({
			level: 'error',
			message: 'boom',
			context: { cookie: 'SESSDATA=abc', title: 'x' },
			stack: 'Error: boom',
		})
		const body = readFileSync(file, 'utf8')
		assert.ok(body.includes('boom'))
		assert.ok(body.includes('"name":"renderer"'))
		assert.ok(!body.includes('SESSDATA=abc'))
		assert.ok(body.includes('[redacted]'))
	} finally {
		resetLoggerForTests()
		rmSync(tempDir, { recursive: true, force: true })
	}
})

test('desktop.openLogsFolder 调用 context', async () => {
	let opened = 0
	const caller = desktopRouter.createCaller(
		mockTrpcContext({
			openLogsFolder: async () => {
				opened += 1
			},
		}),
	)
	await caller.openLogsFolder()
	assert.equal(opened, 1)
})
