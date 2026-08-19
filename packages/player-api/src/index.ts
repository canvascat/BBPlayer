export enum PlaybackState {
	IDLE = 1,
	BUFFERING = 2,
	READY = 3,
	ENDED = 4,
}

export enum RepeatMode {
	OFF = 0,
	TRACK = 1,
	QUEUE = 2,
}

export enum DownloadState {
	QUEUED = 0,
	STOPPED = 1,
	DOWNLOADING = 2,
	COMPLETED = 3,
	FAILED = 4,
	REMOVING = 5,
	RESTARTING = 7,
}

export interface PlayerTrack {
	id: string
	url: string
	title?: string
	artist?: string
	artwork?: string
	duration?: number
}

export interface PlayerBackupData {
	playerQueue: Record<string, string | number | boolean>
	loudness: Record<string, number>
}

export interface PlayerPort {
	play(): Promise<void>
	pause(): Promise<void>
	seekTo(positionMs: number): Promise<void>
	skipToNext(): Promise<void>
	skipToPrevious(): Promise<void>
	addToEnd(tracks: PlayerTrack[]): Promise<void>
	playNext(track: PlayerTrack): Promise<void>
	removeTrack(id: string): Promise<void>
	clear(): Promise<void>
	getQueue(): Promise<PlayerTrack[]>
	getCurrentTrack(): Promise<PlayerTrack | null>
	setRepeatMode(mode: RepeatMode): Promise<void>
	setShuffle(enabled: boolean): Promise<void>
	setPlaybackSpeed(speed: number): Promise<void>
	setBilibiliCookie(cookie: string | null): Promise<void>
	downloadTrack(track: PlayerTrack): Promise<void>
	removeDownload(id: string): Promise<void>
	exportData(): Promise<PlayerBackupData>
	importData(data: Partial<PlayerBackupData>): Promise<void>
}
