import { map } from 'rxjs'
import { z } from 'zod'

import { getAudioStream } from '../../bili'
import { downloadManager } from '../../downloads'
import { filterSongItems, readFilterNonSongs } from '../../filter-non-songs'
import { overlayMusicMeta } from '../../music-meta-store'
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
	tid: z.number().optional(),
	musicTitle: z.string().optional(),
	musicArtist: z.string().optional(),
})

export const downloadsRouter = router({
	list: publicProcedure.query(({ ctx }) =>
		overlayMusicMeta(
			ctx.store,
			filterSongItems(readFilterNonSongs(ctx.store), downloadManager.list()),
		),
	),
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
		fromObservable(
			ctx.events.downloads$.pipe(
				map((payload) => ({
					...payload,
					records: filterSongItems(
						readFilterNonSongs(ctx.store),
						payload.records as Array<{ title: string; tid?: number | null }>,
					),
				})),
			),
		),
	),
})

export const backupRouter = router({
	export: publicProcedure.mutation(({ ctx }) => ctx.exportBackup()),
	import: publicProcedure.mutation(({ ctx }) => ctx.importBackup()),
})
