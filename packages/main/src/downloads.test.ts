import { test, assert } from 'vitest'

import { parseByteRange } from './audio-proxy.ts'
import { cacheFileName } from './downloads.ts'
import { decodeHtml, pickByDuration } from './lyrics-fetch.ts'

test('缓存文件名会去掉路径分隔符', () => {
	assert.equal(cacheFileName('bilibili::BV1xx::123'), 'bilibili_BV1xx_123.m4a')
})

test('Range 解析支持开放结尾', () => {
	assert.deepEqual(parseByteRange('bytes=10-', 100), { start: 10, end: 99 })
	assert.equal(parseByteRange('bytes=200-', 100), null)
})

test('歌词匹配优先时长接近的结果', () => {
	const picked = pickByDuration(
		[
			{ duration: 10, title: 'a' },
			{ duration: 182, title: 'b' },
			{ duration: 400, title: 'c' },
		],
		180,
	)
	assert.equal(picked.title, 'b')
})

test('QQ 歌词 HTML 实体解码', () => {
	assert.equal(decodeHtml('&quot;hello&amp;amp;&quot;'), '"hello&amp;"')
})
