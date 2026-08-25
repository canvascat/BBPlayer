import type { AppRouter } from '@bbplayer/main/router'
import { QueryClient } from '@tanstack/react-query'
import {
	createTRPCClient,
	httpBatchLink,
	httpSubscriptionLink,
	splitLink,
} from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'

export const queryClient = new QueryClient()

export const trpcClient = createTRPCClient<AppRouter>({
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

export const trpc = createTRPCOptionsProxy<AppRouter>({
	client: trpcClient,
	queryClient,
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
