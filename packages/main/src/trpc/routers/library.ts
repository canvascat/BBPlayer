import { isSongVideo } from '@bbplayer/core'
import { z } from 'zod'

import { filterSongItems, readFilterNonSongs } from '../../filter-non-songs.ts'
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

export const libraryRouter = router({
	list: publicProcedure.query(({ ctx }) => {
		const list = ctx.playerDb.list()
		if (!readFilterNonSongs(ctx.store)) return list
		return list.map((item) => {
			const playlist = ctx.playerDb.get(item.id)
			const itemCount = playlist
				? playlist.tracks.filter((track) => isSongVideo(track)).length
				: 0
			return { ...item, itemCount }
		})
	}),
	get: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => {
			const playlist = ctx.playerDb.get(input.id)
			if (!playlist) return playlist
			const tracks = readFilterNonSongs(ctx.store)
				? filterSongItems(true, playlist.tracks)
				: playlist.tracks
			return { ...playlist, tracks: overlayMusicMeta(ctx.store, tracks) }
		}),
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
