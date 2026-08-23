import { BrowserWindow, type Rectangle } from 'electron'

export type AuxKind = 'lyrics' | 'mini'

export interface AuxWindowOptions {
	preload: string
	alwaysOnTop: boolean
	locked?: boolean
	bounds?: Rectangle
	load: (win: BrowserWindow, kind: AuxKind) => void
	onBounds?: (kind: AuxKind, bounds: Rectangle) => void
	onClosed?: (kind: AuxKind) => void
}

const PRESETS: Record<
	AuxKind,
	{
		width: number
		height: number
		minWidth: number
		minHeight: number
		title: string
	}
> = {
	lyrics: {
		width: 440,
		height: 196,
		minWidth: 300,
		minHeight: 140,
		title: '歌词',
	},
	mini: {
		width: 380,
		height: 108,
		minWidth: 300,
		minHeight: 96,
		title: '迷你播放器',
	},
}

const windows: Record<AuxKind, BrowserWindow | null> = {
	lyrics: null,
	mini: null,
}

export function getAuxWindow(kind: AuxKind) {
	return windows[kind]
}

export function closeAuxWindow(kind?: AuxKind) {
	if (kind) {
		windows[kind]?.close()
		windows[kind] = null
		return
	}
	closeAuxWindow('lyrics')
	closeAuxWindow('mini')
}

export function isAuxVisible(kind: AuxKind) {
	const win = windows[kind]
	return Boolean(win && !win.isDestroyed() && win.isVisible())
}

export function toggleAuxWindow(
	kind: AuxKind,
	options: AuxWindowOptions,
	show?: boolean,
) {
	const existing = windows[kind]
	if (existing && !existing.isDestroyed()) {
		if (show === false || (show === undefined && existing.isVisible())) {
			existing.hide()
			return false
		}
		existing.show()
		existing.focus()
		return true
	}
	if (show === false) return false
	const preset = PRESETS[kind]
	const win = new BrowserWindow({
		width: options.bounds?.width ?? preset.width,
		height: options.bounds?.height ?? preset.height,
		x: options.bounds?.x,
		y: options.bounds?.y,
		minWidth: preset.minWidth,
		minHeight: preset.minHeight,
		title: preset.title,
		titleBarStyle: 'hiddenInset',
		trafficLightPosition: { x: 12, y: 12 },
		backgroundColor: '#1a1c20',
		alwaysOnTop: options.alwaysOnTop,
		minimizable: false,
		fullscreenable: false,
		maximizable: false,
		movable: options.locked === false || options.locked === undefined,
		webPreferences: {
			preload: options.preload,
			sandbox: false,
			contextIsolation: true,
		},
	})
	windows[kind] = win
	const persist = () => {
		if (!win.isDestroyed()) options.onBounds?.(kind, win.getBounds())
	}
	win.on('moved', persist)
	win.on('resized', persist)
	win.on('closed', () => {
		windows[kind] = null
		options.onClosed?.(kind)
	})
	options.load(win, kind)
	return true
}

export function applyAuxSettings(
	kind: AuxKind,
	patch: { alwaysOnTop?: boolean; locked?: boolean },
) {
	const win = windows[kind]
	if (!win || win.isDestroyed()) return
	if (typeof patch.alwaysOnTop === 'boolean') {
		win.setAlwaysOnTop(patch.alwaysOnTop)
	}
	if (typeof patch.locked === 'boolean') {
		win.setMovable(!patch.locked)
	}
}
