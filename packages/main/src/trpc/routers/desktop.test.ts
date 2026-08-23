import { TRPCError } from '@trpc/server'
import { test, assert, expect } from 'vitest'

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
