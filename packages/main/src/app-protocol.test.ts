import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { test, assert } from 'vitest'

import {
	headersWithoutHost,
	installAppProtocolHandler,
	rendererUrl,
	resolveAppRequest,
	resolveRendererFile,
} from './app-protocol.ts'

const dist = resolve('/tmp/bbplayer-renderer-dist')
const vite = 'http://127.0.0.1:5173/'

test('三个窗口 URL 都在 app://localhost', () => {
	assert.equal(rendererUrl('index.html'), 'app://localhost/')
	assert.equal(rendererUrl('lyrics.html'), 'app://localhost/lyrics.html')
	assert.equal(rendererUrl('mini.html'), 'app://localhost/mini.html')
})

test('去掉 Host，保留其它头', () => {
	const next = headersWithoutHost(
		new Headers({ Host: 'localhost', Accept: 'text/html' }),
	)
	assert.equal(next.has('host'), false)
	assert.equal(next.get('accept'), 'text/html')
})

test('转发头去掉 Origin Referer 与 sec-fetch，避免 net.fetch 抛错', () => {
	const next = headersWithoutHost(
		new Headers({
			Host: 'localhost',
			Origin: 'app://localhost',
			Referer: 'app://localhost/',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Dest': 'script',
			Accept: '*/*',
		}),
	)
	assert.equal(next.has('origin'), false)
	assert.equal(next.has('referer'), false)
	assert.equal(next.has('sec-fetch-mode'), false)
	assert.equal(next.has('sec-fetch-dest'), false)
	assert.equal(next.get('accept'), '*/*')
})

test('/trpc 与 /trpc/* 走 tRPC，含 POST', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/trpc', 'POST', { rendererDist: dist }),
		{ type: 'trpc' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/trpc/settings.get?batch=1', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'trpc' },
	)
})

test('开发转发 pathname 与 search 到 Vite，不进文件', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'forward', url: 'http://127.0.0.1:5173/' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/lyrics.html', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'forward', url: 'http://127.0.0.1:5173/lyrics.html' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/@vite/client?v=1', 'GET', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'forward', url: 'http://127.0.0.1:5173/@vite/client?v=1' },
	)
})

test('开发非 GET/HEAD 的静态路径 405', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/src/main.tsx', 'POST', {
			rendererDist: dist,
			viteDevServerUrl: vite,
		}),
		{ type: 'error', status: 405 },
	)
})

test('生产 / 映射 dist/index.html，其它路径落在 dist 内', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/', 'GET', { rendererDist: dist }),
		{
			type: 'file',
			absPath: resolve(dist, 'index.html'),
		},
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/mini.html', 'GET', {
			rendererDist: dist,
		}),
		{ type: 'file', absPath: resolve(dist, 'mini.html') },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/assets/x.js', 'HEAD', {
			rendererDist: dist,
		}),
		{ type: 'file', absPath: resolve(dist, 'assets/x.js') },
	)
})

test('URL 里的 .. 被规范化后仍不能用绝对路径逃出 dist', () => {
	const route = resolveAppRequest(
		'app://localhost/%2e%2e/%2e%2e/etc/passwd',
		'GET',
		{
			rendererDist: dist,
		},
	)
	assert.equal(route.type, 'file')
	if (route.type !== 'file') throw new Error('expected file')
	assert.equal(route.absPath.startsWith(dist), true)
	assert.equal(route.absPath.includes('..'), false)
})

test('未规范化的 .. 与 %2e%2e 被 resolveRendererFile 拒绝', () => {
	assert.equal(resolveRendererFile('/../secret', dist), null)
	assert.equal(resolveRendererFile('/%2e%2e/secret', dist), null)
	assert.equal(resolveRendererFile('/assets/../../secret', dist), null)
})

test('非法 percent-encoding 返回 404', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/%E0%A4%A', 'GET', {
			rendererDist: dist,
		}),
		{ type: 'error', status: 404 },
	)
})

async function dispatch(
	options: Parameters<typeof installAppProtocolHandler>[0],
	request: Request,
) {
	let listener: ((request: Request) => Response | Promise<Response>) | undefined
	installAppProtocolHandler({
		...options,
		handle: (_scheme, next) => {
			listener = next
		},
	})
	if (!listener) throw new Error('missing listener')
	return listener(request)
}

test('开发转发 fetch 目标为 Vite，且不含 Host', async () => {
	const calls: { url: string; init?: RequestInit }[] = []
	const res = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			viteDevServerUrl: vite,
			fetch: async (url, init) => {
				calls.push({ url, init })
				return new Response('vite')
			},
		},
		new Request('app://localhost/@vite/client?v=1', {
			headers: { Host: 'localhost', Accept: '*/*' },
		}),
	)
	assert.equal(await res.text(), 'vite')
	assert.equal(calls.length, 1)
	assert.equal(calls[0]?.url, 'http://127.0.0.1:5173/@vite/client?v=1')
	const headers = new Headers(calls[0]?.init?.headers)
	assert.equal(headers.has('host'), false)
	assert.equal(headers.get('accept'), '*/*')
	assert.equal(
		(calls[0]?.init as { bypassCustomProtocolHandlers?: boolean })
			?.bypassCustomProtocolHandlers,
		true,
	)
})

test('开发转发失败返回 502', async () => {
	const res = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			viteDevServerUrl: vite,
			fetch: async () => {
				throw new Error('vite down')
			},
		},
		new Request('app://localhost/'),
	)
	assert.equal(res.status, 502)
})

test('生产存在的文件走 file URL，缺失 404', async () => {
	const index = resolve(dist, 'index.html')
	const fetched: string[] = []
	const ok = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			isFile: (absPath) => absPath === index,
			fetch: async (url) => {
				fetched.push(url)
				return new Response('html')
			},
		},
		new Request('app://localhost/'),
	)
	assert.equal(await ok.text(), 'html')
	assert.deepEqual(fetched, [pathToFileURL(index).href])

	const missing = await dispatch(
		{
			handleTrpc: async () => new Response('trpc'),
			rendererDist: dist,
			isFile: () => false,
			fetch: async () => new Response('nope'),
		},
		new Request('app://localhost/missing.js'),
	)
	assert.equal(missing.status, 404)
})

test('POST /trpc 仍进 handleTrpc', async () => {
	const res = await dispatch(
		{
			handleTrpc: async () => new Response('trpc-ok'),
			rendererDist: dist,
			viteDevServerUrl: vite,
			fetch: async () => new Response('should-not-forward'),
		},
		new Request('app://localhost/trpc/auth.qrStart?batch=1', {
			method: 'POST',
		}),
	)
	assert.equal(await res.text(), 'trpc-ok')
})
