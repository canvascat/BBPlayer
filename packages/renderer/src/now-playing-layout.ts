export const PLAYER_COLUMN = '256px'
export const PLAYER_STAGE_GUTTER = '48px'

/** AMLL horizontal hideLyric: 0.5s cover slide. */
export const STAGE_MOVE_MS = 500
export const LYRIC_SHOW_MS = 500
export const LYRIC_SHOW_DELAY_MS = 250
export const LYRIC_HIDE_MS = 250
export const LYRIC_MOTION_EASE = 'cubic-bezier(0.5, 0, 0.5, 1)'

export function playerStageColumns(lyricsOpen: boolean) {
	if (lyricsOpen) {
		return `${PLAYER_STAGE_GUTTER} ${PLAYER_COLUMN} minmax(0,1fr)`
	}
	return `minmax(0,1fr) ${PLAYER_COLUMN} minmax(0,1fr)`
}

export function lyricsPanelVisible(lyricsOpen: boolean) {
	return lyricsOpen
}

export function lyricsPanelTransition(lyricsOpen: boolean) {
	if (lyricsOpen) {
		return `opacity ${LYRIC_SHOW_MS}ms ${LYRIC_SHOW_DELAY_MS}ms ${LYRIC_MOTION_EASE}`
	}
	return `opacity ${LYRIC_HIDE_MS}ms ${LYRIC_MOTION_EASE}`
}
