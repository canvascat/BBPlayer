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

export function listen<T>(
	subscribe: (
		input: undefined,
		opts: { onData: (value: T) => void },
	) => { unsubscribe: () => void },
	onData: (value: T) => void,
) {
	const sub = subscribe(undefined, { onData })
	return () => sub.unsubscribe()
}
