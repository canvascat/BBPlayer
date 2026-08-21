import type { LibraryTrack, LocalPlaylist, PlaylistSummary } from '@bbplayer/db'

import type { UpdateCheck } from '../updater'

import type { DesktopEvents, PlayerSnapshot } from './events'

export type ResolveTrack = {
	id?: string
	bvid: string
	cid: number
	title: string
	artist?: string
	artwork?: string
	duration?: number
}

export type GeetestResult = {
	validate: string
	seccode: string
	challenge: string
}

export type TrpcStore = {
	get: (key: string) => unknown
	set: (key: string, value: unknown) => void
	delete: (key: string) => void
}

export type TrpcPlayerDb = {
	list: () => PlaylistSummary[]
	get: (id: string) => LocalPlaylist | null
	create: (payload: {
		title: string
		description?: string
		tracks?: LibraryTrack[]
	}) => LocalPlaylist
	rename: (id: string, title: string) => unknown
	delete: (id: string) => unknown
	addTracks: (playlistId: string, tracks: LibraryTrack[]) => unknown
	removeTrack: (playlistId: string, trackId: string) => unknown
}

export type TrpcContext = {
	events: DesktopEvents
	store: TrpcStore
	playerDb: TrpcPlayerDb
	refreshAccount: () => Promise<{
		mid: number
		name: string
		face: string
	} | null>
	applyAuxSettings: (
		kind: 'lyrics' | 'mini',
		patch: { alwaysOnTop?: boolean; locked?: boolean },
	) => void
	refreshShell: () => void
	openExternal: (url: string) => void | Promise<void>
	copyText: (text: string) => void
	checkUpdate: () => Promise<UpdateCheck>
	openAux: (kind: 'lyrics' | 'mini', show?: boolean) => boolean
	auxVisible: (kind: 'lyrics' | 'mini') => boolean
	showMain: () => void
	openGeetest: (input: {
		gt: string
		challenge: string
	}) => Promise<GeetestResult>
	exportDownloads: (ids?: string[]) => Promise<unknown>
	exportBackup: () => Promise<unknown>
	importBackup: () => Promise<unknown>
	resolvePlay: (track: ResolveTrack) => Promise<{
		playUrl: string
		lyrics: unknown[]
		cached?: boolean
		lyricSource?: string
	}>
	restoreShared: () => Promise<{ restored: number; message: string }>
	takePendingShare: () => { shareId?: string; inviteCode?: string } | null
}

export function createTRPCContext(ctx: TrpcContext): TrpcContext {
	return ctx
}

export function cookieFrom(store: TrpcStore) {
	return (store.get('cookie') as string | undefined) ?? ''
}

export function sameSnapshot(a: PlayerSnapshot, b: PlayerSnapshot) {
	return (
		a.title === b.title &&
		a.artist === b.artist &&
		a.playing === b.playing &&
		a.lyric === b.lyric &&
		a.artwork === b.artwork
	)
}
