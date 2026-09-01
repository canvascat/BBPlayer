import type { AmllLyricLine } from '@bbplayer/core'
import { test, assert } from 'vitest'

import {
	applyLyricAuxDisplay,
	lyricLinesHaveRoman,
	lyricLinesHaveTranslation,
	parseLyricAuxPref,
} from './lyric-overlay.ts'

function line(
	partial: Partial<AmllLyricLine> &
		Pick<AmllLyricLine, 'translatedLyric' | 'romanLyric'>,
): AmllLyricLine {
	return {
		words: [{ word: '主词', startTime: 0, endTime: 1000 }],
		startTime: 0,
		endTime: 1000,
		isBG: false,
		isDuet: false,
		...partial,
	}
}

test('空白翻译或读音不算有副轨', () => {
	assert.equal(
		lyricLinesHaveTranslation([line({ translatedLyric: '', romanLyric: '' })]),
		false,
	)
	assert.equal(
		lyricLinesHaveRoman([line({ translatedLyric: '  ', romanLyric: '  ' })]),
		false,
	)
	assert.equal(
		lyricLinesHaveTranslation([
			line({ translatedLyric: '译', romanLyric: '' }),
		]),
		true,
	)
	assert.equal(
		lyricLinesHaveRoman([line({ translatedLyric: '', romanLyric: 'roma' })]),
		true,
	)
})

test('关掉翻译或读音时只清空对应字段', () => {
	const source = [line({ translatedLyric: '译', romanLyric: 'roma' })]
	const hidden = applyLyricAuxDisplay(source, {
		translation: false,
		roman: true,
	})
	assert.equal(hidden[0].translatedLyric, '')
	assert.equal(hidden[0].romanLyric, 'roma')
	assert.equal(hidden[0].words[0].word, '主词')
	assert.equal(source[0].translatedLyric, '译')
})

test('两条都开时复用原数组', () => {
	const source = [line({ translatedLyric: '译', romanLyric: 'roma' })]
	assert.equal(
		applyLyricAuxDisplay(source, { translation: true, roman: true }),
		source,
	)
})

test('未设置偏好时默认打开副轨', () => {
	assert.equal(parseLyricAuxPref(null), true)
	assert.equal(parseLyricAuxPref('false'), false)
	assert.equal(parseLyricAuxPref('0'), false)
	assert.equal(parseLyricAuxPref('1'), true)
})
