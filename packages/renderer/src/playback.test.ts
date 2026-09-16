import { test, assert } from 'vitest'

import {
	audioTimeSec,
	clipEnded,
	clipStartSecOf,
	formatClock,
	neighborIndex,
	nextRepeatMode,
	progressDurationMs,
	RepeatMode,
	shuffleOrder,
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
