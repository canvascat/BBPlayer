import type { DesktopApi } from '../../preload/index'

declare global {
	interface Window {
		bbplayer: DesktopApi
	}
}

export {}
