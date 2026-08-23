import { test, assert } from 'vitest'

import { parseViteLocalUrl } from './vite-local-url.ts'

test('从 Vite 日志里解析 Local URL，并去掉末尾斜杠', () => {
	assert.equal(
		parseViteLocalUrl('  ➜  Local:   http://127.0.0.1:5173/\n'),
		'http://127.0.0.1:5173',
	)
})

test('忽略 ANSI 颜色码', () => {
	const esc = String.fromCharCode(0x1b)
	assert.equal(
		parseViteLocalUrl(`${esc}[32mLocal:${esc}[0m https://localhost:5174/foo\n`),
		'https://localhost:5174/foo',
	)
})

test('没有 Local 行则返回 null', () => {
	assert.equal(parseViteLocalUrl('ready in 120 ms'), null)
})
