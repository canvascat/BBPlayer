import assert from 'node:assert/strict'

import { test } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context'

import { settingsRouter } from './settings'

test('settings.get 返回 store 中的 cookie 与默认值', async () => {
	const caller = settingsRouter.createCaller(
		mockTrpcContext({ store: memoryStore({ cookie: 'SESS=1' }) }),
	)
	const result = await caller.get()
	assert.equal(result.cookie, 'SESS=1')
	assert.equal(result.continuePlayingAfterClose, true)
	assert.equal(result.account, null)
	assert.equal(result.bbplayerAccount, null)
})

test('settings.set 写入 cookie 并刷新账号', async () => {
	const store = memoryStore()
	let refreshed = 0
	const caller = settingsRouter.createCaller(
		mockTrpcContext({
			store,
			refreshAccount: async () => {
				refreshed += 1
				return null
			},
		}),
	)
	const ok = await caller.set({ cookie: 'SESS=2' })
	assert.equal(ok, true)
	assert.equal(store.get('cookie'), 'SESS=2')
	assert.equal(refreshed, 1)
})
