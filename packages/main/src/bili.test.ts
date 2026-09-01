import { test, assert } from 'vitest'

import {
	coverUrl,
	withBiliImageCorsHeaders,
	withBiliImageHeaders,
} from './bili-image.ts'

test('协议相对封面地址补成 https', () => {
	assert.equal(
		coverUrl('//i0.hdslb.com/bfs/archive/a.jpg'),
		'https://i0.hdslb.com/bfs/archive/a.jpg',
	)
})

test('http 封面升级为 https', () => {
	assert.equal(
		coverUrl('http://i0.hdslb.com/bfs/archive/a.jpg'),
		'https://i0.hdslb.com/bfs/archive/a.jpg',
	)
})

test('已是 https 的封面保持不变', () => {
	assert.equal(
		coverUrl('https://i1.hdslb.com/bfs/archive/a.jpg'),
		'https://i1.hdslb.com/bfs/archive/a.jpg',
	)
})

test('空封面返回空字符串', () => {
	assert.equal(coverUrl(undefined), '')
	assert.equal(coverUrl(''), '')
})

test('会盖掉页面 Referer，避免 hdslb 按 RefererWhite 拒绝', () => {
	const headers = withBiliImageHeaders({
		Referer: 'http://localhost:5173/',
		Accept: 'image/webp',
	})
	assert.equal(headers.Referer, 'https://www.bilibili.com/')
	assert.equal(headers.Accept, 'image/webp')
})

test('给封面响应加上 CORS，供 WebGL 背景读取', () => {
	const headers = withBiliImageCorsHeaders({
		'Content-Type': ['image/jpeg'],
		'Access-Control-Allow-Origin': ['https://evil.example'],
	})
	assert.deepEqual(headers['Access-Control-Allow-Origin'], ['*'])
	assert.deepEqual(headers['Content-Type'], ['image/jpeg'])
})
