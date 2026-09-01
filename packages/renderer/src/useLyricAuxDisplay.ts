import { useCallback, useState } from 'react'

import {
	LYRIC_SHOW_ROMAN_KEY,
	LYRIC_SHOW_TRANSLATION_KEY,
	parseLyricAuxPref,
} from './lyric-overlay'

function readPref(key: string) {
	if (typeof localStorage === 'undefined') return true
	return parseLyricAuxPref(localStorage.getItem(key))
}

export function useLyricAuxDisplay() {
	const [translation, setTranslationState] = useState(() =>
		readPref(LYRIC_SHOW_TRANSLATION_KEY),
	)
	const [roman, setRomanState] = useState(() => readPref(LYRIC_SHOW_ROMAN_KEY))

	const setTranslation = useCallback((next: boolean) => {
		setTranslationState(next)
		localStorage.setItem(LYRIC_SHOW_TRANSLATION_KEY, next ? '1' : '0')
	}, [])

	const setRoman = useCallback((next: boolean) => {
		setRomanState(next)
		localStorage.setItem(LYRIC_SHOW_ROMAN_KEY, next ? '1' : '0')
	}, [])

	return { translation, roman, setTranslation, setRoman }
}
