import { assert, test } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context.ts'

import { libraryRouter } from './library.ts'

const tracks = [
	{
		id: 't',
		bvid: 'BV1t',
		cid: 1,
		title: '开箱',
		artist: 'A',
		artwork: '',
		duration: 1,
	},
	{
		id: 's',
		bvid: 'BV1s',
		cid: 1,
		title: '【翻唱】夜',
		artist: 'A',
		artwork: '',
		duration: 1,
	},
]

const playlist = {
	id: '1',
	title: '晚间',
	description: '',
	coverUrl: '',
	createdAt: 0,
	updatedAt: 0,
	shareId: null,
	shareRole: null,
	lastShareSyncAt: null,
	tracks,
}

test('library.list 在过滤开启时按歌曲数计数', async () => {
	const playerDb = {
		...mockTrpcContext().playerDb,
		list: () => [
			{
				id: '1',
				title: '晚间',
				description: '',
				coverUrl: '',
				itemCount: 2,
				updatedAt: 0,
				shareId: null,
				shareRole: null,
			},
		],
		get: () => playlist,
	}
	const caller = libraryRouter.createCaller(
		mockTrpcContext({
			store: memoryStore({ filterNonSongs: true }),
			playerDb,
		}),
	)
	const list = await caller.list()
	assert.equal(list[0]?.itemCount, 1)
})

test('library.get 在过滤开启时去掉非歌曲', async () => {
	const playerDb = {
		...mockTrpcContext().playerDb,
		get: () => playlist,
	}
	const caller = libraryRouter.createCaller(
		mockTrpcContext({
			store: memoryStore({ filterNonSongs: true }),
			playerDb,
		}),
	)
	const result = await caller.get({ id: '1' })
	assert.deepEqual(
		result?.tracks.map((item) => item.id),
		['s'],
	)
})

test('library.get 叠上 musicMeta 缓存', async () => {
	const playerDb = {
		...mockTrpcContext().playerDb,
		get: () => playlist,
	}
	const caller = libraryRouter.createCaller(
		mockTrpcContext({
			store: memoryStore({
				musicMeta: {
					s: {
						musicTitle: '夜に駆ける',
						musicArtist: 'YOASOBI',
						sourceHash: 'x',
					},
				},
			}),
			playerDb,
		}),
	)
	const result = await caller.get({ id: '1' })
	const song = result?.tracks.find((item) => item.id === 's')
	assert.equal(song?.title, '【翻唱】夜')
	assert.equal(song?.musicTitle, '夜に駆ける')
	assert.equal(song?.musicArtist, 'YOASOBI')
})
