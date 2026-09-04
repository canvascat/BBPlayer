import { assert, test } from 'vitest'

import { displayArtist, displayTitle } from './music-display.ts'

test('有解析结果用解析结果', () => {
	assert.equal(
		displayTitle({ title: '【翻唱】起风了', musicTitle: '起风了' }),
		'起风了',
	)
	assert.equal(
		displayArtist({ artist: '某UP', musicArtist: '买辣椒也用券' }),
		'买辣椒也用券',
	)
})

test('没有解析结果回退稿件字段', () => {
	assert.equal(displayTitle({ title: '稿件' }), '稿件')
	assert.equal(displayArtist({ artist: 'UP' }), 'UP')
})

test('空字符串不当解析结果', () => {
	assert.equal(displayTitle({ title: '稿件', musicTitle: '' }), '稿件')
	assert.equal(displayArtist({ artist: 'UP', musicArtist: '  ' }), 'UP')
})
