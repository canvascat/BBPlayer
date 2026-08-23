import { generateUniqueTrackKey } from '@bbplayer/core'
import { z } from 'zod'

import {
	fetchImageDataUrl,
	getCollectionVideos,
	getCollections,
	getComments,
	getFavoriteFolders,
	getFavoriteVideos,
	getReplyComments,
	getUploaderVideos,
	getVideoDetails,
	getWatchLater,
	likeComment,
	searchGarbSkins,
	searchVideos,
} from '../../bili'
import { cookieFrom } from '../context'
import { publicProcedure, router } from '../trpc'

export const biliRouter = router({
	library: publicProcedure.query(async ({ ctx }) => {
		const account = ctx.store.get('account') ?? (await ctx.refreshAccount())
		if (!account) {
			return { account: null, favorites: [], collections: [], watchLater: 0 }
		}
		const cookie = cookieFrom(ctx.store)
		const mid = account.mid
		const [favorites, collections, watchLater] = await Promise.all([
			getFavoriteFolders(cookie, mid),
			getCollections(cookie, mid),
			getWatchLater(cookie).catch(() => ({
				itemCount: 0,
				videos: [],
				title: '稍后再看',
			})),
		])
		return {
			account,
			favorites,
			collections,
			watchLater: watchLater.itemCount,
		}
	}),
	favorite: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) =>
			getFavoriteVideos(cookieFrom(ctx.store), input.id),
		),
	collection: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) =>
			getCollectionVideos(cookieFrom(ctx.store), input.id),
		),
	watchLater: publicProcedure.query(({ ctx }) =>
		getWatchLater(cookieFrom(ctx.store)),
	),
	uploader: publicProcedure
		.input(z.object({ mid: z.string() }))
		.query(({ ctx, input }) =>
			getUploaderVideos(cookieFrom(ctx.store), input.mid),
		),
	search: publicProcedure
		.input(z.object({ keyword: z.string() }))
		.query(async ({ ctx, input }) => {
			const result = await searchVideos(input.keyword, cookieFrom(ctx.store))
			return result.map((item) => ({
				...item,
				title: item.title.replace(/<[^>]+>/g, ''),
			}))
		}),
	video: publicProcedure
		.input(z.object({ bvid: z.string() }))
		.query(async ({ ctx, input }) => {
			const details = await getVideoDetails(input.bvid, cookieFrom(ctx.store))
			const cover = details.pic
			return {
				bvid: details.bvid,
				title: details.title,
				cover,
				owner: details.owner,
				pages: details.pages.map((page) => ({
					id: generateUniqueTrackKey({
						bvid: input.bvid,
						cid: page.cid,
						isMultiPage: details.pages.length > 1,
					}),
					bvid: input.bvid,
					cid: page.cid,
					title: page.part || details.title,
					artist: details.owner.name,
					artwork: cover,
					duration: page.duration,
				})),
			}
		}),
	comments: publicProcedure
		.input(
			z.object({
				bvid: z.string(),
				next: z.number().optional(),
				mode: z.number().optional(),
			}),
		)
		.query(({ ctx, input }) =>
			getComments(
				cookieFrom(ctx.store),
				input.bvid,
				input.next ?? 0,
				input.mode ?? 3,
			),
		),
	commentReplies: publicProcedure
		.input(
			z.object({
				bvid: z.string(),
				rpid: z.number(),
				pn: z.number().optional(),
			}),
		)
		.query(({ ctx, input }) =>
			getReplyComments(
				cookieFrom(ctx.store),
				input.bvid,
				input.rpid,
				input.pn ?? 1,
			),
		),
	commentLike: publicProcedure
		.input(
			z.object({
				bvid: z.string(),
				rpid: z.number(),
				action: z.union([z.literal(0), z.literal(1)]),
			}),
		)
		.mutation(({ ctx, input }) =>
			likeComment(cookieFrom(ctx.store), input.bvid, input.rpid, input.action),
		),
	garbSearch: publicProcedure
		.input(z.object({ keyword: z.string() }))
		.query(({ ctx, input }) =>
			searchGarbSkins(cookieFrom(ctx.store), input.keyword),
		),
	skinCover: publicProcedure
		.input(z.object({ url: z.string() }))
		.query(({ input }) => fetchImageDataUrl(input.url)),
})
