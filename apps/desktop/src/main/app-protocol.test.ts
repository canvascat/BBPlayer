import assert from 'node:assert/strict'
import { resolve } from 'node:path'

import { test } from 'vitest'

import {
	headersWithoutHost,
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
