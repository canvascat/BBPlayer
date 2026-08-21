import { initTRPC } from '@trpc/server'

import type { TrpcContext } from './context'

const t = initTRPC.context<TrpcContext>().create({
	sse: {
		ping: { enabled: true, intervalMs: 2000 },
		client: { reconnectAfterInactivityMs: 5000 },
	},
})

export const router = t.router
export const publicProcedure = t.procedure
