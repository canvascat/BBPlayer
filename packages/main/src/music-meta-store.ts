import type { TrpcStore } from './trpc/context'

export type MusicMetaEntry = {
	musicTitle?: string
	musicArtist?: string
	sourceHash: string
}

export function readMusicMeta(
	store: Pick<TrpcStore, 'get'>,
	trackId: string,
): MusicMetaEntry | undefined {
	return store.get('musicMeta')?.[trackId]
}

export function writeMusicMeta(
	store: Pick<TrpcStore, 'get' | 'set'>,
	trackId: string,
	entry: MusicMetaEntry,
) {
	const map = { ...store.get('musicMeta') }
	map[trackId] = entry
	store.set('musicMeta', map)
}

export function overlayMusicMeta<T extends { id: string }>(
	store: Pick<TrpcStore, 'get'>,
	tracks: T[],
): Array<T & { musicTitle?: string; musicArtist?: string }> {
	const meta = store.get('musicMeta')
	return tracks.map((track) => {
		const entry = meta?.[track.id]
		if (!entry) return track
		const overlay: T & { musicTitle?: string; musicArtist?: string } = {
			...track,
		}
		if (entry.musicTitle) overlay.musicTitle = entry.musicTitle
		if (entry.musicArtist) overlay.musicArtist = entry.musicArtist
		return overlay
	})
}
