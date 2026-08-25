import { QueryClient } from '@tanstack/react-query'
import { assert, test, vi } from 'vitest'

vi.stubGlobal('window', {
	bbplayer: { trpcUrl: 'http://localhost/trpc' },
})

const { queryClient, trpc, trpcClient } = await import('./trpc.ts')

test('导出共享 QueryClient', () => {
	assert.ok(queryClient instanceof QueryClient)
})

test('vanilla client 仍可直接 query / mutate', () => {
	assert.equal(typeof trpcClient.settings.get.query, 'function')
	assert.equal(typeof trpcClient.settings.set.mutate, 'function')
})

test('options proxy 提供 queryOptions', () => {
	let options: { queryKey?: unknown; queryFn?: unknown } | undefined
	try {
		options = trpc.settings.get.queryOptions()
	} catch {
		options = undefined
	}
	assert.ok(Array.isArray(options?.queryKey))
	assert.equal(typeof options?.queryFn, 'function')
})
