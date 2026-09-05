import { initTRPC } from '@trpc/server'

import { getLogger } from '../logger/runtime.ts'

import type { TrpcContext } from './context'

const t = initTRPC.context<TrpcContext>().create({
	sse: {
		ping: { enabled: true, intervalMs: 2000 },
		client: { reconnectAfterInactivityMs: 5000 },
	},
})

export const router = t.router
export const publicProcedure = t.procedure.use(async (opts) => {
	const result = await opts.next()
	if (!result.ok && opts.path !== 'desktop.reportLog') {
		getLogger('trpc').error(
			{ path: opts.path, type: opts.type, err: result.error },
			'procedure failed',
		)
	}
	return result
})
