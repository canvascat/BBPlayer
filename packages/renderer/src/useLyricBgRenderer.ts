import { useCallback, useState } from 'react'

import {
	LYRIC_BG_STORAGE_KEY,
	parseLyricBgRenderer,
	type LyricBgRendererKind,
} from './lyric-bg-renderer'

export function useLyricBgRenderer() {
	const [kind, setKindState] = useState<LyricBgRendererKind>(() =>
		parseLyricBgRenderer(
			typeof localStorage === 'undefined'
				? null
				: localStorage.getItem(LYRIC_BG_STORAGE_KEY),
		),
	)

	const setKind = useCallback((next: LyricBgRendererKind) => {
		setKindState(next)
		localStorage.setItem(LYRIC_BG_STORAGE_KEY, next)
	}, [])

	return [kind, setKind] as const
}
