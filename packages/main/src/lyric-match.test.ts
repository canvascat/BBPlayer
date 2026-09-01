import { test, assert } from 'vitest'

import {
	parseLyricSource,
	parseNeteaseLyrics,
	preciseMusicNameFromBgm,
	providersForLyricSource,
	raceLyricProviders,
	resolveLyricKeyword,
} from './lyric-match.ts'
import { cleanKeyword } from './lyrics-fetch.ts'

test('自动匹配只用歌名，不用作者', () => {
	assert.equal(resolveLyricKeyword('《起风了》翻唱', '精确名'), '精确名')
	assert.equal(resolveLyricKeyword('【高音质】起风了'), '起风了')
})

test('有精确关键词时不再清洗标题', () => {
	assert.equal(
		resolveLyricKeyword('【高音质】乱七八糟标题', '起风了'),
		'起风了',
	)
})

test('B 站 bgm 标题优先抽出书名号里的歌名', () => {
	assert.equal(preciseMusicNameFromBgm('BGM《起风了》- 买辣椒也用券'), '起风了')
	assert.equal(preciseMusicNameFromBgm('起风了'), '起风了')
	assert.equal(preciseMusicNameFromBgm(undefined), undefined)
	assert.equal(preciseMusicNameFromBgm(''), undefined)
})

test('歌词源缺省或非法时默认网易云', () => {
	assert.equal(parseLyricSource(undefined), 'netease')
	assert.equal(parseLyricSource('nope'), 'netease')
	assert.equal(parseLyricSource('auto'), 'auto')
	assert.equal(parseLyricSource('qqmusic'), 'qqmusic')
	assert.equal(parseLyricSource('kugou'), 'kugou')
})

test('默认只打网易云，自动才三源并行', () => {
	assert.deepEqual(providersForLyricSource('netease'), ['netease'])
	assert.deepEqual(providersForLyricSource('qqmusic'), ['qqmusic'])
	assert.deepEqual(providersForLyricSource('kugou'), ['kugou'])
	assert.deepEqual(providersForLyricSource('auto'), [
		'netease',
		'qqmusic',
		'kugou',
	])
})

test('网易云优先用 yrc，并转成 SPL', () => {
	const parsed = parseNeteaseLyrics({
		lrc: { lyric: '[00:01.00]普通歌词' },
		tlyric: { lyric: '[00:01.00]译' },
		yrc: { lyric: '[00:02.00]逐字' },
		ytlrc: { lyric: '[00:02.00]逐字译' },
		yromalrc: { lyric: '[00:02.00]roma' },
	})
	assert.equal(parsed.lrc, '[00:02.00]逐字')
	assert.equal(parsed.tlyric, '[00:02.00]逐字译')
	assert.equal(parsed.romalrc, '[00:02.00]roma')
})

test('没有 yrc 时回退普通 lrc', () => {
	const parsed = parseNeteaseLyrics({
		lrc: { lyric: '[00:01.00]普通歌词' },
		romalrc: { lyric: '[00:01.00]roma' },
	})
	assert.equal(parsed.lrc, '[00:01.00]普通歌词')
	assert.equal(parsed.romalrc, '[00:01.00]roma')
	assert.equal(parsed.tlyric, undefined)
})

test('自动匹配先成功的源会取消其余请求', async () => {
	const aborted: string[] = []
	const result = await raceLyricProviders(
		['netease', 'qqmusic'],
		(name, signal) => {
			if (name === 'qqmusic') {
				return Promise.resolve({
					lrc: '[00:00.00]qq',
					source: 'qqmusic',
				})
			}
			return new Promise((_, reject) => {
				const timer = setTimeout(() => {
					reject(new Error('netease too slow'))
				}, 200)
				signal.addEventListener('abort', () => {
					clearTimeout(timer)
					aborted.push(name)
					reject(new Error('aborted'))
				})
			})
		},
	)
	assert.equal(result?.source, 'qqmusic')
	assert.deepEqual(aborted, ['netease'])
})

test('单源失败不会换成下一家', async () => {
	const called: string[] = []
	const result = await raceLyricProviders(['netease'], async (name) => {
		called.push(name)
		return null
	})
	assert.equal(result, null)
	assert.deepEqual(called, ['netease'])
})

test('cleanKeyword 仍从书名号提取歌名', () => {
	assert.equal(cleanKeyword('翻唱《起风了》'), '起风了')
	assert.equal(cleanKeyword('「夜に駆ける」'), '夜に駆ける')
})
