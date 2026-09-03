import { describeSearchFailure, matchSearchStrategies } from '@bbplayer/core'
import { z } from 'zod'

import { resolveB23 } from '../../bili'
import { writeLyricOffset } from '../../lyric-offset'
import { sameSnapshot } from '../context'
import { liveState } from '../live-state'
import { fromObservable } from '../observable'
import { publicProcedure, router } from '../trpc'

const snapshotSchema = z.object({
	title: z.string(),
	artist: z.string(),
	playing: z.boolean(),
	lyric: z.string(),
	artwork: z.string(),
})

const resolveTrackSchema = z.object({
	id: z.string().optional(),
	bvid: z.string(),
	cid: z.number(),
	title: z.string(),
	artist: z.string().optional(),
	artwork: z.string().optional(),
	duration: z.number().optional(),
})

export const playerRouter = router({
	snapshot: publicProcedure.query(() => liveState.snapshot),
	reportState: publicProcedure
		.input(snapshotSchema)
		.mutation(({ ctx, input }) => {
			if (sameSnapshot(liveState.snapshot, input)) return true
			liveState.snapshot = input
			ctx.events.lyricsMeta$.next(input)
			ctx.refreshShell()
			return true
		}),
	resolve: publicProcedure
		.input(resolveTrackSchema)
		.mutation(({ ctx, input }) => ctx.resolvePlay(input)),
	setLyricOffset: publicProcedure
		.input(
			z.object({
				trackId: z.string().min(1),
				offsetSec: z.number(),
			}),
		)
		.mutation(({ ctx, input }) =>
			writeLyricOffset(ctx.store, input.trackId, input.offsetSec),
		),
	matchSearch: publicProcedure
		.input(z.object({ query: z.string() }))
		.query(async ({ input }) => {
			const strategy = await matchSearchStrategies(input.query, { resolveB23 })
			return { strategy, error: describeSearchFailure(strategy) }
		}),
	sendCommand: publicProcedure
		.input(z.object({ command: z.string() }))
		.mutation(({ ctx, input }) => {
			ctx.events.playerCommands$.next(input.command)
			return true
		}),
	commands: publicProcedure.subscription(({ ctx }) =>
		fromObservable(ctx.events.playerCommands$),
	),
})
