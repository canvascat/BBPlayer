import { assert, test } from 'vitest'

import {
	overlayMusicMeta,
	readMusicMeta,
	writeMusicMeta,
} from './music-meta-store.ts'
import { memoryStore } from './trpc/mock-context.ts'

test('写入后可读，overlay 按 id 叠字段且不改 title', () => {
	const store = memoryStore()
	writeMusicMeta(store, 'bilibili::BV1', {
		musicTitle: '起风了',
		musicArtist: '买辣椒也用券',
		sourceHash: 'abc',
	})
	assert.deepEqual(readMusicMeta(store, 'bilibili::BV1'), {
		musicTitle: '起风了',
		musicArtist: '买辣椒也用券',
		sourceHash: 'abc',
	})
	const tracks = overlayMusicMeta(store, [
		{ id: 'bilibili::BV1', title: '视频标题', artist: 'UP' },
		{ id: 'other', title: '另一首', artist: 'B' },
	])
	assert.equal(tracks[0]?.title, '视频标题')
	assert.equal(tracks[0]?.musicTitle, '起风了')
	assert.equal(tracks[1]?.musicTitle, undefined)
})
