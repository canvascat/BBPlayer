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

export type GeetestPayload = {
	validate: string
	seccode: string
	challenge: string
}

export function createDesktopEvents() {
	return {
		qr$: new BehaviorSubject<QrUpdate | null>(null),
		geetest$: new Subject<GeetestPayload>(),
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
		playerCommands$: new Subject<string>(),
	}
}

export type DesktopEvents = ReturnType<typeof createDesktopEvents>
