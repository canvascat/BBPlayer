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

export const libraryRouter = router({
	list: publicProcedure.query(({ ctx }) => ctx.playerDb.list()),
	get: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => ctx.playerDb.get(input.id)),
	create: publicProcedure
		.input(
			z.object({
				title: z.string(),
				description: z.string().optional(),
				tracks: z.array(libraryTrackSchema).optional(),
			}),
		)
		.mutation(({ ctx, input }) => ctx.playerDb.create(input)),
	rename: publicProcedure
		.input(z.object({ id: z.string(), title: z.string() }))
		.mutation(({ ctx, input }) => ctx.playerDb.rename(input.id, input.title)),
	delete: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => ctx.playerDb.delete(input.id)),
	addTracks: publicProcedure
		.input(
			z.object({
				playlistId: z.string(),
				tracks: z.array(libraryTrackSchema),
			}),
		)
		.mutation(({ ctx, input }) =>
			ctx.playerDb.addTracks(input.playlistId, input.tracks),
		),
	removeTrack: publicProcedure
		.input(
			z.object({
				playlistId: z.string(),
				trackId: z.string(),
			}),
		)
		.mutation(({ ctx, input }) =>
			ctx.playerDb.removeTrack(input.playlistId, input.trackId),
		),
})
