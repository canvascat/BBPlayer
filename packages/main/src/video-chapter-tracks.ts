import { generateUniqueTrackKey, normalizeViewPoints } from '@bbplayer/core'

import type { LibraryTrack } from './db/types.ts'
import { fillMusicFields } from './music-meta.ts'
import type { TrpcStore } from './trpc/context.ts'

type CompleteMusicAi = typeof import('./music-ai.ts').completeMusicAi

export type ExpandChapterTracksInput = {
	bvid: string
	cid: number
	videoTitle: string
	videoDuration: number
	tid?: number
	artist: string
	artwork: string
	desc?: string
	ownerName: string
	points: unknown
}

export async function expandChapterTracks(
	input: ExpandChapterTracksInput,
	deps: {
		store: Pick<TrpcStore, 'get' | 'set'>
		complete?: CompleteMusicAi
	},
): Promise<LibraryTrack[] | null> {
	const chapters = normalizeViewPoints(input.points, input.videoDuration)
	if (chapters.length === 0) return null

	const tracks: LibraryTrack[] = chapters.map((chapter) => ({
		id: generateUniqueTrackKey({
			bvid: input.bvid,
			cid: input.cid,
			clipStartSec: chapter.from,
			clipEndSec: chapter.to,
		}),
		bvid: input.bvid,
		cid: input.cid,
		title: chapter.content,
		artist: input.artist,
		artwork: input.artwork,
		duration: chapter.to - chapter.from,
		tid: input.tid,
		clipStartSec: chapter.from,
		clipEndSec: chapter.to,
		videoTitle: input.videoTitle,
		sourceDuration: input.videoDuration,
	}))

	const filled = await fillMusicFields(
		{
			bvid: input.bvid,
			title: input.videoTitle,
			desc: input.desc,
			ownerName: input.ownerName,
			pages: tracks.map((track) => ({ id: track.id, part: track.title })),
			isMultiPage: true,
			alwaysAi: true,
			partIsChapter: true,
		},
		{ store: deps.store, complete: deps.complete },
	)
	const filledById = new Map(filled.map((item) => [item.id, item]))
	const kept: LibraryTrack[] = []
	for (const track of tracks) {
		const meta = filledById.get(track.id)
		if (meta?.drop === true) continue
		kept.push({
			...track,
			...(meta?.musicTitle ? { musicTitle: meta.musicTitle } : {}),
			...(meta?.musicArtist ? { musicArtist: meta.musicArtist } : {}),
		})
	}
	return kept.length < 2 ? null : kept
}
