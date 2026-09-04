import { createHash } from 'node:crypto'

import { preciseMusicNameFromBgm } from './lyric-match.ts'
import { readMusicMeta, writeMusicMeta } from './music-meta-store.ts'
import type { TrpcStore } from './trpc/context.ts'

export const DESC_LIMIT = 2000
export const DEFAULT_MUSIC_AI_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'
export const DEFAULT_MUSIC_AI_MODEL = 'glm-4-flash'

export type MusicPageInput = { id: string; part: string }

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
	const fromDesc = extractFromDescription(input.desc)
	const title =
		extractBracketTitle(input.part) ??
		extractBracketTitle(input.videoTitle) ??
		fromDesc.title
	const result: { title?: string; artist?: string } = {}
	if (title) result.title = title
	if (fromDesc.artist) result.artist = fromDesc.artist
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

function aiUsable(ai: MusicAiTrack | undefined): ai is MusicAiTrack {
	return !!ai && ai.confidence === 'high' && ai.kind !== 'not_music'
}

export function mergePageMeta(
	rule: { title?: string; artist?: string },
	ai: MusicAiTrack | undefined,
): { musicTitle?: string; musicArtist?: string } {
	const result: { musicTitle?: string; musicArtist?: string } = {}
	const usable = aiUsable(ai)

	if (rule.title) {
		result.musicTitle = rule.title
	} else if (usable && ai.title) {
		result.musicTitle = ai.title
	}

	if (usable && ai.artist) {
		result.musicArtist = ai.artist
	} else if (rule.artist) {
		result.musicArtist = rule.artist
	}

	return result
}

type CompleteMusicAi = typeof import('./music-ai.ts').completeMusicAi

export async function fillMusicFields(
	input: {
		bvid: string
		title: string
		desc?: string
		ownerName: string
		pages: MusicPageInput[]
		isMultiPage: boolean
	},
	deps: {
		store: Pick<TrpcStore, 'get' | 'set'>
		complete?: CompleteMusicAi
	},
): Promise<Array<{ id: string; musicTitle?: string; musicArtist?: string }>> {
	const desc = truncateDesc(input.desc)
	const hash = musicSourceHash({
		title: input.title,
		desc,
		parts: input.pages.map((page) => page.part),
	})

	const cached = input.pages.map((page) => readMusicMeta(deps.store, page.id))
	if (
		cached.length === input.pages.length &&
		cached.every((entry) => entry?.sourceHash === hash)
	) {
		return input.pages.map((page, index) => {
			const entry = cached[index]!
			const result: {
				id: string
				musicTitle?: string
				musicArtist?: string
			} = { id: page.id }
			if (entry.musicTitle) result.musicTitle = entry.musicTitle
			if (entry.musicArtist) result.musicArtist = entry.musicArtist
			return result
		})
	}

	const rules = input.pages.map((page) =>
		ruleGuess({
			part: page.part,
			videoTitle: input.title,
			desc,
		}),
	)
	const apiKey = deps.store.get('musicAiApiKey')?.trim()
	const needsAi = rules.some((rule) => !rule.title || !rule.artist)
	let tracks: MusicAiTrack[] | null | undefined

	if (needsAi && apiKey) {
		const complete =
			deps.complete ?? (await import('./music-ai.ts')).completeMusicAi
		try {
			tracks = await complete(
				{
					title: input.title,
					desc,
					ownerName: input.ownerName,
					pages: input.pages.map((page, index) => ({
						index: index + 1,
						part: page.part,
					})),
				},
				{
					baseUrl:
						deps.store.get('musicAiBaseUrl')?.trim() ||
						DEFAULT_MUSIC_AI_BASE_URL,
					apiKey,
					model:
						deps.store.get('musicAiModel')?.trim() || DEFAULT_MUSIC_AI_MODEL,
				},
			)
		} catch {
			tracks = undefined
		}
	}

	const aiByIndex = new Map((tracks ?? []).map((track) => [track.index, track]))

	return input.pages.map((page, index) => {
		const merged = mergePageMeta(rules[index], aiByIndex.get(index + 1))
		writeMusicMeta(deps.store, page.id, { ...merged, sourceHash: hash })
		return { id: page.id, ...merged }
	})
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
