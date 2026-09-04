import { assert, test } from 'vitest'

import { trackMatchesQuery } from './music-track-text.ts'

const track = {
	title: '【翻唱】夜曲',
	artist: '某UP',
	musicTitle: '起风了',
	musicArtist: '买辣椒也用券',
}

test('搜起风了能命中 musicTitle', () => {
	assert.equal(trackMatchesQuery(track, '起风了'), true)
})

test('搜 UP 仍能命中 artist', () => {
	assert.equal(trackMatchesQuery(track, '某up'), true)
})
