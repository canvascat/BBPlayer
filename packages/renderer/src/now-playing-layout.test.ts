import { test, assert } from 'vitest'

import {
	LYRIC_HIDE_MS,
	LYRIC_MOTION_EASE,
	LYRIC_SHOW_DELAY_MS,
	LYRIC_SHOW_MS,
	lyricsPanelTransition,
	lyricsPanelVisible,
	PLAYER_COLUMN,
	PLAYER_STAGE_GUTTER,
	playerStageColumns,
	STAGE_MOVE_MS,
} from './now-playing-layout.ts'

test('收起歌词时播放列两侧等宽留白，歌词区不展示', () => {
	assert.equal(
		playerStageColumns(false),
		`minmax(0,1fr) ${PLAYER_COLUMN} minmax(0,1fr)`,
	)
	assert.equal(lyricsPanelVisible(false), false)
})

test('展开歌词时播放列靠左、右侧给歌词', () => {
	assert.equal(
		playerStageColumns(true),
		`${PLAYER_STAGE_GUTTER} ${PLAYER_COLUMN} minmax(0,1fr)`,
	)
	assert.equal(lyricsPanelVisible(true), true)
})

test('开合歌词不改变播放列宽度', () => {
	assert.equal(PLAYER_COLUMN, '256px')
	assert.notEqual(playerStageColumns(true), playerStageColumns(false))
	assert.match(playerStageColumns(true), new RegExp(PLAYER_COLUMN))
	assert.match(playerStageColumns(false), new RegExp(PLAYER_COLUMN))
})

test('展开歌词时延后淡入，收起时立刻淡出', () => {
	assert.equal(
		lyricsPanelTransition(true),
		`opacity ${LYRIC_SHOW_MS}ms ${LYRIC_SHOW_DELAY_MS}ms ${LYRIC_MOTION_EASE}`,
	)
	assert.equal(
		lyricsPanelTransition(false),
		`opacity ${LYRIC_HIDE_MS}ms ${LYRIC_MOTION_EASE}`,
	)
	assert.ok(STAGE_MOVE_MS >= 400)
})
