import { assert, test } from 'vitest'

import { memoryStore } from './trpc/mock-context.ts'
import { expandChapterTracks } from './video-chapter-tracks.ts'

const base = {
	bvid: 'BV1xx',
	cid: 9,
	videoTitle: '周杰伦专辑《跨时代》',
	videoDuration: 2726,
	tid: 31,
	artist: 'UP',
	artwork: 'https://example.com/a.jpg',
	ownerName: 'UP',
	points: [
		{ content: '片头', from: 0, to: 10 },
		{ content: '跨时代', from: 10, to: 195 },
		{ content: '说了再见', from: 195, to: 477 },
	],
}

test('无 AI 时全拆，章名当 title，id 含 from/to', async () => {
	const tracks = await expandChapterTracks(base, { store: memoryStore() })
	assert.equal(tracks?.length, 3)
	assert.equal(tracks?.[0]?.id, 'bilibili::BV1xx::9::0::10')
	assert.equal(tracks?.[1]?.title, '跨时代')
	assert.equal(tracks?.[1]?.duration, 185)
	assert.equal(tracks?.[1]?.videoTitle, base.videoTitle)
})

test('AI 丢掉片头后仍 ≥2 章则拆剩余', async () => {
	const tracks = await expandChapterTracks(base, {
		store: memoryStore({ musicAiApiKey: 'sk' }),
		complete: async () => [
			{
				index: 1,
				title: null,
				artist: null,
				confidence: 'high',
				kind: 'not_music',
			},
			{
				index: 2,
				title: '跨时代',
				artist: '周杰伦',
				confidence: 'high',
				kind: 'original',
			},
			{
				index: 3,
				title: '说了再见',
				artist: '周杰伦',
				confidence: 'high',
				kind: 'original',
			},
		],
	})
	assert.equal(tracks?.length, 2)
	assert.equal(tracks?.[0]?.title, '跨时代')
	assert.equal(tracks?.[0]?.musicTitle, '跨时代')
})

test('丢掉后不足 2 章则不拆', async () => {
	const tracks = await expandChapterTracks(base, {
		store: memoryStore({ musicAiApiKey: 'sk' }),
		complete: async () => [
			{
				index: 1,
				title: null,
				artist: null,
				confidence: 'high',
				kind: 'not_music',
			},
			{
				index: 2,
				title: null,
				artist: null,
				confidence: 'high',
				kind: 'not_music',
			},
			{
				index: 3,
				title: '说了再见',
				artist: '周杰伦',
				confidence: 'high',
				kind: 'original',
			},
		],
	})
	assert.equal(tracks, null)
})
