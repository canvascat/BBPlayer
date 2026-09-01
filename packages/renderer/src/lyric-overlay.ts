import type { AmllLyricLine } from '@bbplayer/core'

export const LYRIC_SHOW_TRANSLATION_KEY = 'bbplayer.lyric-show-translation'
export const LYRIC_SHOW_ROMAN_KEY = 'bbplayer.lyric-show-roman'

function hasAuxText(value: string | undefined) {
	return Boolean(value?.trim())
}

export function parseLyricAuxPref(raw: string | null | undefined) {
	if (raw === '0' || raw === 'false') return false
	return true
}

export function lyricLinesHaveTranslation(lines: AmllLyricLine[]) {
	return lines.some((line) => hasAuxText(line.translatedLyric))
}

export function lyricLinesHaveRoman(lines: AmllLyricLine[]) {
	return lines.some((line) => hasAuxText(line.romanLyric))
}

export function applyLyricAuxDisplay(
	lines: AmllLyricLine[],
	options: { translation: boolean; roman: boolean },
) {
	if (options.translation && options.roman) return lines
	return lines.map((line) => ({
		...line,
		translatedLyric: options.translation ? line.translatedLyric : '',
		romanLyric: options.roman ? line.romanLyric : '',
	}))
}
