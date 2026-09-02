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

test('音乐库目录与详情子路由可匹配', async () => {
	const catalog = [
		['/library', '/library/_catalog/'],
		['/library/favorites', '/library/_catalog/favorites'],
		['/library/collections', '/library/_catalog/collections'],
		['/library/multipage', '/library/_catalog/multipage'],
	] as const
	for (const [pathname, routeId] of catalog) {
		const router = await loadAt(pathname)
		assert.equal(router.state.location.pathname, pathname)
		assert.ok(
			router.state.matches.some((match) => match.routeId === '/library'),
		)
		assert.ok(
			router.state.matches.some((match) => match.routeId === routeId),
			`expected ${routeId} in ${router.state.matches.map((match) => match.routeId).join(',')}`,
		)
	}

	const detail = await loadAt('/library/playlists/abc')
	assert.ok(
		detail.state.matches.some(
			(match) => match.routeId === '/library/playlists/$id',
		),
	)
	assert.ok(
		!detail.state.matches.some((match) =>
			match.routeId.startsWith('/library/_catalog'),
		),
	)

	for (const [pathname, routeId] of [
		['/library/downloads', '/library/downloads'],
		['/library/watch-later', '/library/watch-later'],
	] as const) {
		const router = await loadAt(pathname)
		assert.ok(router.state.matches.some((match) => match.routeId === routeId))
	}
})

test('未知音乐库路径进入 404', async () => {
	const router = await loadAt('/library/nope')
	assert.ok(router.state.matches.some((match) => match.routeId === '/$'))
})
