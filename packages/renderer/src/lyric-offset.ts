export const LYRIC_OFFSET_STEP = 0.5
export const LYRIC_OFFSET_MIN = -10
export const LYRIC_OFFSET_MAX = 10

export function clampLyricOffset(sec: number) {
	if (!Number.isFinite(sec)) return 0
	const snapped = Math.round(sec / LYRIC_OFFSET_STEP) * LYRIC_OFFSET_STEP
	const clamped = Math.min(
		LYRIC_OFFSET_MAX,
		Math.max(LYRIC_OFFSET_MIN, snapped),
	)
	return Number(clamped.toFixed(1))
}

export function stepLyricOffset(sec: number, direction: 1 | -1) {
	return clampLyricOffset(sec + direction * LYRIC_OFFSET_STEP)
}

export function lyricClockMs(currentTimeMs: number, offsetSec: number) {
	return currentTimeMs - offsetSec * 1000
}

export function lyricSeekMs(lineStartMs: number, offsetSec: number) {
	return lineStartMs + offsetSec * 1000
}

export function formatLyricOffset(sec: number) {
	const value = clampLyricOffset(sec)
	if (value === 0) return '0.0s'
	const sign = value > 0 ? '+' : ''
	return `${sign}${value.toFixed(1)}s`
}
