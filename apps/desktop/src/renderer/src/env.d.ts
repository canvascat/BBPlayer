import type { DesktopApi } from '../../preload/index'

/// <reference types="vite/client" />

declare global {
	interface Window {
		bbplayer: DesktopApi
	}
}

export {}
