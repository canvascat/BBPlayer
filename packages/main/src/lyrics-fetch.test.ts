import { test, assert } from 'vitest'

import { fetchMatchedLyrics } from './lyrics-fetch.ts'

test('默认只请求网易云，不拼作者', async () => {
	const called: string[] = []
	let keyword = ''
	const result = await fetchMatchedLyrics(
		{ title: '【翻唱】起风了' },
		{
			netease: async (kw) => {
				called.push('netease')
				keyword = kw
				return { lrc: '[00:00.00]起风了', source: 'netease' }
			},
			qq: async () => {
				called.push('qq')
				return { lrc: 'qq', source: 'qqmusic' }
			},
			kugou: async () => {
				called.push('kugou')
				return { lrc: 'kugou', source: 'kugou' }
			},
		},
	)
	assert.equal(keyword, '起风了')
	assert.equal(result?.source, 'netease')
	assert.deepEqual(called, ['netease'])
})

test('精确歌名覆盖清洗后的标题', async () => {
	let keyword = ''
	await fetchMatchedLyrics(
		{ title: '【高音质】乱七八糟', preciseKeyword: '夜に駆ける' },
		{
			netease: async (kw) => {
				keyword = kw
				return { lrc: 'x', source: 'netease' }
			},
		},
	)
	assert.equal(keyword, '夜に駆ける')
})

test('自动模式下先成功的源胜出', async () => {
	const result = await fetchMatchedLyrics(
		{ title: '起风了', source: 'auto' },
		{
			netease: () =>
				new Promise((resolve) => {
					setTimeout(() => resolve({ lrc: 'netease', source: 'netease' }), 50)
				}),
			qq: async () => ({ lrc: 'qq', source: 'qqmusic' }),
			kugou: async () => ({ lrc: 'kugou', source: 'kugou' }),
		},
	)
	assert.equal(result?.source, 'qqmusic')
})
