import { BehaviorSubject, Subject } from 'rxjs'

export type QrUpdate = {
	status: 'generating' | 'polling' | 'expired' | 'success' | 'error'
	statusText: string
	url?: string
	dataUrl?: string
}

export type PlayerSnapshot = {
	title: string
	artist: string
	playing: boolean
	lyric: string
	artwork: string
}

export type DownloadsUpdate = {
	records: unknown[]
	tasks: Record<string, string>
}

export type ShareIncoming = { shareId?: string; inviteCode?: string }

export type GeetestPayload = {
	validate: string
	seccode: string
	challenge: string
}

export function createDesktopEvents() {
	return {
		qr$: new BehaviorSubject<QrUpdate | null>(null),
		geetest$: new Subject<GeetestPayload>(),
		shareIncoming$: new Subject<ShareIncoming>(),
		downloads$: new BehaviorSubject<DownloadsUpdate>({
			records: [],
			tasks: {},
		}),
		lyricsMeta$: new BehaviorSubject<PlayerSnapshot>({
			title: '',
			artist: '',
			playing: false,
			lyric: '',
			artwork: '',
		}),
		lyrics$: new BehaviorSubject<unknown>(null),
		playerCommands$: new Subject<string>(),
	}
}

export type DesktopEvents = ReturnType<typeof createDesktopEvents>
