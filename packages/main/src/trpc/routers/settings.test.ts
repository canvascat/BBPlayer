import { test, assert } from 'vitest'

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
	assert.equal(result.lyricSource, 'netease')
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

test('settings.set 写入歌词源', async () => {
	const store = memoryStore()
	const caller = settingsRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({ lyricSource: 'auto' })
	assert.equal(store.get('lyricSource'), 'auto')
	assert.equal((await caller.get()).lyricSource, 'auto')
})

test('settings.get 默认 filterNonSongs 为 false', async () => {
	const caller = settingsRouter.createCaller(
		mockTrpcContext({ store: memoryStore() }),
	)
	assert.equal((await caller.get()).filterNonSongs, false)
})

test('settings.set 写入 filterNonSongs', async () => {
	const store = memoryStore()
	const caller = settingsRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({ filterNonSongs: true })
	assert.equal(store.get('filterNonSongs'), true)
	assert.equal((await caller.get()).filterNonSongs, true)
})

test('settings.get 默认曲目解析为空 Key 和智谱 Flash', async () => {
	const caller = settingsRouter.createCaller(
		mockTrpcContext({ store: memoryStore() }),
	)
	const result = await caller.get()
	assert.equal(result.musicAiApiKey, '')
	assert.equal(result.musicAiModel, 'glm-4-flash')
	assert.equal(result.musicAiBaseUrl, 'https://open.bigmodel.cn/api/paas/v4/')
})

test('settings.set 写入曲目解析三项', async () => {
	const store = memoryStore()
	const caller = settingsRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({
		musicAiApiKey: 'sk-1',
		musicAiModel: 'glm-4.5-flash',
		musicAiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
	})
	assert.equal(store.get('musicAiApiKey'), 'sk-1')
	assert.equal((await caller.get()).musicAiModel, 'glm-4.5-flash')
})
