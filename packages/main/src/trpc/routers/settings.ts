import { z } from 'zod'

import { getLogFilePath, setLogLevel } from '../../logger/runtime.ts'
import { parseLyricSource } from '../../lyric-match'
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
	menuBarShowLyrics: z.boolean().optional(),
	autoCache: z.boolean().optional(),
	filterNonSongs: z.boolean().optional(),
	skin: z.union([z.null(), skinSchema]).optional(),
	lyricSource: z.enum(['auto', 'netease', 'qqmusic', 'kugou']).optional(),
	musicAiBaseUrl: z.string().optional(),
	musicAiApiKey: z.string().optional(),
	musicAiModel: z.string().optional(),
	logLevel: z.enum(['error', 'warn', 'info', 'debug']).optional(),
})

export function readSettings(store: Pick<TrpcStore, 'get'>) {
	return {
		cookie: store.get('cookie') ?? '',
		continuePlayingAfterClose: store.get('continuePlayingAfterClose') ?? true,
		menuBarShowLyrics: store.get('menuBarShowLyrics') ?? false,
		autoCache: store.get('autoCache') ?? true,
		filterNonSongs: store.get('filterNonSongs') ?? false,
		account: store.get('account') ?? null,
		skin: store.get('skin') ?? null,
		lyricSource: parseLyricSource(store.get('lyricSource')),
		musicAiBaseUrl:
			store.get('musicAiBaseUrl') ?? 'https://open.bigmodel.cn/api/paas/v4/',
		musicAiApiKey: store.get('musicAiApiKey') ?? '',
		musicAiModel: store.get('musicAiModel') ?? 'glm-4-flash',
		logLevel: store.get('logLevel') ?? 'warn',
		logPath: getLogFilePath(),
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
			if (typeof patch.menuBarShowLyrics === 'boolean') {
				ctx.store.set('menuBarShowLyrics', patch.menuBarShowLyrics)
				ctx.refreshShell()
			}
			if (typeof patch.autoCache === 'boolean') {
				ctx.store.set('autoCache', patch.autoCache)
			}
			if (typeof patch.filterNonSongs === 'boolean') {
				ctx.store.set('filterNonSongs', patch.filterNonSongs)
			}
			if (
				patch.skin === null ||
				(patch.skin && typeof patch.skin === 'object')
			) {
				ctx.store.set('skin', patch.skin)
			}
			if (patch.lyricSource) {
				ctx.store.set('lyricSource', patch.lyricSource)
			}
			if (typeof patch.musicAiBaseUrl === 'string') {
				ctx.store.set('musicAiBaseUrl', patch.musicAiBaseUrl)
			}
			if (typeof patch.musicAiApiKey === 'string') {
				ctx.store.set('musicAiApiKey', patch.musicAiApiKey)
			}
			if (typeof patch.musicAiModel === 'string') {
				ctx.store.set('musicAiModel', patch.musicAiModel)
			}
			if (patch.logLevel) {
				ctx.store.set('logLevel', patch.logLevel)
				if (!process.env.BBPLAYER_LOG_LEVEL?.trim()) {
					setLogLevel(patch.logLevel)
				}
			}
			return true
		}),
})
