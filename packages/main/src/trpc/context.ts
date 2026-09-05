import type { LibraryTrack, LocalPlaylist, PlaylistSummary } from '../db'
import type { AppStore } from '../store'
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
	musicTitle?: string
}

export type GeetestResult = {
	validate: string
	seccode: string
	challenge: string
}

export type TrpcStore = {
	get: <K extends keyof AppStore>(key: K) => AppStore[K]
	set: <K extends keyof AppStore>(key: K, value: AppStore[K]) => void
	delete: (key: keyof AppStore) => void
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
	refreshShell: () => void
	openExternal: (url: string) => void | Promise<void>
	openLogsFolder: () => void | Promise<void>
	copyText: (text: string) => void
	checkUpdate: () => Promise<UpdateCheck>
	showMain: () => void
	openGeetest: (input: {
		gt: string
		challenge: string
	}) => Promise<GeetestResult>
	openWebLogin: () => Promise<string>
	clearBiliLoginSession: () => Promise<void>
	exportDownloads: (ids?: string[]) => Promise<unknown>
	exportBackup: () => Promise<unknown>
	importBackup: () => Promise<unknown>
	resolvePlay: (track: ResolveTrack) => Promise<{
		playUrl: string
		lyrics: unknown[]
		cached?: boolean
		lyricSource?: string
		lyricOffset?: number
	}>
}

export function createTRPCContext(ctx: TrpcContext): TrpcContext {
	return ctx
}

export function cookieFrom(store: Pick<TrpcStore, 'get'>) {
	return store.get('cookie') ?? ''
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
