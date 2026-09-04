import type { BiliAccount } from './bili'
import type { LibraryTrack, LocalPlaylist } from './db'
import type { CachedTrack } from './downloads'
import type { LyricSource } from './lyric-match'

export type SkinTheme = {
	name: string
	coverUrl: string
	primary: string
}

export type Settings = {
	cookie: string
	continuePlayingAfterClose: boolean
	menuBarShowLyrics: boolean
	autoCache: boolean
	filterNonSongs: boolean
	skin: SkinTheme | null
	lyricSource: LyricSource
}

export type PlaySession = {
	queue: LibraryTrack[]
	index: number
	positionMs: number
	repeatMode: 0 | 1 | 2
	shuffle: boolean
	playbackRate: number
}

export type Persisted = {
	session?: PlaySession
	lyricOffsets?: Record<string, number>
	playlists: LocalPlaylist[]
	account: BiliAccount | null
	downloads: CachedTrack[]
}

export type AppStore = Settings & Persisted
