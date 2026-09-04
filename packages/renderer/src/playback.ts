export interface TrackItem {
	id: string
	bvid: string
	cid: number
	title: string
	artist: string
	artwork: string
	duration: number
	tid?: number
}

export type RepeatMode = 0 | 1 | 2

export const RepeatMode = {
	OFF: 0 as RepeatMode,
	TRACK: 1 as RepeatMode,
	QUEUE: 2 as RepeatMode,
}

export function nextRepeatMode(mode: RepeatMode): RepeatMode {
	if (mode === RepeatMode.OFF) return RepeatMode.TRACK
	if (mode === RepeatMode.TRACK) return RepeatMode.QUEUE
	return RepeatMode.OFF
}

export function repeatLabel(mode: RepeatMode) {
	if (mode === RepeatMode.TRACK) return '单曲循环'
	if (mode === RepeatMode.QUEUE) return '列表循环'
	return '循环关闭'
}

export function formatMs(ms: number) {
	if (!Number.isFinite(ms) || ms < 0) return '00:00'
	const total = Math.floor(ms / 1000)
	const m = Math.floor(total / 60)
	const s = total % 60
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatClock(ms: number) {
	if (!Number.isFinite(ms) || ms < 0) return '0:00'
	const total = Math.floor(ms / 1000)
	const m = Math.floor(total / 60)
	const s = total % 60
	return `${m}:${String(s).padStart(2, '0')}`
}

/** 进度条用毫秒时长：优先音频元数据，未就绪时回退曲目秒数。 */
export function progressDurationMs(
	audioDurationMs: number,
	trackDurationSec = 0,
) {
	if (Number.isFinite(audioDurationMs) && audioDurationMs > 0) {
		return audioDurationMs
	}
	if (Number.isFinite(trackDurationSec) && trackDurationSec > 0) {
		return trackDurationSec * 1000
	}
	return 0
}

export function shuffleOrder(length: number, current: number) {
	if (length <= 0) return []
	const start = Math.min(Math.max(current, 0), length - 1)
	const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== start)
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[rest[i], rest[j]] = [rest[j], rest[i]]
	}
	return [start, ...rest]
}

export function neighborIndex(
	queueLength: number,
	index: number,
	delta: number,
	repeat: RepeatMode,
	order: number[] | null,
) {
	if (queueLength === 0) return null
	const sequence = order && order.length === queueLength ? order : null
	if (sequence) {
		const pos = sequence.indexOf(index)
		const at = pos < 0 ? 0 : pos
		const nextPos = at + delta
		if (nextPos < 0 || nextPos >= sequence.length) {
			if (repeat === RepeatMode.QUEUE) {
				return sequence[(nextPos + sequence.length) % sequence.length]
			}
			return null
		}
		return sequence[nextPos]
	}
	const next = index + delta
	if (next >= 0 && next < queueLength) return next
	if (repeat === RepeatMode.QUEUE) {
		return (next + queueLength) % queueLength
	}
	return null
}
