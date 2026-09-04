import { z } from 'zod'

import {
	filterPlaySession,
	mergePlaySessionSet,
	readFilterNonSongs,
} from '../../filter-non-songs.ts'
import { overlayMusicMeta } from '../../music-meta-store.ts'
import { publicProcedure, router } from '../trpc'

const libraryTrackSchema = z.object({
	id: z.string(),
	bvid: z.string(),
	cid: z.number(),
	title: z.string(),
	artist: z.string(),
	artwork: z.string(),
	duration: z.number(),
	tid: z.number().optional(),
	musicTitle: z.string().optional(),
	musicArtist: z.string().optional(),
})

const playSessionSchema = z.object({
	queue: z.array(libraryTrackSchema),
	index: z.number(),
	positionMs: z.number(),
	repeatMode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
	shuffle: z.boolean(),
	playbackRate: z.number(),
})

export const sessionRouter = router({
	get: publicProcedure.query(({ ctx }) => {
		const session = ctx.store.get('session')
		if (!session) return null
		const filtered = filterPlaySession(readFilterNonSongs(ctx.store), session)
		return {
			...filtered,
			queue: overlayMusicMeta(ctx.store, filtered.queue),
		}
	}),
	set: publicProcedure
		.input(z.union([playSessionSchema, z.null()]))
		.mutation(({ ctx, input }) => {
			if (!input) {
				ctx.store.delete('session')
				return true
			}
			ctx.store.set(
				'session',
				mergePlaySessionSet(
					readFilterNonSongs(ctx.store),
					ctx.store.get('session'),
					input,
				),
			)
			return true
		}),
})
