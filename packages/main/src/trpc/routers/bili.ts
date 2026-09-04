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
import {
	filterSongItems,
	filterVideoPayload,
	readFilterNonSongs,
} from '../../filter-non-songs'
import { fillMusicFields } from '../../music-meta'
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
		.query(async ({ ctx, input }) => {
			const result = await getFavoriteVideos(cookieFrom(ctx.store), input.id)
			const enabled = readFilterNonSongs(ctx.store)
			return { ...result, videos: filterSongItems(enabled, result.videos) }
		}),
	collection: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const result = await getCollectionVideos(cookieFrom(ctx.store), input.id)
			const enabled = readFilterNonSongs(ctx.store)
			return { ...result, videos: filterSongItems(enabled, result.videos) }
		}),
	watchLater: publicProcedure.query(async ({ ctx }) => {
		const result = await getWatchLater(cookieFrom(ctx.store))
		const enabled = readFilterNonSongs(ctx.store)
		return { ...result, videos: filterSongItems(enabled, result.videos) }
	}),
	uploader: publicProcedure
		.input(z.object({ mid: z.string() }))
		.query(async ({ ctx, input }) => {
			const result = await getUploaderVideos(cookieFrom(ctx.store), input.mid)
			const enabled = readFilterNonSongs(ctx.store)
			return { ...result, videos: filterSongItems(enabled, result.videos) }
		}),
	search: publicProcedure
		.input(z.object({ keyword: z.string() }))
		.query(async ({ ctx, input }) => {
			const result = await searchVideos(input.keyword, cookieFrom(ctx.store))
			const enabled = readFilterNonSongs(ctx.store)
			return filterSongItems(
				enabled,
				result.map((item) => ({
					...item,
					title: item.title.replace(/<[^>]+>/g, ''),
				})),
			)
		}),
	video: publicProcedure
		.input(z.object({ bvid: z.string() }))
		.query(async ({ ctx, input }) => {
			const details = await getVideoDetails(input.bvid, cookieFrom(ctx.store))
			const enabled = readFilterNonSongs(ctx.store)
			const gate = filterVideoPayload(enabled, {
				tid: details.tid,
				title: details.title,
				pages: details.pages,
			})
			const cover = details.pic
			const pages = (gate.pages as typeof details.pages).map((page) => ({
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
				tid: details.tid,
			}))
			if (pages.length === 0) {
				return {
					bvid: details.bvid,
					title: details.title,
					cover,
					owner: details.owner,
					pages,
					filtered: gate.filtered,
				}
			}
			const filled = await fillMusicFields(
				{
					bvid: input.bvid,
					title: details.title,
					desc: details.desc,
					ownerName: details.owner.name,
					pages: pages.map((page, index) => ({
						id: page.id,
						part: details.pages[index]?.part || page.title,
					})),
					isMultiPage: details.pages.length > 1,
				},
				{ store: ctx.store },
			)
			const filledMap = new Map(filled.map((item) => [item.id, item]))
			const withMusic = pages.map((page) => ({
				...page,
				...filledMap.get(page.id),
			}))
			return {
				bvid: details.bvid,
				title: details.title,
				cover,
				owner: details.owner,
				pages: withMusic,
				filtered: gate.filtered,
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
