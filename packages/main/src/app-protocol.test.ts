import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { test, assert } from 'vitest'

import {
	installAppProtocolHandler,
	rendererUrl,
	resolveAppRequest,
	resolveRendererFile,
} from './app-protocol.ts'

const dist = resolve('/tmp/bbplayer-renderer-dist')

test('主窗口 URL 在 app://localhost', () => {
	assert.equal(rendererUrl('index.html'), 'app://localhost/')
})

test('/trpc 与 /trpc/* 走 tRPC，含 POST', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/trpc', 'POST', { rendererDist: dist }),
		{ type: 'trpc' },
	)
	assert.deepEqual(
		resolveAppRequest('app://localhost/trpc/settings.get?batch=1', 'GET', {
			rendererDist: dist,
		}),
		{ type: 'trpc' },
	)
})

test('非 GET/HEAD 的静态路径 405', () => {
	assert.deepEqual(
		resolveAppRequest('app://localhost/src/main.tsx', 'POST', {
			rendererDist: dist,
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
			fetch: async () => new Response('should-not-serve'),
		},
		new Request('app://localhost/trpc/auth.qrStart?batch=1', {
			method: 'POST',
		}),
	)
	assert.equal(await res.text(), 'trpc-ok')
})
