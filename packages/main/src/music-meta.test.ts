import { assert, test } from 'vitest'

import {
	extractBracketTitle,
	extractFromDescription,
	lyricSearchInput,
	mergePageMeta,
	musicSourceHash,
	parseMusicAiPayload,
	ruleGuess,
	truncateDesc,
} from './music-meta.ts'

test('书名号优先于标题其余部分', () => {
	assert.equal(extractBracketTitle('【翻唱】《起风了》live'), '起风了')
	assert.equal(extractBracketTitle('「夜に駆ける」'), '夜に駆ける')
	assert.equal(extractBracketTitle('没有括号'), undefined)
})

test('简介标签抽出歌名和原唱', () => {
	assert.deepEqual(extractFromDescription('歌名：起风了\n原唱：买辣椒也用券'), {
		title: '起风了',
		artist: '买辣椒也用券',
	})
})

test('规则：分 P 书名号优先，否则稿件标题，简介补歌手', () => {
	const guessed = ruleGuess({
		part: 'P1 《晴天》',
		videoTitle: '【高音质】乱七八糟',
		desc: '原唱：周杰伦',
	})
	assert.equal(guessed.title, '晴天')
	assert.equal(guessed.artist, '周杰伦')
})

test('简介截断到 2000 字', () => {
	assert.equal(truncateDesc('a'.repeat(2001)).length, 2000)
	assert.equal(truncateDesc(undefined), '')
})

test('sourceHash 随标题或分 P 变化', () => {
	const a = musicSourceHash({ title: 'A', desc: '', parts: ['p1'] })
	const b = musicSourceHash({ title: 'B', desc: '', parts: ['p1'] })
	assert.notEqual(a, b)
	assert.equal(a.length, 16)
})

test('JSON 低置信度和 not_music 在合并时丢弃', () => {
	assert.deepEqual(
		parseMusicAiPayload(
			JSON.stringify({
				tracks: [
					{
						index: 1,
						title: 'x',
						artist: 'y',
						confidence: 'low',
						kind: 'cover',
					},
				],
			}),
		),
		[
			{
				index: 1,
				title: 'x',
				artist: 'y',
				confidence: 'low',
				kind: 'cover',
			},
		],
	)
	assert.equal(parseMusicAiPayload('not json'), null)
	assert.equal(parseMusicAiPayload('{"tracks":[]}'), null)
	assert.deepEqual(
		mergePageMeta(
			{ title: '规则歌' },
			{
				index: 1,
				title: 'AI歌',
				artist: 'AI人',
				confidence: 'high',
				kind: 'cover',
			},
		),
		{ musicTitle: '规则歌', musicArtist: 'AI人' },
	)
	assert.deepEqual(
		mergePageMeta(
			{},
			{
				index: 1,
				title: 'AI歌',
				artist: 'AI人',
				confidence: 'high',
				kind: 'not_music',
			},
		),
		{},
	)
	assert.deepEqual(
		mergePageMeta(
			{},
			{
				index: 1,
				title: 'AI歌',
				artist: null,
				confidence: 'low',
				kind: 'cover',
			},
		),
		{},
	)
})

test('歌词关键词：BGM 优先，否则 musicTitle，不拼歌手', () => {
	assert.deepEqual(
		lyricSearchInput(
			{ title: '视频', musicTitle: '解析名' },
			'BGM《挂曲》- 某人',
		),
		{ title: '视频', preciseKeyword: '挂曲' },
	)
	assert.deepEqual(lyricSearchInput({ title: '视频', musicTitle: '解析名' }), {
		title: '视频',
		preciseKeyword: '解析名',
	})
	assert.deepEqual(lyricSearchInput({ title: '视频' }), { title: '视频' })
})
