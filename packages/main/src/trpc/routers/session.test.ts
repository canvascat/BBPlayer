import { assert, test } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context.ts'

import { sessionRouter } from './session.ts'

const song = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
}
const talk = {
	id: 't',
	bvid: 'BV1t',
	cid: 1,
	title: '开箱',
	artist: 'A',
	artwork: '',
	duration: 1,
}

const body = {
	queue: [talk, song],
	index: 0,
	positionMs: 0,
	repeatMode: 0 as const,
	shuffle: false,
	playbackRate: 1,
}

test('session.get 在过滤开启时去掉非歌曲并映射 index', async () => {
	const store = memoryStore({
		filterNonSongs: true,
		session: body,
	})
	const caller = sessionRouter.createCaller(mockTrpcContext({ store }))
	const result = await caller.get()
	assert.deepEqual(
		result?.queue.map((item) => item.id),
		['s'],
	)
})

test('session.set 在过滤开启且为子集时不覆盖完整队列', async () => {
	const store = memoryStore({
		filterNonSongs: true,
		session: body,
	})
	const caller = sessionRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({
		...body,
		queue: [song],
		index: 0,
	})
	assert.deepEqual(
		store.get('session')?.queue.map((item) => item.id),
		['t', 's'],
	)
})
