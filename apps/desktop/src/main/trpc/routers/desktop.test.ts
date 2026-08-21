import assert from 'node:assert/strict'

import { TRPCError } from '@trpc/server'
import { test } from 'vitest'

import { createDesktopEvents } from '../events'

import { desktopRouter } from './desktop'

function testContext(opened: string[] = []) {
	return {
		events: createDesktopEvents(),
		store: {
			get: () => undefined,
			set: () => undefined,
			delete: () => undefined,
		},
		playerDb: {
			list: () => [],
			get: () => null,
			create: () => {
				throw new Error('unused')
			},
			rename: () => undefined,
			delete: () => undefined,
			addTracks: () => undefined,
			removeTrack: () => undefined,
		},
		refreshAccount: async () => null,
		applyAuxSettings: () => undefined,
		refreshShell: () => undefined,
		openExternal: async (url: string) => {
			opened.push(url)
		},
		copyText: () => undefined,
		checkUpdate: async () => ({
			status: 'latest' as const,
			currentVersion: '0.1.0',
			message: '已是最新版本',
		}),
	}
}

test('desktop.openExternal 允许 https 并拒绝非 http(s)', async () => {
	const opened: string[] = []
	const caller = desktopRouter.createCaller(testContext(opened))
	await caller.openExternal({ url: 'https://example.com/path' })
	assert.deepEqual(opened, ['https://example.com/path'])

	await assert.rejects(
		() => caller.openExternal({ url: 'ftp://example.com/file' }),
		(error: unknown) => {
			assert.ok(error instanceof TRPCError)
			assert.equal(error.code, 'BAD_REQUEST')
			return true
		},
	)
	assert.deepEqual(opened, ['https://example.com/path'])
})
