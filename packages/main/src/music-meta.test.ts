import { assert, test } from 'vitest'

import { readMusicMeta } from './music-meta-store.ts'
import {
	extractBracketTitle,
	extractFromDescription,
	fillMusicFields,
	lyricSearchInput,
	mergePageMeta,
	musicSourceHash,
	parseMusicAiPayload,
	ruleGuess,
	truncateDesc,
} from './music-meta.ts'
import { memoryStore } from './trpc/mock-context.ts'

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

test('规则：无书名号时用简介歌名', () => {
	const guessed = ruleGuess({
		part: 'P1',
		videoTitle: '乱七八糟',
		desc: '歌名：起风了\n原唱：买辣椒也用券',
	})
	assert.equal(guessed.title, '起风了')
	assert.equal(guessed.artist, '买辣椒也用券')
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
	assert.deepEqual(mergePageMeta({ artist: '规则人' }, undefined), {
		musicArtist: '规则人',
	})
	assert.deepEqual(
		mergePageMeta(
			{ artist: '规则人' },
			{
				index: 1,
				title: 'AI歌',
				artist: 'AI人',
				confidence: 'low',
				kind: 'cover',
			},
		),
		{ musicArtist: '规则人' },
	)
	assert.deepEqual(
		mergePageMeta(
			{ title: '规则歌', artist: '规则人' },
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

test('缓存命中且 hash 相同不打模型', async () => {
	const store = memoryStore({
		musicAiApiKey: 'sk',
		musicMeta: {
			'bilibili::BV1': {
				musicTitle: '缓存歌',
				sourceHash: musicSourceHash({
					title: '稿',
					desc: '',
					parts: ['p'],
				}),
			},
		},
	})
	let called = 0
	const result = await fillMusicFields(
		{
			bvid: 'BV1',
			title: '稿',
			pages: [{ id: 'bilibili::BV1', part: 'p' }],
			ownerName: 'UP',
			isMultiPage: false,
		},
		{
			store,
			complete: async () => {
				called += 1
				return []
			},
		},
	)
	assert.equal(called, 0)
	assert.equal(result[0]?.musicTitle, '缓存歌')
})

test('无 Key 时即使用规则缺歌手也不调用 complete', async () => {
	const store = memoryStore()
	let called = 0
	const result = await fillMusicFields(
		{
			bvid: 'BV1',
			title: '稿',
			pages: [{ id: 'bilibili::BV1', part: '《晴天》' }],
			ownerName: 'UP',
			isMultiPage: false,
		},
		{
			store,
			complete: async () => {
				called += 1
				return []
			},
		},
	)
	assert.equal(called, 0)
	assert.equal(result[0]?.musicTitle, '晴天')
	assert.equal(result[0]?.musicArtist, undefined)
})

test('有 Key 且缺字段时调用一次并把结果写入缓存', async () => {
	const store = memoryStore({ musicAiApiKey: 'sk' })
	let called = 0
	const result = await fillMusicFields(
		{
			bvid: 'BV1',
			title: '稿',
			pages: [{ id: 'bilibili::BV1', part: 'p' }],
			ownerName: 'UP',
			isMultiPage: false,
		},
		{
			store,
			complete: async (input, config) => {
				called += 1
				assert.equal(config.apiKey, 'sk')
				assert.equal(config.baseUrl, 'https://open.bigmodel.cn/api/paas/v4/')
				assert.equal(config.model, 'glm-4-flash')
				assert.deepEqual(input.pages, [{ index: 1, part: 'p' }])
				return [
					{
						index: 1,
						title: 'AI歌',
						artist: 'AI人',
						confidence: 'high',
						kind: 'cover',
					},
				]
			},
		},
	)
	assert.equal(called, 1)
	assert.equal(result[0]?.musicTitle, 'AI歌')
	assert.equal(result[0]?.musicArtist, 'AI人')
	assert.equal(readMusicMeta(store, 'bilibili::BV1')?.musicTitle, 'AI歌')
	assert.equal(readMusicMeta(store, 'bilibili::BV1')?.musicArtist, 'AI人')
})

test('AI 失败只保留规则字段', async () => {
	const store = memoryStore({ musicAiApiKey: 'sk' })
	const result = await fillMusicFields(
		{
			bvid: 'BV1',
			title: '【翻唱】《晴天》',
			pages: [{ id: 'bilibili::BV1', part: 'p' }],
			ownerName: 'UP',
			isMultiPage: false,
		},
		{
			store,
			complete: async () => null,
		},
	)
	assert.equal(result[0]?.musicTitle, '晴天')
	assert.equal(result[0]?.musicArtist, undefined)
})
