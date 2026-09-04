import { assert, test } from 'vitest'

import { applyFilterSessionView } from './filter-session.ts'

const song = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
}

test('当前曲还在则 keep', () => {
	const result = applyFilterSessionView('s', { queue: [song], index: 0 })
	assert.equal(result.action, 'keep')
	assert.equal(result.index, 0)
})

test('当前曲被滤掉且有下一首则 play', () => {
	const result = applyFilterSessionView('gone', { queue: [song], index: 0 })
	assert.equal(result.action, 'play')
	assert.equal(result.queue[result.index]?.id, 's')
})

test('空队列则 stop', () => {
	assert.equal(
		applyFilterSessionView('x', { queue: [], index: 0 }).action,
		'stop',
	)
})

test('越界 index 则 stop 但保留队列', () => {
	const result = applyFilterSessionView('gone', { queue: [song], index: 1 })
	assert.equal(result.action, 'stop')
	assert.equal(result.queue.length, 1)
})
