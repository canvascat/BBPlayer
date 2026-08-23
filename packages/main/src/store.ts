import type { Rectangle } from 'electron'

import type { AuxKind } from './aux-windows'
import type { BbplayerAccount } from './bbplayer-account'
import type { BiliAccount } from './bili'
import type { LibraryTrack, LocalPlaylist } from './db'
import type { CachedTrack } from './downloads'

export type SkinTheme = {
	name: string
	coverUrl: string
	primary: string
}

export type Settings = {
	cookie: string
	continuePlayingAfterClose: boolean
	lyricsAlwaysOnTop: boolean
	lyricsWindowLocked: boolean
	autoOpenLyricsWindow: boolean
	menuBarShowLyrics: boolean
	miniAlwaysOnTop: boolean
	autoOpenMiniWindow: boolean
	autoCache: boolean
	skin: SkinTheme | null
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
	playlists: LocalPlaylist[]
	windowBounds: Partial<Record<AuxKind, Rectangle>>
	lyricsWindowOpen: boolean
	miniWindowOpen: boolean
	account: BiliAccount | null
	downloads: CachedTrack[]
	bbplayerToken?: string
	bbplayerAccount?: BbplayerAccount | null
}

export type AppStore = Settings & Persisted
