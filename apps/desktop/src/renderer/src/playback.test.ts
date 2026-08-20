import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
	neighborIndex,
	nextRepeatMode,
	RepeatMode,
	shuffleOrder,
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
