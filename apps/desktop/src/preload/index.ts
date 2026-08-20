import { contextBridge, ipcRenderer } from 'electron'

export interface BiliAccount {
	mid: number
	name: string
	face: string
}

export interface RemoteFolder {
	kind: 'favorite' | 'collection' | 'toview'
	id: string
	title: string
	coverUrl: string
	itemCount: number
}

export interface RemoteVideo {
	bvid: string
	title: string
	pic: string
	author: string
	duration: string
}

export interface QrUpdate {
	status: 'generating' | 'polling' | 'expired' | 'success' | 'error'
	statusText: string
	url?: string
	dataUrl?: string
}

export interface DesktopSettings {
	cookie: string
	continuePlayingAfterClose: boolean
	lyricsAlwaysOnTop: boolean
	lyricsWindowLocked: boolean
	autoOpenLyricsWindow: boolean
	menuBarShowLyrics: boolean
	miniAlwaysOnTop: boolean
	autoOpenMiniWindow: boolean
	account: BiliAccount | null
	autoCache: boolean
	bbplayerAccount: {
		id: string
		username: string
		name: string
		face: string | null
	} | null
	skin: {
		name: string
		coverUrl: string
		primary: string
	} | null
}

export interface ResolvePlayResult {
	playUrl: string
	lyrics: Array<{
		words: Array<{
			word: string
			startTime: number
			endTime: number
			romanWord?: string
		}>
		translatedLyric: string
		romanLyric: string
		startTime: number
		endTime: number
		isBG: boolean
		isDuet: boolean
	}>
	cached?: boolean
	lyricSource?: string
}

export interface PlaySession {
	queue: Array<{
		id: string
		bvid: string
		cid: number
		title: string
		artist: string
		artwork: string
		duration: number
	}>
	index: number
	positionMs: number
	repeatMode: 0 | 1 | 2
	shuffle: boolean
	playbackRate: number
}

export interface LibraryTrack {
	id: string
	bvid: string
	cid: number
	title: string
	artist: string
	artwork: string
	duration: number
}

export interface PlaylistSummary {
	id: string
	title: string
	description: string
	coverUrl: string
	itemCount: number
	updatedAt: number
	shareId: string | null
	shareRole: 'owner' | 'editor' | 'subscriber' | null
}

export interface LocalPlaylist {
	id: string
	title: string
	description: string
	coverUrl: string
	createdAt: number
	updatedAt: number
	shareId: string | null
	shareRole: 'owner' | 'editor' | 'subscriber' | null
	lastShareSyncAt: number | null
	tracks: LibraryTrack[]
}

export interface PlayerSnapshot {
	title: string
	artist: string
	playing: boolean
	lyric: string
	artwork: string
}

