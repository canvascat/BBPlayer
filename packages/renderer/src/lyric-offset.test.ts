import { assert, test } from 'vitest'

import {
	clampLyricOffset,
	formatLyricOffset,
	lyricClockMs,
	lyricSeekMs,
	stepLyricOffset,
} from './lyric-offset.ts'
import { currentLyricText } from './lyric-text.ts'

test('步进 0.5 并夹在 ±10', () => {
	assert.equal(stepLyricOffset(0, 1), 0.5)
	assert.equal(stepLyricOffset(0, -1), -0.5)
	assert.equal(stepLyricOffset(10, 1), 10)
	assert.equal(stepLyricOffset(-10, -1), -10)
	assert.equal(clampLyricOffset(10.4), 10)
	assert.equal(clampLyricOffset(-10.4), -10)
})

test('正数让歌词时钟落后于播放进度', () => {
	assert.equal(lyricClockMs(11_000, 1), 10_000)
	assert.equal(lyricClockMs(10_000, -0.5), 10_500)
	assert.equal(lyricSeekMs(10_000, 1), 11_000)
	assert.equal(lyricSeekMs(10_000, -0.5), 9500)
})

test('偏移文案带符号和一位小数', () => {
	assert.equal(formatLyricOffset(0), '0.0s')
	assert.equal(formatLyricOffset(1), '+1.0s')
	assert.equal(formatLyricOffset(-0.5), '-0.5s')
})

test('菜单栏当前句与滚动共用歌词时钟', () => {
	const lines = [
		{ startTime: 0, words: [{ word: '前' }] },
		{ startTime: 10_000, words: [{ word: '中' }] },
	]
	assert.equal(currentLyricText(lines, lyricClockMs(10_500, 1)), '前')
	assert.equal(currentLyricText(lines, lyricClockMs(11_000, 1)), '中')
})
