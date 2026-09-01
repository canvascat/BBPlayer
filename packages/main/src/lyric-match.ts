import { parseYrc } from '@bbplayer/core'

export type LyricSource = 'auto' | 'netease' | 'qqmusic' | 'kugou'
export type LyricProviderName = 'netease' | 'qqmusic' | 'kugou'

export interface LyricPayload {
	lrc: string
	tlyric?: string
	romalrc?: string
	source: LyricProviderName
}

export interface NeteaseLyricResponse {
	lrc?: { lyric?: string }
	tlyric?: { lyric?: string }
	romalrc?: { lyric?: string }
	yrc?: { lyric?: string }
	ytlrc?: { lyric?: string }
	yromalrc?: { lyric?: string }
}

export function parseLyricSource(value: unknown): LyricSource {
	if (
		value === 'auto' ||
		value === 'netease' ||
		value === 'qqmusic' ||
		value === 'kugou'
	) {
		return value
	}
	return 'netease'
}

export function providersForLyricSource(
	source: LyricSource,
): LyricProviderName[] {
	if (source === 'auto') return ['netease', 'qqmusic', 'kugou']
	return [source]
}

export function cleanKeyword(keyword: string) {
	const priority = /《(.+?)》|「(.+?)」/.exec(keyword)
	if (priority?.[1] || priority?.[2])
		return priority[1] || priority[2] || keyword
	const replaced = keyword.replace(/【.*?】|“.*?”/g, '').trim()
	return replaced || keyword
}

export function resolveLyricKeyword(title: string, preciseKeyword?: string) {
	const precise = preciseKeyword?.trim()
	if (precise) return precise
	return cleanKeyword(title)
}

export function preciseMusicNameFromBgm(musicTitle?: string | null) {
	if (!musicTitle?.trim()) return undefined
	const filtered = /《(.+?)》/.exec(musicTitle)
	return filtered?.[1] || musicTitle
}

export function parseNeteaseLyrics(lyricsResponse: NeteaseLyricResponse) {
	const yrc = lyricsResponse.yrc?.lyric
	const haveYrc = Boolean(yrc)
	const lrc = haveYrc && yrc ? yrc : (lyricsResponse.lrc?.lyric ?? '')
	const tlrc = haveYrc
		? lyricsResponse.ytlrc?.lyric
		: lyricsResponse.tlyric?.lyric
	const romalrc = haveYrc
		? lyricsResponse.yromalrc?.lyric
		: lyricsResponse.romalrc?.lyric
	return {
		lrc: parseYrc(lrc),
		tlyric: tlrc ? parseYrc(tlrc) : undefined,
		romalrc: romalrc ? parseYrc(romalrc) : undefined,
	}
}

export async function raceLyricProviders(
	names: LyricProviderName[],
	run: (
		name: LyricProviderName,
		signal: AbortSignal,
	) => Promise<LyricPayload | null>,
): Promise<LyricPayload | null> {
	if (names.length === 0) return null
	const controllers = names.map(() => new AbortController())
	const tasks = names.map((name, index) =>
		run(name, controllers[index].signal).then((payload) => {
			if (!payload?.lrc) throw new Error('empty lyrics')
			for (const [i, controller] of controllers.entries()) {
				if (i !== index) controller.abort()
			}
			return payload
		}),
	)
	try {
		return await Promise.any(tasks)
	} catch {
		return null
	}
}
