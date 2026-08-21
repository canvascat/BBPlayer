import { z } from 'zod'

import { validateCredentials } from '../../bbplayer-account'
import {
	fetchMe,
	loginRequest,
	registerRequest,
	updateProfileRequest,
} from '../../bbplayer-api'
import { cookieFrom } from '../context'
import { publicProcedure, router } from '../trpc'

function tokenFrom(store: { get: (key: string) => unknown }) {
	return (store.get('bbplayerToken') as string | undefined) || null
}

function settingsFrom(store: { get: (key: string) => unknown }) {
	return {
		cookie: cookieFrom(store),
		continuePlayingAfterClose:
			(store.get('continuePlayingAfterClose') as boolean | undefined) ?? true,
		lyricsAlwaysOnTop:
			(store.get('lyricsAlwaysOnTop') as boolean | undefined) ?? true,
		lyricsWindowLocked:
			(store.get('lyricsWindowLocked') as boolean | undefined) ?? false,
		autoOpenLyricsWindow:
			(store.get('autoOpenLyricsWindow') as boolean | undefined) ?? false,
		menuBarShowLyrics:
			(store.get('menuBarShowLyrics') as boolean | undefined) ?? false,
		miniAlwaysOnTop:
			(store.get('miniAlwaysOnTop') as boolean | undefined) ?? true,
		autoOpenMiniWindow:
			(store.get('autoOpenMiniWindow') as boolean | undefined) ?? false,
		autoCache: (store.get('autoCache') as boolean | undefined) ?? true,
		account: store.get('account') ?? null,
		skin: store.get('skin') ?? null,
		bbplayerAccount: store.get('bbplayerAccount') ?? null,
	}
}

export const accountRouter = router({
	login: publicProcedure
		.input(z.object({ username: z.string(), password: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const invalid = validateCredentials(input.username, input.password)
			if (invalid) throw new Error(invalid)
			const data = await loginRequest(input.username, input.password)
			ctx.store.set('bbplayerToken', data.token)
			ctx.store.set('bbplayerAccount', data.account)
			const restored = await ctx.restoreShared()
			return { ...settingsFrom(ctx.store), restoreMessage: restored.message }
		}),
	register: publicProcedure
		.input(
			z.object({
				username: z.string(),
				password: z.string(),
				name: z.string().optional(),
				face: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const invalid = validateCredentials(input.username, input.password)
			if (invalid) throw new Error(invalid)
			const data = await registerRequest(input)
			ctx.store.set('bbplayerToken', data.token)
			ctx.store.set('bbplayerAccount', data.account)
			const restored = await ctx.restoreShared()
			return { ...settingsFrom(ctx.store), restoreMessage: restored.message }
		}),
	logout: publicProcedure.mutation(({ ctx }) => {
		ctx.store.delete('bbplayerToken')
		ctx.store.set('bbplayerAccount', null)
		return settingsFrom(ctx.store)
	}),
	updateProfile: publicProcedure
		.input(
			z.object({
				name: z.string().optional(),
				face: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const token = tokenFrom(ctx.store)
			if (!token) throw new Error('请先登录 BBPlayer 账号')
			const data = await updateProfileRequest(token, input)
			ctx.store.set('bbplayerAccount', data.account)
			return settingsFrom(ctx.store)
		}),
	fillFromBili: publicProcedure.mutation(async ({ ctx }) => {
		const token = tokenFrom(ctx.store)
		if (!token) throw new Error('请先登录 BBPlayer 账号')
		const bili = ctx.store.get('account') as {
			name: string
			face: string
		} | null
		if (!bili) throw new Error('请先登录 Bilibili')
		const data = await updateProfileRequest(token, {
			name: bili.name,
			face: bili.face,
		})
		ctx.store.set('bbplayerAccount', data.account)
		return settingsFrom(ctx.store)
	}),
	refresh: publicProcedure.mutation(async ({ ctx }) => {
		const token = tokenFrom(ctx.store)
		if (!token) return settingsFrom(ctx.store)
		try {
			const data = await fetchMe(token)
			ctx.store.set('bbplayerAccount', data.account)
			return settingsFrom(ctx.store)
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === '请先登录 BBPlayer 账号'
			) {
				ctx.store.delete('bbplayerToken')
				ctx.store.set('bbplayerAccount', null)
			}
			throw error
		}
	}),
	restore: publicProcedure.mutation(({ ctx }) => ctx.restoreShared()),
})
