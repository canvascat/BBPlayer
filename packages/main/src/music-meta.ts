import { createHash } from 'node:crypto'

import { preciseMusicNameFromBgm } from './lyric-match.ts'

export const DESC_LIMIT = 2000

export type MusicAiTrack = {
	index: number
	title: string | null
	artist: string | null
	confidence: 'high' | 'low'
	kind: 'original' | 'cover' | 'medley' | 'not_music'
}

export function truncateDesc(desc: string | undefined): string {
	if (!desc) return ''
	return desc.length > DESC_LIMIT ? desc.slice(0, DESC_LIMIT) : desc
}

export function extractBracketTitle(text: string): string | undefined {
	const guillemet = /《(.+?)》/.exec(text)
	if (guillemet?.[1]) return guillemet[1]
	const corner = /「(.+?)」/.exec(text)
	if (corner?.[1]) return corner[1]
	return undefined
}

export function extractFromDescription(desc: string): {
	title?: string
	artist?: string
} {
	const titleMatch = /(?:歌名|曲名|曲)\s*[：:]\s*(.+)/.exec(desc)
	const artistMatch = /(?:原唱|翻唱)\s*[：:]\s*(.+)/.exec(desc)
	const result: { title?: string; artist?: string } = {}
	const title = titleMatch?.[1]?.trim()
	const artist = artistMatch?.[1]?.trim()
	if (title) result.title = title
	if (artist) result.artist = artist
	return result
}

export function ruleGuess(input: {
	part: string
	videoTitle: string
	desc: string
}): { title?: string; artist?: string } {
	const title =
		extractBracketTitle(input.part) ?? extractBracketTitle(input.videoTitle)
	const { artist } = extractFromDescription(input.desc)
	const result: { title?: string; artist?: string } = {}
	if (title) result.title = title
	if (artist) result.artist = artist
	return result
}

export function musicSourceHash(input: {
	title: string
	desc: string
	parts: string[]
}): string {
	return createHash('sha256')
		.update(JSON.stringify(input))
		.digest('hex')
		.slice(0, 16)
}

function isMusicAiTrack(value: unknown): value is MusicAiTrack {
	if (!value || typeof value !== 'object') return false
	const track = value as Record<string, unknown>
	return (
		Number.isInteger(track.index) &&
		(track.index as number) > 0 &&
		(typeof track.title === 'string' || track.title === null) &&
		(typeof track.artist === 'string' || track.artist === null) &&
		(track.confidence === 'high' || track.confidence === 'low') &&
		(track.kind === 'original' ||
			track.kind === 'cover' ||
			track.kind === 'medley' ||
			track.kind === 'not_music')
	)
}

export function parseMusicAiPayload(raw: string): MusicAiTrack[] | null {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return null
	}
	if (!parsed || typeof parsed !== 'object') return null
	const tracks = (parsed as { tracks?: unknown }).tracks
	if (!Array.isArray(tracks) || tracks.length === 0) return null
	if (!tracks.every(isMusicAiTrack)) return null
	return tracks
}

export function mergePageMeta(
	rule: { title?: string; artist?: string },
	ai: MusicAiTrack | undefined,
): { musicTitle?: string; musicArtist?: string } {
	const result: { musicTitle?: string; musicArtist?: string } = {}

	if (rule.title) {
		result.musicTitle = rule.title
	} else if (
		ai &&
		ai.confidence === 'high' &&
		ai.kind !== 'not_music' &&
		ai.title
	) {
		result.musicTitle = ai.title
	}

	if (ai && ai.confidence === 'high' && ai.kind !== 'not_music' && ai.artist) {
		result.musicArtist = ai.artist
	}

	return result
}

export function lyricSearchInput(
	track: { title: string; musicTitle?: string },
	bgmTitle?: string | null,
): { title: string; preciseKeyword?: string } {
	const fromBgm = preciseMusicNameFromBgm(bgmTitle)
	if (fromBgm) {
		return { title: track.title, preciseKeyword: fromBgm }
	}
	if (track.musicTitle) {
		return { title: track.title, preciseKeyword: track.musicTitle }
	}
	return { title: track.title }
}
