import { z } from 'zod'

import { getAudioStream } from '../../bili'
import { downloadManager } from '../../downloads'
import { cookieFrom } from '../context'
import { fromObservable } from '../observable'
import { publicProcedure, router } from '../trpc'

const trackSchema = z.object({
	id: z.string(),
	bvid: z.string(),
	cid: z.number(),
	title: z.string(),
	artist: z.string(),
	artwork: z.string(),
	duration: z.number(),
})

export const downloadsRouter = router({
	list: publicProcedure.query(() => downloadManager.list()),
	status: publicProcedure.query(() => downloadManager.statusMap()),
	start: publicProcedure.input(trackSchema).mutation(async ({ ctx, input }) => {
		const stream = await getAudioStream(
			input.bvid,
			input.cid,
			cookieFrom(ctx.store),
		)
		downloadManager.enqueue({
			track: { ...input, size: 0, cachedAt: 0 },
			url: stream.url,
			cookie: cookieFrom(ctx.store),
		})
		return true
	}),
	remove: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ input }) => {
			downloadManager.remove(input.id)
			return true
		}),
	export: publicProcedure
		.input(z.object({ ids: z.array(z.string()).optional() }).optional())
		.mutation(({ ctx, input }) => ctx.exportDownloads(input?.ids)),
	updates: publicProcedure.subscription(({ ctx }) =>
		fromObservable(ctx.events.downloads$),
	),
})

export const backupRouter = router({
	export: publicProcedure.mutation(({ ctx }) => ctx.exportBackup()),
	import: publicProcedure.mutation(({ ctx }) => ctx.importBackup()),
})