const api = {
	getSettings: (): Promise<DesktopSettings> =>
		ipcRenderer.invoke('settings:get'),
	setSettings: (patch: Partial<DesktopSettings>) =>
		ipcRenderer.invoke('settings:set', patch),
	getSession: (): Promise<PlaySession | null> =>
		ipcRenderer.invoke('session:get'),
	setSession: (session: PlaySession | null) =>
		ipcRenderer.invoke('session:set', session),
	matchSearch: (query: string) => ipcRenderer.invoke('search:match', query),
	searchVideos: (keyword: string) => ipcRenderer.invoke('bili:search', keyword),
	getVideo: (bvid: string) => ipcRenderer.invoke('bili:video', bvid),
	resolvePlay: (track: {
		id?: string
		bvid: string
		cid: number
		title: string
		artist?: string
		artwork?: string
		duration?: number
	}): Promise<ResolvePlayResult> => ipcRenderer.invoke('player:resolve', track),
	openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
	startQrLogin: () => ipcRenderer.invoke('auth:qrStart'),
	cancelQrLogin: () => ipcRenderer.invoke('auth:qrCancel'),
	getAccount: (): Promise<BiliAccount | null> => ipcRenderer.invoke('auth:me'),
	refreshAccount: (): Promise<BiliAccount | null> =>
		ipcRenderer.invoke('auth:refresh'),
	logoutBilibili: () => ipcRenderer.invoke('auth:logout'),
	startPhoneLogin: (tel: string): Promise<{ captchaKey: string }> =>
		ipcRenderer.invoke('auth:phoneStart', tel),
	loginWithPhone: (payload: {
		tel: string
		code: string
		captchaKey: string
	}): Promise<DesktopSettings> =>
		ipcRenderer.invoke('auth:phoneLogin', payload),
	completeGeetest: (payload: {
		validate: string
		seccode: string
		challenge: string
	}) => {
		ipcRenderer.send('geetest:done', payload)
	},
	listRemoteLibrary: (): Promise<{
		account: BiliAccount | null
		favorites: RemoteFolder[]
		collections: RemoteFolder[]
		watchLater: number
	}> => ipcRenderer.invoke('bili:library'),
	listFavorite: (
		id: string,
	): Promise<{ title: string; videos: RemoteVideo[] }> =>
		ipcRenderer.invoke('bili:favorite', id),
	listCollection: (
		id: string,
	): Promise<{ title: string; videos: RemoteVideo[] }> =>
		ipcRenderer.invoke('bili:collection', id),
	listWatchLater: (): Promise<{
		title: string
		videos: RemoteVideo[]
		itemCount: number
	}> => ipcRenderer.invoke('bili:toview'),
	listUploader: (
		mid: string,
	): Promise<{ title: string; videos: RemoteVideo[] }> =>
		ipcRenderer.invoke('bili:uploader', mid),
	onQrUpdate: (callback: (payload: QrUpdate) => void) => {
		const listener = (_event: unknown, payload: QrUpdate) => callback(payload)
		ipcRenderer.on('auth:qr', listener)
		return () => ipcRenderer.removeListener('auth:qr', listener)
	},
	reportState: (state: PlayerSnapshot) => {
		ipcRenderer.send('player:state', state)
	},
	getSnapshot: (): Promise<PlayerSnapshot> =>
		ipcRenderer.invoke('player:snapshot'),
	pushLyrics: (payload: unknown) => {
		ipcRenderer.send('lyrics:push', payload)
	},
	toggleLyricsWindow: (show?: boolean): Promise<boolean> =>
		ipcRenderer.invoke('lyrics:toggle', show),
	toggleMiniWindow: (show?: boolean): Promise<boolean> =>
		ipcRenderer.invoke('mini:toggle', show),
	lyricsWindowVisible: (): Promise<boolean> =>
		ipcRenderer.invoke('lyrics:visible'),
	getCurrentLyrics: () => ipcRenderer.invoke('lyrics:current'),
	listPlaylists: (): Promise<PlaylistSummary[]> =>
		ipcRenderer.invoke('library:list'),
	getPlaylist: (id: string): Promise<LocalPlaylist | null> =>
		ipcRenderer.invoke('library:get', id),
	createPlaylist: (payload: {
		title: string
		description?: string
		tracks?: LibraryTrack[]
	}): Promise<LocalPlaylist> => ipcRenderer.invoke('library:create', payload),
	renamePlaylist: (payload: { id: string; title: string }) =>
		ipcRenderer.invoke('library:rename', payload),
	deletePlaylist: (id: string) => ipcRenderer.invoke('library:delete', id),
	addToPlaylist: (payload: { playlistId: string; tracks: LibraryTrack[] }) =>
		ipcRenderer.invoke('library:addTracks', payload),
	removeFromPlaylist: (payload: { playlistId: string; trackId: string }) =>
		ipcRenderer.invoke('library:removeTrack', payload),
	listDownloads: () => ipcRenderer.invoke('downloads:list'),
	downloadStatus: () => ipcRenderer.invoke('downloads:status'),
	cacheTrack: (track: LibraryTrack) =>
		ipcRenderer.invoke('downloads:start', track),
	removeDownload: (id: string) => ipcRenderer.invoke('downloads:remove', id),
	exportDownloads: (ids?: string[]) =>
		ipcRenderer.invoke('downloads:export', ids),
	importBackup: () => ipcRenderer.invoke('backup:import'),
	exportBackup: () => ipcRenderer.invoke('backup:export'),
	loginBbplayer: (payload: {
		username: string
		password: string
	}): Promise<DesktopSettings & { restoreMessage: string }> =>
		ipcRenderer.invoke('bbplayer:login', payload),
	registerBbplayer: (payload: {
		username: string
		password: string
		name?: string
		face?: string
	}): Promise<DesktopSettings & { restoreMessage: string }> =>
		ipcRenderer.invoke('bbplayer:register', payload),
	logoutBbplayer: (): Promise<DesktopSettings> =>
		ipcRenderer.invoke('bbplayer:logout'),
	updateBbplayerProfile: (payload: {
		name?: string
		face?: string
	}): Promise<DesktopSettings> =>
		ipcRenderer.invoke('bbplayer:updateProfile', payload),
	fillBbplayerFromBili: (): Promise<DesktopSettings> =>
		ipcRenderer.invoke('bbplayer:fillFromBili'),
	refreshBbplayer: (): Promise<DesktopSettings> =>
		ipcRenderer.invoke('bbplayer:refresh'),
	restoreSharedPlaylists: (): Promise<{ restored: number; message: string }> =>
		ipcRenderer.invoke('bbplayer:restore'),
	previewSharedPlaylist: (input: string) =>
		ipcRenderer.invoke('share:preview', input),
	enableSharing: (playlistId: string) =>
		ipcRenderer.invoke('share:enable', playlistId),
	subscribeSharedPlaylist: (payload: { input: string; inviteCode?: string }) =>
		ipcRenderer.invoke('share:subscribe', payload),
	pullSharedPlaylist: (playlistId: string) =>
		ipcRenderer.invoke('share:pull', playlistId),
	copyShareLink: (payload: {
		playlistId: string
		kind: 'subscribe' | 'editor'
	}) => ipcRenderer.invoke('share:copyLink', payload),
	rotateShareInvite: (playlistId: string) =>
		ipcRenderer.invoke('share:rotateInvite', playlistId),
	takePendingShare: (): Promise<{
		shareId?: string
		inviteCode?: string
	} | null> => ipcRenderer.invoke('share:pending'),
	onShareIncoming: (
		callback: (payload: { shareId?: string; inviteCode?: string }) => void,
	) => {
		const listener = (
			_event: unknown,
			payload: { shareId?: string; inviteCode?: string },
		) => callback(payload)
		ipcRenderer.on('share:incoming', listener)
		return () => ipcRenderer.removeListener('share:incoming', listener)
	},
	copyText: (text: string) => ipcRenderer.invoke('clipboard:write', text),
	getComments: (payload: {
		bvid: string
		next?: number
		mode?: number
	}): Promise<{
		replies: Array<{
			rpid: number
			mid: number
			like: number
			action: number
			ctime: number
			rcount: number
			uname: string
			avatar: string
			message: string
			replies: unknown[]
		}>
		next: number
		isEnd: boolean
		allCount: number
	}> => ipcRenderer.invoke('bili:comments', payload),
	getReplyComments: (payload: {
		bvid: string
		rpid: number
		pn?: number
	}): Promise<
		Array<{
			rpid: number
			mid: number
			like: number
			action: number
			ctime: number
			rcount: number
			uname: string
			avatar: string
			message: string
			replies: unknown[]
		}>
	> => ipcRenderer.invoke('bili:commentReplies', payload),
	likeComment: (payload: { bvid: string; rpid: number; action: 0 | 1 }) =>
		ipcRenderer.invoke('bili:commentLike', payload),
	searchSkins: (
		keyword: string,
	): Promise<{
		list: Array<{ itemId: number; name: string; coverUrl: string }>
		total: number
	}> => ipcRenderer.invoke('bili:garbSearch', keyword),
	fetchSkinCover: (url: string): Promise<string> =>
		ipcRenderer.invoke('skin:cover', url),
	checkUpdate: () => ipcRenderer.invoke('updater:check'),
	onDownloadsUpdate: (
		callback: (payload: {
			records: LibraryTrack[]
			tasks: Record<string, string>
		}) => void,
	) => {
		const listener = (
			_event: unknown,
			payload: { records: LibraryTrack[]; tasks: Record<string, string> },
		) => callback(payload)
		ipcRenderer.on('downloads:update', listener)
		return () => ipcRenderer.removeListener('downloads:update', listener)
	},
	sendCommand: (command: string) => {
		ipcRenderer.send('player:command-from-ui', command)
	},
	onCommand: (callback: (command: string) => void) => {
		const listener = (_event: unknown, command: string) => callback(command)
		ipcRenderer.on('player:command', listener)
		return () => ipcRenderer.removeListener('player:command', listener)
	},
	onLyricsUpdate: (callback: (payload: unknown) => void) => {
		const listener = (_event: unknown, payload: unknown) => callback(payload)
		ipcRenderer.on('lyrics:update', listener)
		return () => ipcRenderer.removeListener('lyrics:update', listener)
	},
	onLyricsMeta: (callback: (payload: PlayerSnapshot) => void) => {
		const listener = (_event: unknown, payload: PlayerSnapshot) =>
			callback(payload)
		ipcRenderer.on('lyrics:meta', listener)
		return () => ipcRenderer.removeListener('lyrics:meta', listener)
	},
}

contextBridge.exposeInMainWorld('bbplayer', api)

export type DesktopApi = typeof api
