import { z } from 'zod'

import type { TrpcStore } from '../context'
import { publicProcedure, router } from '../trpc'

const skinSchema = z.object({
	name: z.string(),
	coverUrl: z.string(),
	primary: z.string(),
})

const settingsPatchSchema = z.object({
	cookie: z.string().optional(),
	continuePlayingAfterClose: z.boolean().optional(),
	lyricsAlwaysOnTop: z.boolean().optional(),
	lyricsWindowLocked: z.boolean().optional(),
	autoOpenLyricsWindow: z.boolean().optional(),
	menuBarShowLyrics: z.boolean().optional(),
	miniAlwaysOnTop: z.boolean().optional(),
	autoOpenMiniWindow: z.boolean().optional(),
	autoCache: z.boolean().optional(),
	skin: z.union([z.null(), skinSchema]).optional(),
})

export function readSettings(store: Pick<TrpcStore, 'get'>) {
	return {
		cookie: store.get('cookie') ?? '',
		continuePlayingAfterClose: store.get('continuePlayingAfterClose') ?? true,
		lyricsAlwaysOnTop: store.get('lyricsAlwaysOnTop') ?? true,
		lyricsWindowLocked: store.get('lyricsWindowLocked') ?? false,
		autoOpenLyricsWindow: store.get('autoOpenLyricsWindow') ?? false,
		menuBarShowLyrics: store.get('menuBarShowLyrics') ?? false,
		miniAlwaysOnTop: store.get('miniAlwaysOnTop') ?? true,
		autoOpenMiniWindow: store.get('autoOpenMiniWindow') ?? false,
		autoCache: store.get('autoCache') ?? true,
		account: store.get('account') ?? null,
		skin: store.get('skin') ?? null,
		bbplayerAccount: store.get('bbplayerAccount') ?? null,
	}
}

export const settingsRouter = router({
	get: publicProcedure.query(({ ctx }) => readSettings(ctx.store)),
	set: publicProcedure
		.input(settingsPatchSchema)
		.mutation(({ ctx, input: patch }) => {
			if (typeof patch.cookie === 'string') {
				ctx.store.set('cookie', patch.cookie)
				void ctx.refreshAccount()
			}
			if (typeof patch.continuePlayingAfterClose === 'boolean') {
				ctx.store.set(
					'continuePlayingAfterClose',
					patch.continuePlayingAfterClose,
				)
			}
			if (typeof patch.lyricsAlwaysOnTop === 'boolean') {
				ctx.store.set('lyricsAlwaysOnTop', patch.lyricsAlwaysOnTop)
				ctx.applyAuxSettings('lyrics', { alwaysOnTop: patch.lyricsAlwaysOnTop })
			}
			if (typeof patch.lyricsWindowLocked === 'boolean') {
				ctx.store.set('lyricsWindowLocked', patch.lyricsWindowLocked)
				ctx.applyAuxSettings('lyrics', { locked: patch.lyricsWindowLocked })
			}
			if (typeof patch.autoOpenLyricsWindow === 'boolean') {
				ctx.store.set('autoOpenLyricsWindow', patch.autoOpenLyricsWindow)
			}
			if (typeof patch.menuBarShowLyrics === 'boolean') {
				ctx.store.set('menuBarShowLyrics', patch.menuBarShowLyrics)
				ctx.refreshShell()
			}
			if (typeof patch.miniAlwaysOnTop === 'boolean') {
				ctx.store.set('miniAlwaysOnTop', patch.miniAlwaysOnTop)
				ctx.applyAuxSettings('mini', { alwaysOnTop: patch.miniAlwaysOnTop })
			}
			if (typeof patch.autoOpenMiniWindow === 'boolean') {
				ctx.store.set('autoOpenMiniWindow', patch.autoOpenMiniWindow)
			}
			if (typeof patch.autoCache === 'boolean') {
				ctx.store.set('autoCache', patch.autoCache)
			}
			if (
				patch.skin === null ||
				(patch.skin && typeof patch.skin === 'object')
			) {
				ctx.store.set('skin', patch.skin)
			}
			return true
		}),
})
