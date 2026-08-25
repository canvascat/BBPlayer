import type { PlayerSnapshot } from './events'

export const liveState = {
	snapshot: {
		title: '',
		artist: '',
		playing: false,
		lyric: '',
		artwork: '',
	} as PlayerSnapshot,
}
