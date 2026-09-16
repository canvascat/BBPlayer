import type { TrpcStore } from './trpc/context'

export type TrackLyricsPayload = {
	lrc: string
	tlyric?: string
	romalrc?: string
	source?: string
}

export function readTrackLyrics(
	store: Pick<TrpcStore, 'get'>,
	trackId: string,
): TrackLyricsPayload | undefined {
	return store.get('trackLyrics')?.[trackId]
}

export function writeTrackLyrics(
	store: Pick<TrpcStore, 'get' | 'set'>,
	trackId: string,
	payload: TrackLyricsPayload,
) {
	const map = { ...store.get('trackLyrics') }
	map[trackId] = payload
	store.set('trackLyrics', map)
}
