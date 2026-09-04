import { assert, test } from 'vitest'

import {
	filterPlaySession,
	filterSongItems,
	filterVideoPayload,
	mergePlaySessionSet,
	readFilterNonSongs,
} from './filter-non-songs.ts'
import type { PlaySession } from './store.ts'
import { memoryStore } from './trpc/mock-context.ts'

const song = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
	tid: 31,
}
const talk = {
	id: 't',
	bvid: 'BV1t',
	cid: 1,
	title: '开箱',
	artist: 'A',
	artwork: '',
	duration: 1,
	tid: 17,
}

test('开关关闭不过滤', () => {
	assert.equal(readFilterNonSongs(memoryStore()), false)
	assert.equal(filterSongItems(false, [talk]).length, 1)
})

test('开关打开丢掉非歌曲', () => {
	assert.deepEqual(
		filterSongItems(true, [talk, song]).map((item) => item.id),
		['s'],
	)
})

test('非歌曲稿件详情 pages 清空并标记 filtered', () => {
	const result = filterVideoPayload(true, {
		tid: 17,
		title: '开箱',
		pages: [{ cid: 1 }],
	})
	assert.equal(result.filtered, true)
	assert.deepEqual(result.pages, [])
})

test('歌曲稿件不过滤 pages', () => {
	const pages = [{ cid: 1 }]
	const result = filterVideoPayload(true, {
		tid: 31,
		title: '开箱',
		pages,
	})
	assert.equal(result.filtered, false)
	assert.equal(result.pages, pages)
})

function session(queue: PlaySession['queue'], index: number): PlaySession {
	return {
		queue,
		index,
		positionMs: 10,
		repeatMode: 0,
		shuffle: false,
		playbackRate: 1,
	}
}

test('session 当前曲是歌曲时映射到过滤后下标', () => {
	const next = filterPlaySession(true, session([talk, song], 1))
	assert.deepEqual(
		next.queue.map((item) => item.id),
		['s'],
	)
	assert.equal(next.index, 0)
})

test('session 当前曲被滤掉则落到后面的歌曲', () => {
	const later = { ...song, id: 's2' }
	const next = filterPlaySession(true, session([talk, song, later], 0))
	assert.equal(next.queue[next.index]?.id, 's')
})

test('session 后面没有歌曲则 index 越界以清空当前曲', () => {
	const next = filterPlaySession(true, session([song, talk], 1))
	assert.deepEqual(
		next.queue.map((item) => item.id),
		['s'],
	)
	assert.equal(next.index, next.queue.length)
	assert.equal(next.queue[next.index], undefined)
})

test('session 全是非歌曲则空队列', () => {
	const next = filterPlaySession(true, session([talk], 0))
	assert.deepEqual(next.queue, [])
	assert.equal(next.index, 0)
})

test('set 在过滤开启且为子集时保留隐藏曲', () => {
	const stored = session([talk, song], 0)
	const incoming = session([song], 0)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['t', 's'],
	)
	assert.equal(merged.queue[merged.index]?.id, 's')
})

test('set 换了一轮队列则整份覆盖', () => {
	const stored = session([talk, song], 0)
	const other = { ...song, id: 'x', bvid: 'BVx' }
	const incoming = session([other], 0)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['x'],
	)
})

test('set 过滤开启时追加新歌曲并保留隐藏曲', () => {
	const stored = session([talk, song], 0)
	const extra = { ...song, id: 's2', bvid: 'BV1s2' }
	const incoming = session([song, extra], 1)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['t', 's', 's2'],
	)
	assert.equal(merged.queue[merged.index]?.id, 's2')
})

test('set 过滤开启时从可见子集删歌并保留隐藏曲', () => {
	const extra = { ...song, id: 's2', bvid: 'BV1s2' }
	const stored = session([talk, song, extra], 0)
	const incoming = session([song], 0)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['t', 's'],
	)
	assert.equal(merged.queue[merged.index]?.id, 's')
})

test('set 过滤开启且上报空队列则保留已存队列', () => {
	const stored = session([talk, song], 1)
	const incoming = session([], 0)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['t', 's'],
	)
	assert.equal(merged.positionMs, incoming.positionMs)
	assert.equal(merged.index, 0)
})
