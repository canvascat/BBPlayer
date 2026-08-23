import type { DesktopApi } from '@bbplayer/main/preload'

/// <reference types="vite/client" />

declare global {
	interface Window {
		bbplayer: DesktopApi
	}
}

export {}
