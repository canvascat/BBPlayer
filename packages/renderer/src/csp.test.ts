import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assert, test } from 'vitest'

const html = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), '../index.html'),
	'utf8',
)

test('CSP connect-src 允许歌词背景 fetch B 站封面', () => {
	assert.match(html, /connect-src[^"]*https:\/\/\*\.hdslb\.com/)
	assert.match(html, /connect-src[^"]*https:\/\/\*\.biliimg\.com/)
})

test('CSP img-src 允许歌词背景把封面转成 blob 再绘制', () => {
	assert.match(html, /img-src[^;]*blob:/)
})
