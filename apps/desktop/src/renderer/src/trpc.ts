import {
	createTRPCClient,
	httpBatchLink,
	httpSubscriptionLink,
	splitLink,
} from '@trpc/client'

import type { AppRouter } from '../../main/trpc/router'

export const trpc = createTRPCClient<AppRouter>({
	links: [
		splitLink({
			condition: (op) => op.type === 'subscription',
			true: httpSubscriptionLink({
				url: () => window.bbplayer.trpcUrl,
			}),
			false: httpBatchLink({
				url: window.bbplayer.trpcUrl,
			}),
		}),
	],
})
