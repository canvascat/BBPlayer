import { assert, test } from 'vitest'

import { normalizeViewPoints, shouldFetchViewPoints } from './video-chapters.ts'

test('多 P 或不像歌且无 AI 时不请求', () => {
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 2,
			tid: 31,
			title: '专辑',
			musicAiApiKey: 'sk',
		}),
		false,
	)
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 1,
			tid: 17,
			title: '手机开箱',
			musicAiApiKey: '',
		}),
		false,
	)
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 1,
			tid: 31,
			title: '专辑',
			musicAiApiKey: '',
		}),
		true,
	)
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 1,
			tid: 17,
			title: '手机开箱',
			musicAiApiKey: 'sk',
		}),
		true,
	)
})

test('按 from 排序、补 to、丢掉非法章；不足 2 章得到空数组', () => {
	assert.deepEqual(
		normalizeViewPoints(
			[
				{ content: '说了再见', from: 195, to: 477 },
				{ content: '跨时代', from: 0 },
				{ content: '  ', from: 10, to: 20 },
				{ content: '坏', from: 90, to: 80 },
			],
			2726,
		),
		[
			{ content: '跨时代', from: 0, to: 195 },
			{ content: '说了再见', from: 195, to: 477 },
		],
	)
	assert.deepEqual(
		normalizeViewPoints([{ content: '仅一章', from: 0, to: 10 }], 10),
		[],
	)
})
