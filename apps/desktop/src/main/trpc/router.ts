import { desktopRouter } from './routers/desktop'
import { libraryRouter } from './routers/library'
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
})

export type AppRouter = typeof appRouter
