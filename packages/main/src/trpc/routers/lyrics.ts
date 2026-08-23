import { z } from 'zod'

import { liveState } from '../live-state'
import { fromObservable } from '../observable'
import { publicProcedure, router } from '../trpc'

export const lyricsRouter = router({
	current: publicProcedure.query(() => liveState.lastLyrics),
	push: publicProcedure.input(z.unknown()).mutation(({ ctx, input }) => {
		liveState.lastLyrics = input
		ctx.events.lyrics$.next(input)
		return true
	}),
	toggle: publicProcedure
		.input(z.object({ show: z.boolean().optional() }).optional())
		.mutation(({ ctx, input }) => ctx.openAux('lyrics', input?.show)),
	visible: publicProcedure.query(({ ctx }) => ctx.auxVisible('lyrics')),
	updates: publicProcedure.subscription(({ ctx }) =>
		fromObservable(ctx.events.lyrics$),
	),
	meta: publicProcedure.subscription(({ ctx }) =>
		fromObservable(ctx.events.lyricsMeta$),
	),
})

export const miniRouter = router({
	toggle: publicProcedure
		.input(z.object({ show: z.boolean().optional() }).optional())
		.mutation(({ ctx, input }) => ctx.openAux('mini', input?.show)),
	visible: publicProcedure.query(({ ctx }) => ctx.auxVisible('mini')),
})
