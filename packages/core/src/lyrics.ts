import type { LyricLine as SplLyricLine } from '@bbplayer/splash'

export interface AmllLyricWord {
	word: string
	startTime: number
	endTime: number
	romanWord?: string
}

export interface AmllLyricLine {
	words: AmllLyricWord[]
	translatedLyric: string
	romanLyric: string
	startTime: number
	endTime: number
	isBG: boolean
	isDuet: boolean
}

export function splLinesToAmll(lines: SplLyricLine[]): AmllLyricLine[] {
	return lines.map((line) => {
		const words: AmllLyricWord[] =
			line.isDynamic && line.spans.length > 0
				? line.spans.map((span) => ({
						word: span.text,
						startTime: span.startTime,
						endTime: span.endTime,
					}))
				: [
						{
							word: line.content,
							startTime: line.startTime,
							endTime: line.endTime,
						},
					]
		return {
			words,
			translatedLyric: line.translation ?? '',
			romanLyric: line.romaji ?? '',
			startTime: line.startTime,
			endTime: line.endTime,
			isBG: false,
			isDuet: false,
		}
	})
}
