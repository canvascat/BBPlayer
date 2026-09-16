import { assert, test } from 'vitest'

import {
	audioCacheKey,
	generateUniqueTrackKey,
	hasClipWindow,
	parseBilibiliTrackKey,
	sameAudioStream,
} from './bilibili-id.ts'

test('旧单 P / 分 P 键不变', () => {
	assert.equal(generateUniqueTrackKey({ bvid: 'BV1xx' }), 'bilibili::BV1xx')
	assert.equal(
		generateUniqueTrackKey({ bvid: 'BV1xx', cid: 9, isMultiPage: true }),
		'bilibili::BV1xx::9',
	)
})

test('章节键带 round 后的 from/to，含 0', () => {
	assert.equal(
		generateUniqueTrackKey({
			bvid: 'BV1xx',
			cid: 9,
			clipStartSec: 0,
			clipEndSec: 195.4,
		}),
		'bilibili::BV1xx::9::0::195',
	)
})

test('从键还原 clip；非法键为 null', () => {
	assert.deepEqual(parseBilibiliTrackKey('bilibili::BV1xx::9::0::195'), {
		bvid: 'BV1xx',
		cid: 9,
		clipStartSec: 0,
		clipEndSec: 195,
	})
	assert.deepEqual(parseBilibiliTrackKey('bilibili::BV1xx'), { bvid: 'BV1xx' })
	assert.equal(parseBilibiliTrackKey('av123'), null)
})

test('有窗口时音频键不含 from/to', () => {
	assert.equal(
		audioCacheKey({
			bvid: 'BV1xx',
			cid: 9,
			clipStartSec: 0,
			clipEndSec: 195,
		}),
		'bilibili::BV1xx::9',
	)
	assert.equal(audioCacheKey({ bvid: 'BV1xx' }), 'bilibili::BV1xx')
	assert.equal(hasClipWindow({ clipStartSec: 0, clipEndSec: 10 }), true)
	assert.equal(hasClipWindow({ clipStartSec: 0 }), false)
	assert.equal(
		sameAudioStream({ bvid: 'a', cid: 1 }, { bvid: 'a', cid: 1 }),
		true,
	)
	assert.equal(
		sameAudioStream({ bvid: 'a', cid: 1 }, { bvid: 'a', cid: 2 }),
		false,
	)
})
