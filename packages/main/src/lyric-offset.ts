import { generateUniqueTrackKey } from '@bbplayer/core'

import type { TrpcStore } from './trpc/context'

const STEP = 0.5
const MIN = -10
const MAX = 10

function clamp(sec: number) {
	if (!Number.isFinite(sec)) return 0
	const snapped = Math.round(sec / STEP) * STEP
	const clamped = Math.min(MAX, Math.max(MIN, snapped))
	return Number(clamped.toFixed(1))
}

export function trackIdForOffset(track: {
	id?: string
	bvid: string
	cid: number
}) {
	if (track.id) return track.id
	return generateUniqueTrackKey({
		bvid: track.bvid,
		cid: track.cid,
		isMultiPage: true,
	})
}

export function readLyricOffset(
	store: Pick<TrpcStore, 'get'>,
	trackId: string,
) {
	return clamp(store.get('lyricOffsets')?.[trackId] ?? 0)
}

export function writeLyricOffset(
	store: Pick<TrpcStore, 'get' | 'set'>,
	trackId: string,
	offsetSec: number,
) {
	const next = clamp(offsetSec)
	const map = { ...store.get('lyricOffsets') }
	if (next === 0) delete map[trackId]
	else map[trackId] = next
	store.set('lyricOffsets', map)
	return next
}
