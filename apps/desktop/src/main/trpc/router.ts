import { publicProcedure, router } from './trpc.ts'

export const appRouter = router({
	health: router({
		ping: publicProcedure.query(() => ({ ok: true as const })),
	}),
})

export type AppRouter = typeof appRouter
