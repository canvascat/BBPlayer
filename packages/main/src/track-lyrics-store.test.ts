import { assert, test } from 'vitest'

import { readTrackLyrics, writeTrackLyrics } from './track-lyrics-store.ts'
import { memoryStore } from './trpc/mock-context.ts'

test('按曲目 id 读写歌词，互不覆盖', () => {
	const store = memoryStore()
	writeTrackLyrics(store, 'bilibili::BV::1::0::10', {
		lrc: 'a',
		source: 'netease',
	})
	writeTrackLyrics(store, 'bilibili::BV::1::10::20', {
		lrc: 'b',
		source: 'netease',
	})
	assert.equal(readTrackLyrics(store, 'bilibili::BV::1::0::10')?.lrc, 'a')
	assert.equal(readTrackLyrics(store, 'bilibili::BV::1::10::20')?.lrc, 'b')
})
