import { test, assert } from 'vitest'

import {
	neteaseFetchLyrics,
	neteaseRequestUrl,
	neteaseSearchSongs,
} from './netease-api.ts'
import { aesEcbEncryptHex } from './netease-crypto.ts'

test('weapi 把 /api 换成 music.163.com/weapi', () => {
	assert.equal(
		neteaseRequestUrl('/api/cloudsearch/pc', 'weapi'),
		'https://music.163.com/weapi/cloudsearch/pc',
	)
})

test('eapi 把 /api 换成 interface3.music.163.com/eapi', () => {
	assert.equal(
		neteaseRequestUrl('/api/song/lyric/v1', 'eapi'),
		'https://interface3.music.163.com/eapi/song/lyric/v1',
	)
})

test('网易云搜索走 weapi cloudsearch 并取回歌曲 id', async () => {
	const songs = await neteaseSearchSongs(
		'起风了',
		10,
		undefined,
		async (input) => {
			const href =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url
			assert.equal(href, 'https://music.163.com/weapi/cloudsearch/pc')
			return new Response(JSON.stringify({ result: { songs: [{ id: 42 }] } }))
		},
	)
	assert.equal(songs[0]?.id, 42)
})

test('网易云歌词 eapi 响应会解密', async () => {
	const payload = {
		yrc: { lyric: '[00:01.00]hi' },
		lrc: { lyric: 'plain' },
	}
	const lyrics = await neteaseFetchLyrics(1, undefined, async () => {
		return new Response(
			Buffer.from(aesEcbEncryptHex(JSON.stringify(payload)), 'hex'),
		)
	})
	assert.equal(lyrics.yrc?.lyric, '[00:01.00]hi')
})
