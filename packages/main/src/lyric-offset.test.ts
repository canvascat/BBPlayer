import { generateUniqueTrackKey } from '@bbplayer/core'
import { assert, test } from 'vitest'

import {
	readLyricOffset,
	trackIdForOffset,
	writeLyricOffset,
} from './lyric-offset.ts'
import { memoryStore } from './trpc/mock-context.ts'

test('缺 id 时与 resolvePlay 同一套键', () => {
	assert.equal(
		trackIdForOffset({ bvid: 'BV1xx', cid: 9 }),
		generateUniqueTrackKey({
			bvid: 'BV1xx',
			cid: 9,
			isMultiPage: true,
		}),
	)
	assert.equal(
		trackIdForOffset({ id: 'bilibili::BV1aa', bvid: 'BV1xx', cid: 9 }),
		'bilibili::BV1aa',
	)
})

test('写偏移、夹紧、回 0 删键，换词不影响', () => {
	const store = memoryStore()
	assert.equal(readLyricOffset(store, 't1'), 0)
	assert.equal(writeLyricOffset(store, 't1', 1), 1)
	assert.equal(readLyricOffset(store, 't1'), 1)
	assert.equal(writeLyricOffset(store, 't1', 10.4), 10)
	assert.equal(writeLyricOffset(store, 't1', 0), 0)
	assert.equal(store.get('lyricOffsets')?.t1, undefined)
	assert.equal(writeLyricOffset(store, 't1', -0.5), -0.5)
	assert.equal(readLyricOffset(store, 't1'), -0.5)
})
