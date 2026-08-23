import { accountRouter } from './routers/account'
import { authRouter } from './routers/auth'
import { biliRouter } from './routers/bili'
import { desktopRouter } from './routers/desktop'
import { backupRouter, downloadsRouter } from './routers/downloads'
import { libraryRouter } from './routers/library'
import { lyricsRouter, miniRouter } from './routers/lyrics'
import { playerRouter } from './routers/player'
import { sessionRouter } from './routers/session'
import { settingsRouter } from './routers/settings'
import { shareRouter } from './routers/share'
import { publicProcedure, router } from './trpc'

export const appRouter = router({
	health: router({
		ping: publicProcedure.query(() => ({ ok: true as const })),
	}),
	settings: settingsRouter,
	session: sessionRouter,
	library: libraryRouter,
	desktop: desktopRouter,
	player: playerRouter,
	lyrics: lyricsRouter,
	mini: miniRouter,
	auth: authRouter,
	bili: biliRouter,
	downloads: downloadsRouter,
	backup: backupRouter,
	account: accountRouter,
	share: shareRouter,
})

export type AppRouter = typeof appRouter
