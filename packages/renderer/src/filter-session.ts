import type { TrackItem } from './playback.ts'

export function applyFilterSessionView(
	prevCurrentId: string | undefined,
	session: { queue: TrackItem[]; index: number },
): { queue: TrackItem[]; index: number; action: 'keep' | 'play' | 'stop' } {
	const { queue, index } = session
	if (queue.length === 0) {
		return { queue, index, action: 'stop' }
	}
	if (prevCurrentId) {
		const found = queue.findIndex((item) => item.id === prevCurrentId)
		if (found >= 0) {
			return { queue, index: found, action: 'keep' }
		}
	}
	if (queue[index]) {
		return {
			queue,
			index,
			action: prevCurrentId ? 'play' : 'keep',
		}
	}
	return { queue, index, action: 'stop' }
}
