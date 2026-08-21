import type { LibraryTrack, LocalPlaylist, PlaylistSummary } from '@bbplayer/db'

import type { UpdateCheck } from '../updater'

import type { DesktopEvents } from './events'

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
	refreshAccount: () => Promise<unknown>
	applyAuxSettings: (
		kind: 'lyrics' | 'mini',
		patch: { alwaysOnTop?: boolean; locked?: boolean },
	) => void
	refreshShell: () => void
	openExternal: (url: string) => void | Promise<void>
	copyText: (text: string) => void
	checkUpdate: () => Promise<UpdateCheck>
}

export function createTRPCContext(ctx: TrpcContext): TrpcContext {
	return ctx
}
