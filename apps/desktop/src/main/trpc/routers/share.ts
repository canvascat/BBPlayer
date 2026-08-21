import type { PlayerDatabase } from '@bbplayer/db'
import { z } from 'zod'

import {
	copyShareLink,
	enableSharing,
	previewSharedPlaylist,
	pullSharedChanges,
	rotateInvite,
	subscribeToSharedPlaylist,
} from '../../shared-playlists'
import { fromObservable } from '../observable'
import { publicProcedure, router } from '../trpc'

function tokenFrom(store: { get: (key: string) => unknown }) {
	return (store.get('bbplayerToken') as string | undefined) || null
}

function db(ctx: { playerDb: unknown }) {
	return ctx.playerDb as PlayerDatabase
}

export const shareRouter = router({
	preview: publicProcedure
		.input(z.object({ input: z.string() }))
		.query(({ input }) => previewSharedPlaylist(input.input)),
	pending: publicProcedure.query(({ ctx }) => ctx.takePendingShare()),
	enable: publicProcedure
		.input(z.object({ playlistId: z.string() }))
		.mutation(({ ctx, input }) =>
			enableSharing(db(ctx), tokenFrom(ctx.store), input.playlistId),
		),
	subscribe: publicProcedure
		.input(
			z.object({
				input: z.string(),
				inviteCode: z.string().optional(),
			}),
		)
		.mutation(({ ctx, input }) =>
			subscribeToSharedPlaylist(
				db(ctx),
				tokenFrom(ctx.store),
				input.input,
				input.inviteCode,
			),
		),
	pull: publicProcedure
		.input(z.object({ playlistId: z.string() }))
		.mutation(({ ctx, input }) =>
			pullSharedChanges(db(ctx), tokenFrom(ctx.store), input.playlistId),
		),
	copyLink: publicProcedure
		.input(
			z.object({
				playlistId: z.string(),
				kind: z.enum(['subscribe', 'editor']),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const result = await copyShareLink(
				db(ctx),
				tokenFrom(ctx.store),
				input.playlistId,
				input.kind,
			)
			ctx.copyText(result.url)
			return result
		}),
	rotateInvite: publicProcedure
		.input(z.object({ playlistId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const result = await rotateInvite(
				db(ctx),
				tokenFrom(ctx.store),
				input.playlistId,
			)
			ctx.copyText(result.url)
			return result
		}),
	incoming: publicProcedure.subscription(({ ctx }) =>
		fromObservable(ctx.events.shareIncoming$),
	),
})
