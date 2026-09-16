import { test, assert } from 'vitest'

import {
	audioTimeSec,
	clipAdvanceDecision,
	clipEnded,
	clipStartSecOf,
	formatClock,
	neighborIndex,
	nextRepeatMode,
	playTrackLatch,
	progressDurationMs,
	RepeatMode,
	shuffleOrder,
	shouldKeepAudioSrc,
	uiDurationMs,
	uiTimeMs,
} from './playback.ts'

test('循环模式按关闭 → 单曲 → 列表切换', () => {
	assert.equal(nextRepeatMode(RepeatMode.OFF), RepeatMode.TRACK)
	assert.equal(nextRepeatMode(RepeatMode.TRACK), RepeatMode.QUEUE)
	assert.equal(nextRepeatMode(RepeatMode.QUEUE), RepeatMode.OFF)
})

test('列表循环会从末尾回到开头', () => {
	assert.equal(neighborIndex(3, 2, 1, RepeatMode.QUEUE, null), 0)
	assert.equal(neighborIndex(3, 0, -1, RepeatMode.QUEUE, null), 2)
})

test('关闭循环时末尾不再前进', () => {
	assert.equal(neighborIndex(3, 2, 1, RepeatMode.OFF, null), null)
})

test('随机顺序以当前曲为起点', () => {
	const order = shuffleOrder(5, 2)
	assert.equal(order[0], 2)
	assert.equal(new Set(order).size, 5)
})

test('播放页时钟不补齐分钟位数', () => {
	assert.equal(formatClock(10_000), '0:10')
	assert.equal(formatClock(330_000), '5:30')
	assert.equal(formatClock(-1), '0:00')
})

test('音频尚未给出时长时用曲目秒数，避免进度条 max 退化成 1ms', () => {
	assert.equal(progressDurationMs(0, 280), 280_000)
	assert.equal(progressDurationMs(Number.NaN, 280), 280_000)
	assert.equal(progressDurationMs(Number.POSITIVE_INFINITY, 280), 280_000)
})

test('音频时长有效时优先生效', () => {
	assert.equal(progressDurationMs(181_000, 280), 181_000)
})

test('两边都没有有效时长时仍为 0', () => {
	assert.equal(progressDurationMs(0, 0), 0)
	assert.equal(progressDurationMs(0, -1), 0)
})

const clip = { clipStartSec: 195, clipEndSec: 477, duration: 282 }

test('窗口时间从 clipStart 起算，seek 加回起点并夹紧', () => {
	assert.equal(clipStartSecOf(clip), 195)
	assert.equal(uiTimeMs(195, clip), 0)
	assert.equal(uiTimeMs(200.5, clip), 5500)
	assert.equal(audioTimeSec(0, clip), 195)
	assert.equal(audioTimeSec(10_000, clip), 205)
	assert.equal(audioTimeSec(-1, clip), 195)
	assert.equal(audioTimeSec(999_000, clip), 477)
	assert.equal(uiDurationMs(clip), 282_000)
	assert.equal(clipEnded(477, clip), true)
	assert.equal(clipEnded(476.9, clip), false)
})

test('无窗口时音频时间原样进出', () => {
	assert.equal(uiTimeMs(12, {}), 12_000)
	assert.equal(audioTimeSec(12_000, {}), 12)
	assert.equal(clipEnded(12, {}), false)
})

test('同 cid 且已有 src 时保留', () => {
	assert.equal(
		shouldKeepAudioSrc({ bvid: 'BV1', cid: 1 }, { bvid: 'BV1', cid: 1 }, true),
		true,
	)
	assert.equal(
		shouldKeepAudioSrc({ bvid: 'BV1', cid: 1 }, { bvid: 'BV1', cid: 2 }, true),
		false,
	)
	assert.equal(
		shouldKeepAudioSrc(undefined, { bvid: 'BV1', cid: 1 }, true),
		false,
	)
})

test('越过 clipEnd 且已闩锁时若时间回到窗口内则回臂', () => {
	const latchedPastEnd = clipAdvanceDecision({
		latched: true,
		audioTimeSec: 477,
		track: clip,
		hasNeighbor: true,
		repeat: RepeatMode.OFF,
	})
	assert.deepEqual(latchedPastEnd, { latched: true, action: 'none' })

	const rearmed = clipAdvanceDecision({
		latched: true,
		audioTimeSec: 400,
		track: clip,
		hasNeighbor: true,
		repeat: RepeatMode.OFF,
	})
	assert.deepEqual(rearmed, { latched: false, action: 'none' })
})

test('队尾章末每次 clipEnded 都暂停且不消耗闩锁', () => {
	const first = clipAdvanceDecision({
		latched: false,
		audioTimeSec: 477,
		track: clip,
		hasNeighbor: false,
		repeat: RepeatMode.OFF,
	})
	assert.deepEqual(first, { latched: false, action: 'pause' })

	const again = clipAdvanceDecision({
		latched: first.latched,
		audioTimeSec: 480,
		track: clip,
		hasNeighbor: false,
		repeat: RepeatMode.OFF,
	})
	assert.deepEqual(again, { latched: false, action: 'pause' })
})

test('有下一曲时首次章末消耗闩锁并 skip，已闩锁则不再 skip', () => {
	const first = clipAdvanceDecision({
		latched: false,
		audioTimeSec: 477,
		track: clip,
		hasNeighbor: true,
		repeat: RepeatMode.OFF,
	})
	assert.deepEqual(first, { latched: true, action: 'skip' })

	const held = clipAdvanceDecision({
		latched: true,
		audioTimeSec: 478,
		track: clip,
		hasNeighbor: true,
		repeat: RepeatMode.OFF,
	})
	assert.deepEqual(held, { latched: true, action: 'none' })
})

test('单曲循环章末回起点且不闩锁', () => {
	assert.deepEqual(
		clipAdvanceDecision({
			latched: false,
			audioTimeSec: 477,
			track: clip,
			hasNeighbor: false,
			repeat: RepeatMode.TRACK,
		}),
		{ latched: false, action: 'repeat-track' },
	)
})

test('已闩锁且时间仍在新更早章节 clipEnd 之后时不二次 skip', () => {
	const earlier = { clipStartSec: 10, clipEndSec: 100 }
	assert.deepEqual(
		clipAdvanceDecision({
			latched: true,
			audioTimeSec: 400,
			track: earlier,
			hasNeighbor: true,
			repeat: RepeatMode.OFF,
		}),
		{ latched: true, action: 'none' },
	)
})

test('playTrack 闩锁在切曲完成 seek 前保持，窗口内才回臂', () => {
	assert.equal(playTrackLatch('enter'), true)
	assert.equal(playTrackLatch('before-seek'), true)
	assert.equal(playTrackLatch('after-seek-in-window'), false)
	assert.equal(playTrackLatch('after-seek-past-end'), true)
	assert.equal(playTrackLatch('catch'), false)
})
