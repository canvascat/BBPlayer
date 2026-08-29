import { authRouter } from './routers/auth'
import { biliRouter } from './routers/bili'
import { desktopRouter } from './routers/desktop'
import { backupRouter, downloadsRouter } from './routers/downloads'
import { libraryRouter } from './routers/library'
import { playerRouter } from './routers/player'
import { sessionRouter } from './routers/session'
import { settingsRouter } from './routers/settings'
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
	auth: authRouter,
	bili: biliRouter,
	downloads: downloadsRouter,
	backup: backupRouter,
})

export type AppRouter = typeof appRouter
