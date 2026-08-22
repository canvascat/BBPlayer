import { test, assert } from 'vitest'

import { coverUrl, withBiliImageHeaders } from './bili-image.ts'

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
