import { createMemoryHistory } from '@tanstack/react-router'
import { assert, test, vi } from 'vitest'

vi.mock('@applemusic-like-lyrics/react', () => ({
	LyricPlayer: () => null,
}))
vi.mock('@applemusic-like-lyrics/core/style.css', () => ({}))

vi.stubGlobal('window', {
	bbplayer: { trpcUrl: 'http://localhost/trpc' },
})

const { createAppRouter } = await import('./router.ts')

async function loadAt(pathname: string) {
	const router = createAppRouter(
		createMemoryHistory({ initialEntries: [pathname] }),
	)
	await router.load()
	return router
}

test('主页、音乐库、设置、播放页可匹配', async () => {
	const cases = [
		['/', '/'],
		['/library', '/library'],
		['/settings', '/settings'],
		['/player', '/player'],
	] as const
	for (const [pathname, routeId] of cases) {
		const router = await loadAt(pathname)
		assert.equal(router.state.location.pathname, pathname)
		assert.ok(
			router.state.matches.some((match) => match.routeId === routeId),
			`expected ${routeId} in ${router.state.matches.map((match) => match.routeId).join(',')}`,
		)
	}
})

test('未知路径进入 404', async () => {
	const router = await loadAt('/not-a-page')
	assert.ok(router.state.matches.some((match) => match.routeId === '/$'))
})
