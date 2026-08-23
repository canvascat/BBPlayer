import { z } from 'zod'

import { publicProcedure, router } from '../trpc'

const libraryTrackSchema = z.object({
	id: z.string(),
	bvid: z.string(),
	cid: z.number(),
	title: z.string(),
	artist: z.string(),
	artwork: z.string(),
	duration: z.number(),
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
	get: publicProcedure.query(({ ctx }) => ctx.store.get('session') ?? null),
	set: publicProcedure
		.input(z.union([playSessionSchema, z.null()]))
		.mutation(({ ctx, input: session }) => {
			if (session) ctx.store.set('session', session)
			else ctx.store.delete('session')
			return true
		}),
})
