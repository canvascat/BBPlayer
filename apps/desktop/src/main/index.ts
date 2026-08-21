import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	describeSearchFailure,
	generateUniqueTrackKey,
	matchSearchStrategies,
	splLinesToAmll,
} from '@bbplayer/core'
import {
	PlayerDatabase,
	type LibraryTrack,
	type LocalPlaylist,
} from '@bbplayer/db'
import { parseAndMergeLyrics } from '@bbplayer/splash'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	globalShortcut,
	ipcMain,
	Menu,
	nativeImage,
	session,
	shell,
	Tray,
	type Rectangle,
} from 'electron'
import Store from 'electron-store'

const { autoUpdater } = createRequire(import.meta.url)(
	'electron-updater',
) as typeof import('electron-updater')

import {
	installAppProtocolHandler,
	registerAppSchemePrivileged,
} from './app-protocol'
import { audioProxy } from './audio-proxy'
import { generateLoginQr, pollLoginQr, QrStatusCode } from './auth'
import {
	applyAuxSettings,
	closeAuxWindow,
	isAuxVisible,
	sendToAux,
	toggleAuxWindow,
	type AuxKind,
	type AuxWindowOptions,
} from './aux-windows'
import { readBackupZip, writeBackupZip } from './backup'
import { type BbplayerAccount, validateCredentials } from './bbplayer-account'
import {
	fetchMe,
	loginRequest,
	registerRequest,
	updateProfileRequest,
} from './bbplayer-api'
import {
	clearWbiCache,
	fetchImageDataUrl,
	getAccount,
	getAudioStream,
	getCollectionVideos,
	getCollections,
	getComments,
	getFavoriteFolders,
	getFavoriteVideos,
	getReplyComments,
	getUploaderVideos,
	getVideoDetails,
	getWatchLater,
	likeComment,
	resolveB23,
	searchGarbSkins,
	searchVideos,
	type BiliAccount,
} from './bili'
import { BILI_IMAGE_URL_FILTER, withBiliImageHeaders } from './bili-image'
import { downloadManager, type CachedTrack } from './downloads'
import { exportCachedTracks, exportSummary } from './export-audio'
import { fetchMatchedLyrics } from './lyrics-fetch'
import { phoneFormModel } from './phone-form'
import {
	getPhoneLoginCaptcha,
	loginWithPhoneSms,
	openGeetestWindow,
	sendPhoneLoginSms,
} from './phone-login'
import { parseShareLink } from './share-link'
import {
	copyShareLink,
	enableSharing,
	previewSharedPlaylist,
	pullSharedChanges,
	restoreFromCloud,
	rotateInvite,
	subscribeToSharedPlaylist,
} from './shared-playlists'
import { createTRPCContext } from './trpc/context'
import { createDesktopEvents } from './trpc/events'
import { appRouter } from './trpc/router'
import { interpretUpdate, notesFromRelease } from './updater'

registerAppSchemePrivileged()

const events = createDesktopEvents()

interface Settings {
	cookie: string
	continuePlayingAfterClose: boolean
	lyricsAlwaysOnTop: boolean
	lyricsWindowLocked: boolean
	autoOpenLyricsWindow: boolean
	menuBarShowLyrics: boolean
	miniAlwaysOnTop: boolean
	autoOpenMiniWindow: boolean
	autoCache: boolean
	skin: {
		name: string
		coverUrl: string
		primary: string
	} | null
}

interface PlayerSnapshot {
	title: string
	artist: string
	playing: boolean
	lyric: string
	artwork: string
}

interface PlaySession {
	queue: LibraryTrack[]
	index: number
	positionMs: number
	repeatMode: 0 | 1 | 2
	shuffle: boolean
	playbackRate: number
}

interface Persisted {
	session?: PlaySession
	playlists: LocalPlaylist[]
	windowBounds: Partial<Record<AuxKind, Rectangle>>
	lyricsWindowOpen: boolean
	miniWindowOpen: boolean
	account: BiliAccount | null
	downloads: CachedTrack[]
	bbplayerToken?: string
	bbplayerAccount?: BbplayerAccount | null
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(__dirname, '../..')
const RENDERER_DIST = join(APP_ROOT, 'dist')
const PRELOAD = join(__dirname, '../preload/index.cjs')

let store!: Store<Settings & Persisted>
let playerDb!: PlayerDatabase

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let snapshot: PlayerSnapshot = {
	title: '',
	artist: '',
	playing: false,
	lyric: '',
	artwork: '',
}
let lastLyrics: unknown = null
let qrTimer: ReturnType<typeof setInterval> | null = null
let qrKey = ''

function emitQr(payload: {
	status: 'generating' | 'polling' | 'expired' | 'success' | 'error'
	statusText: string
	url?: string
	dataUrl?: string
}) {
	if (!mainWindow || mainWindow.isDestroyed()) return
	mainWindow.webContents.send('auth:qr', payload)
}

function stopQr() {
	if (qrTimer) {
		clearInterval(qrTimer)
		qrTimer = null
	}
	qrKey = ''
}

async function refreshAccount() {
	try {
		clearWbiCache()
		const account = await getAccount(cookie())
		store.set('account', account)
		return account
	} catch {
		store.set('account', null)
		return null
	}
}

function cookie() {
	return store.get('cookie') ?? ''
}

function settings() {
	return {
		cookie: cookie(),
		continuePlayingAfterClose: store.get('continuePlayingAfterClose') ?? true,
		lyricsAlwaysOnTop: store.get('lyricsAlwaysOnTop') ?? true,
		lyricsWindowLocked: store.get('lyricsWindowLocked') ?? false,
		autoOpenLyricsWindow: store.get('autoOpenLyricsWindow') ?? false,
		menuBarShowLyrics: store.get('menuBarShowLyrics') ?? false,
		miniAlwaysOnTop: store.get('miniAlwaysOnTop') ?? true,
		autoOpenMiniWindow: store.get('autoOpenMiniWindow') ?? false,
		autoCache: store.get('autoCache') ?? true,
		account: store.get('account') ?? null,
		skin: store.get('skin') ?? null,
		bbplayerAccount: store.get('bbplayerAccount') ?? null,
	}
}

function bbplayerToken() {
	return store.get('bbplayerToken') || null
}

function saveBbplayerSession(token: string, account: BbplayerAccount) {
	store.set('bbplayerToken', token)
	store.set('bbplayerAccount', account)
}

function clearBbplayerSession() {
	store.delete('bbplayerToken')
	store.set('bbplayerAccount', null)
}

async function finishBbplayerAuth() {
	try {
		return await restoreFromCloud(playerDb, bbplayerToken())
	} catch {
		return { restored: 0, message: '同步云端共享歌单失败' }
	}
}

let pendingShareUrl: string | null = null

function emitShareLink(url: string) {
	const parsed = parseShareLink(url)
	if (!parsed.shareId) return
	pendingShareUrl = url
	if (!mainWindow || mainWindow.isDestroyed()) return
	showMain()
	const send = () => {
		if (!mainWindow || mainWindow.isDestroyed()) return
		mainWindow.webContents.send('share:incoming', parsed)
	}
	if (mainWindow.webContents.isLoadingMainFrame()) {
		mainWindow.webContents.once('did-finish-load', send)
		return
	}
	send()
}

function loadRenderer(
	win: BrowserWindow,
	page: 'index.html' | 'lyrics.html' | 'mini.html',
) {
	if (process.env.VITE_DEV_SERVER_URL) {
		const url = new URL(process.env.VITE_DEV_SERVER_URL)
		if (page !== 'index.html') url.pathname = `/${page}`
		void win.loadURL(url.toString())
		return
	}
	void win.loadFile(join(RENDERER_DIST, page))
}

function showMain() {
	if (!mainWindow || mainWindow.isDestroyed()) createWindow()
	mainWindow?.show()
	mainWindow?.focus()
}

function sendCommand(command: string) {
	if (!mainWindow || mainWindow.isDestroyed()) return
	mainWindow.webContents.send('player:command', command)
}

function auxOptions(kind: AuxKind): AuxWindowOptions {
	return {
		preload: PRELOAD,
		alwaysOnTop:
			kind === 'mini'
				? (store.get('miniAlwaysOnTop') ?? true)
				: (store.get('lyricsAlwaysOnTop') ?? true),
		locked: kind === 'lyrics' ? store.get('lyricsWindowLocked') : false,
		bounds: store.get('windowBounds')?.[kind],
		load: (win) =>
			loadRenderer(win, kind === 'lyrics' ? 'lyrics.html' : 'mini.html'),
		onBounds: (target, bounds) => {
			store.set('windowBounds', {
				...store.get('windowBounds'),
				[target]: bounds,
			})
		},
		onClosed: (target) => {
			if (isQuitting) return
			store.set(
				target === 'lyrics' ? 'lyricsWindowOpen' : 'miniWindowOpen',
				false,
			)
		},
	}
}

function openAux(kind: AuxKind, show?: boolean) {
	const visible = toggleAuxWindow(kind, auxOptions(kind), show)
	store.set(kind === 'lyrics' ? 'lyricsWindowOpen' : 'miniWindowOpen', visible)
	return visible
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 960,
		minHeight: 640,
		title: 'BBPlayer',
		titleBarStyle: 'hiddenInset',
		trafficLightPosition: { x: 16, y: 18 },
		backgroundColor: '#1a1c20',
		webPreferences: {
			preload: PRELOAD,
			sandbox: false,
			contextIsolation: true,
		},
	})
	mainWindow.on('close', (event) => {
		if (!isQuitting && store.get('continuePlayingAfterClose')) {
			event.preventDefault()
			mainWindow?.hide()
		}
	})
	loadRenderer(mainWindow, 'index.html')
}

function truncate(text: string, max = 22) {
	const trimmed = text.trim()
	if (trimmed.length <= max) return trimmed
	return `${trimmed.slice(0, max)}…`
}

function refreshShell() {
	const hasTrack = Boolean(snapshot.title)
	const lyricOrTitle = snapshot.lyric || snapshot.title
	const trayTitle = store.get('menuBarShowLyrics')
		? truncate(lyricOrTitle || 'BB')
		: hasTrack
			? truncate(snapshot.title, 10)
			: 'BB'
	tray?.setTitle(trayTitle)
	tray?.setToolTip(
		hasTrack ? `${snapshot.title} · ${snapshot.artist}` : 'BBPlayer',
	)
	const playbackItems: Electron.MenuItemConstructorOptions[] = [
		{
			label: snapshot.title || '未在播放',
			enabled: false,
		},
		{ type: 'separator' },
		{
			label: snapshot.playing ? '暂停' : '播放',
			click: () => sendCommand('playpause'),
			enabled: hasTrack,
		},
		{
			label: '上一首',
			click: () => sendCommand('prev'),
			enabled: hasTrack,
		},
		{
			label: '下一首',
			click: () => sendCommand('next'),
			enabled: hasTrack,
		},
		{ type: 'separator' },
		{
			label: '打开歌词窗口',
			accelerator: 'Alt+Command+L',
			click: () => openAux('lyrics'),
		},
		{
			label: '打开迷你窗口',
			accelerator: 'Alt+Command+M',
			click: () => openAux('mini'),
		},
		{
			label: '显示主窗口',
			click: () => showMain(),
		},
		{ type: 'separator' },
		{
			label: '退出 BBPlayer',
			click: () => {
				isQuitting = true
				app.quit()
			},
		},
	]
	tray?.setContextMenu(Menu.buildFromTemplate(playbackItems))
	if (process.platform === 'darwin') {
		app.dock?.setMenu(
			Menu.buildFromTemplate([
				{
					label: snapshot.playing ? '暂停' : '播放',
					click: () => sendCommand('playpause'),
					enabled: hasTrack,
				},
				{
					label: '上一首',
					click: () => sendCommand('prev'),
					enabled: hasTrack,
				},
				{
					label: '下一首',
					click: () => sendCommand('next'),
					enabled: hasTrack,
				},
				{ type: 'separator' },
				{ label: '显示主窗口', click: () => showMain() },
			]),
		)
	}
	createMenu()
}

function createTray() {
	const image = nativeImage.createFromDataURL(
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVR4nGNgGAWjYBSMglEwCkbBKBicwPj////G/4xH8GRgZGRkYG3HjBqBgFo2AUjAIA6p4GBQf8n5sAAAAASUVORK5CYII=',
	)
	tray = new Tray(image)
	tray.on('click', () => showMain())
	refreshShell()
}

function createMenu() {
	const hasTrack = Boolean(snapshot.title)
	const template: Electron.MenuItemConstructorOptions[] = [
		{
			label: app.name,
			submenu: [
				{ role: 'about' },
				{ type: 'separator' },
				{
					label: '设置…',
					accelerator: 'CommandOrControl+,',
					click: () => {
						showMain()
						sendCommand('open-settings')
					},
				},
				{ type: 'separator' },
				{ role: 'hide' },
				{ role: 'hideOthers' },
				{ role: 'unhide' },
				{ type: 'separator' },
				{
					label: '退出 BBPlayer',
					accelerator: 'CmdOrCtrl+Q',
					click: () => {
						isQuitting = true
						app.quit()
					},
				},
			],
		},
		{
			label: '文件',
			submenu: [
				{
					label: '导出已缓存音频…',
					click: () => {
						void exportDownloads(undefined, true)
					},
				},
				{ type: 'separator' },
				{
					label: '导入备份…',
					click: () => {
						void importBackup(true)
					},
				},
				{
					label: '导出备份…',
					click: () => {
						void exportBackup(true)
					},
				},
			],
		},
		{ role: 'editMenu' },
		{
			label: '查看',
			submenu: [
				{ role: 'reload', label: '重新加载' },
				{ role: 'forceReload', label: '强制重新加载' },
				{ role: 'toggleDevTools', label: '开发者工具' },
				{ type: 'separator' },
				{ role: 'resetZoom', label: '实际大小' },
				{ role: 'zoomIn', label: '放大' },
				{ role: 'zoomOut', label: '缩小' },
				{ type: 'separator' },
				{ role: 'togglefullscreen', label: '进入全屏幕' },
			],
		},
		{
			label: '播放',
			submenu: [
				{
					label: snapshot.playing ? '暂停' : '播放',
					enabled: hasTrack,
					click: () => sendCommand('playpause'),
				},
				{
					label: '上一首',
					enabled: hasTrack,
					click: () => sendCommand('prev'),
				},
				{
					label: '下一首',
					enabled: hasTrack,
					click: () => sendCommand('next'),
				},
				{ type: 'separator' },
				{
					label: '循环',
					submenu: [
						{
							label: '关闭',
							click: () => sendCommand('repeat-off'),
						},
						{
							label: '单曲循环',
							click: () => sendCommand('repeat-track'),
						},
						{
							label: '列表循环',
							click: () => sendCommand('repeat-queue'),
						},
					],
				},
				{
					label: '随机',
					click: () => sendCommand('shuffle'),
				},
				{
					label: '打开队列',
					click: () => {
						showMain()
						sendCommand('open-queue')
					},
				},
				{
					label: '定时关闭',
					submenu: [
						{ label: '15 分钟', click: () => sendCommand('sleep-15') },
						{ label: '30 分钟', click: () => sendCommand('sleep-30') },
						{ label: '45 分钟', click: () => sendCommand('sleep-45') },
						{ label: '60 分钟', click: () => sendCommand('sleep-60') },
						{ label: '取消定时', click: () => sendCommand('sleep-off') },
					],
				},
			],
		},
		{
			label: '窗口',
			submenu: [
				{ label: '显示主窗口', click: () => showMain() },
				{
					label: '打开播放器',
					click: () => {
						showMain()
						sendCommand('open-player')
					},
				},
				{
					label: '打开歌词窗口',
					accelerator: 'Alt+Command+L',
					click: () => openAux('lyrics'),
				},
				{
					label: '打开迷你窗口',
					accelerator: 'Alt+Command+M',
					click: () => openAux('mini'),
				},
				{ role: 'minimize' },
			],
		},
		{
			role: 'help',
			submenu: [
				{
					label: '检查更新',
					click: () => {
						void checkUpdates(true)
					},
				},
			],
		},
	]
	Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerShortcuts() {
	const bindings: Array<[string, string]> = [
		['MediaPlayPause', 'playpause'],
		['MediaNextTrack', 'next'],
		['MediaPreviousTrack', 'prev'],
		['MediaStop', 'pause'],
	]
	for (const [accelerator, command] of bindings) {
		try {
			globalShortcut.register(accelerator, () => sendCommand(command))
		} catch {
			// 部分系统由 Media Session 接管
		}
	}
}

async function exportDownloads(ids?: string[], notify = false) {
	const records = downloadManager
		.list()
		.filter((item) => !ids?.length || ids.includes(item.id))
	if (!records.length) {
		if (notify) {
			await dialog.showMessageBox({
				type: 'info',
				message: '没有可导出的歌曲',
			})
		}
		return { ok: false, message: '没有可导出的歌曲', exported: 0, failed: [] }
	}
	const picked = await dialog.showOpenDialog({
		title: '选择导出目录',
		properties: ['openDirectory', 'createDirectory'],
	})
	if (picked.canceled || !picked.filePaths[0]) {
		return { ok: false, message: '已取消', exported: 0, failed: [] }
	}
	const result = await exportCachedTracks({
		directory: picked.filePaths[0],
		records,
		filePath: (id) => downloadManager.filePath(id),
	})
	const message = exportSummary(result.exported, result.failed)
	if (notify) {
		await dialog.showMessageBox({
			type: result.failed.length ? 'warning' : 'info',
			message,
		})
	}
	return { ok: result.exported > 0, message, ...result }
}

async function exportBackup(notify = false) {
	const picked = await dialog.showSaveDialog({
		title: '导出备份',
		defaultPath: 'bbplayer-backup.zip',
		filters: [{ name: 'BBPlayer 备份', extensions: ['zip', 'bbplayer'] }],
	})
	if (picked.canceled || !picked.filePath) {
		return { ok: false, message: '已取消', count: 0 }
	}
	const bytes = await writeBackupZip(playerDb)
	writeFileSync(picked.filePath, bytes)
	const message = `已导出 ${playerDb.list().length} 个歌单`
	if (notify) {
		await dialog.showMessageBox({ type: 'info', message })
	}
	return { ok: true, message, count: playerDb.list().length }
}

async function importBackup(notify = false) {
	const picked = await dialog.showOpenDialog({
		title: '导入备份',
		filters: [{ name: 'BBPlayer 备份', extensions: ['zip', 'bbplayer'] }],
		properties: ['openFile'],
	})
	if (picked.canceled || !picked.filePaths[0]) {
		return { ok: false, message: '已取消', count: 0 }
	}
	const result = await readBackupZip(readFileSync(picked.filePaths[0]))
	if (result.sqliteBytes) {
		playerDb.replaceFromBytes(result.sqliteBytes)
	} else {
		playerDb.importPlaylists(result.playlists)
	}
	const message = `已导入 ${result.playlists.length} 个歌单`
	if (notify) {
		await dialog.showMessageBox({ type: 'info', message })
	}
	return { ok: true, message, count: result.playlists.length }
}

async function checkUpdates(notify = false) {
	let result
	try {
		const update = await autoUpdater.checkForUpdates()
		result = interpretUpdate(
			app.getVersion(),
			update?.updateInfo.version,
			notesFromRelease(update?.updateInfo.releaseNotes),
		)
	} catch {
		result = interpretUpdate(app.getVersion())
	}
	if (!notify) return result
	if (result.status === 'available' && result.latestVersion) {
		const { response } = await dialog.showMessageBox({
			type: 'info',
			buttons: app.isPackaged ? ['下载更新', '稍后'] : ['打开下载页', '稍后'],
			defaultId: 0,
			cancelId: 1,
			message: result.message,
			detail: result.notes,
		})
		if (response !== 0) return result
		if (!app.isPackaged) {
			await shell.openExternal(
				`https://github.com/bbplayer-app/BBPlayer/releases/tag/v${result.latestVersion}`,
			)
			return result
		}
		try {
			await autoUpdater.downloadUpdate()
		} catch {
			await dialog.showMessageBox({
				type: 'error',
				message: '检查更新失败',
			})
			return result
		}
		const install = await dialog.showMessageBox({
			type: 'info',
			buttons: ['立即安装', '稍后'],
			defaultId: 0,
			cancelId: 1,
			message: `发现新版本 ${result.latestVersion}`,
			detail: '更新已下载，重启后完成安装。',
		})
		if (install.response === 0) {
			isQuitting = true
			autoUpdater.quitAndInstall()
		}
		return result
	}
	await dialog.showMessageBox({
		type: result.status === 'error' ? 'error' : 'info',
		message: result.message,
	})
	return result
}

function registerIpc() {
	ipcMain.on('player:state', (_e, next: PlayerSnapshot) => {
		if (
			snapshot.title === next.title &&
			snapshot.artist === next.artist &&
			snapshot.playing === next.playing &&
			snapshot.lyric === next.lyric &&
			snapshot.artwork === next.artwork
		) {
			return
		}
		snapshot = next
		sendToAux('lyrics:meta', next)
		refreshShell()
	})
	ipcMain.handle('player:snapshot', () => snapshot)
	ipcMain.on('lyrics:push', (_e, payload: unknown) => {
		lastLyrics = payload
		sendToAux('lyrics:update', payload)
	})
	ipcMain.handle('lyrics:current', () => lastLyrics)
	ipcMain.on('player:command-from-ui', (_e, command: string) => {
		sendCommand(command)
	})
	ipcMain.handle('lyrics:toggle', (_e, show?: boolean) =>
		openAux('lyrics', show),
	)
	ipcMain.handle('mini:toggle', (_e, show?: boolean) => openAux('mini', show))
	ipcMain.handle('lyrics:visible', () => isAuxVisible('lyrics'))
	ipcMain.handle('mini:visible', () => isAuxVisible('mini'))
	ipcMain.handle('auth:me', () => store.get('account') ?? null)
	ipcMain.handle('auth:refresh', () => refreshAccount())
	ipcMain.handle('auth:logout', async () => {
		stopQr()
		store.set('cookie', '')
		store.set('account', null)
		clearWbiCache()
		return true
	})
	ipcMain.handle('auth:qrCancel', () => {
		stopQr()
		return true
	})
	ipcMain.handle('auth:qrStart', async () => {
		stopQr()
		emitQr({ status: 'generating', statusText: '正在生成二维码...' })
		try {
			const qr = await generateLoginQr()
			qrKey = qr.qrcodeKey
			emitQr({
				status: 'polling',
				statusText: '等待扫码',
				url: qr.url,
				dataUrl: qr.dataUrl,
			})
			qrTimer = setInterval(() => {
				void (async () => {
					if (!qrKey) return
					try {
						const poll = await pollLoginQr(qrKey)
						if (poll.status === QrStatusCode.WAIT) {
							emitQr({
								status: 'polling',
								statusText: poll.statusText,
								url: qr.url,
								dataUrl: qr.dataUrl,
							})
							return
						}
						if (poll.status === QrStatusCode.SCANNED) {
							emitQr({
								status: 'polling',
								statusText: poll.statusText,
								url: qr.url,
								dataUrl: qr.dataUrl,
							})
							return
						}
						if (poll.status === QrStatusCode.EXPIRED) {
							stopQr()
							emitQr({ status: 'expired', statusText: poll.statusText })
							return
						}
						if (poll.status === QrStatusCode.SUCCESS) {
							stopQr()
							store.set('cookie', poll.cookie)
							await refreshAccount()
							emitQr({ status: 'success', statusText: '登录成功' })
						}
					} catch (error) {
						stopQr()
						emitQr({
							status: 'error',
							statusText:
								error instanceof Error ? error.message : String(error),
						})
					}
				})()
			}, 2000)
			return { url: qr.url, dataUrl: qr.dataUrl }
		} catch (error) {
			emitQr({
				status: 'error',
				statusText: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	})
	ipcMain.handle('auth:phoneStart', async (_e, tel: string) => {
		const telError = phoneFormModel.tel.validate(tel)
		if (telError) throw new Error(telError)
		const captcha = await getPhoneLoginCaptcha()
		const geetest = await openGeetestWindow({
			gt: captcha.gt,
			challenge: captcha.challenge,
			preload: PRELOAD,
			parent: mainWindow,
		})
		return sendPhoneLoginSms({
			tel,
			token: captcha.token,
			challenge: geetest.challenge,
			validate: geetest.validate,
			seccode: geetest.seccode,
		})
	})
	ipcMain.handle(
		'auth:phoneLogin',
		async (_e, payload: { tel: string; code: string; captchaKey: string }) => {
			const codeError = phoneFormModel.smsCode.validate(payload.code)
			if (codeError) throw new Error(codeError)
			const cookieHeader = await loginWithPhoneSms(payload)
			store.set('cookie', cookieHeader)
			await refreshAccount()
			return settings()
		},
	)
	ipcMain.handle('bili:library', async () => {
		const account = store.get('account') ?? (await refreshAccount())
		if (!account) {
			return { account: null, favorites: [], collections: [], watchLater: 0 }
		}
		const [favorites, collections, watchLater] = await Promise.all([
			getFavoriteFolders(cookie(), account.mid),
			getCollections(cookie(), account.mid),
			getWatchLater(cookie()).catch(() => ({
				itemCount: 0,
				videos: [],
				title: '稍后再看',
			})),
		])
		return {
			account,
			favorites,
			collections,
			watchLater: watchLater.itemCount,
		}
	})
	ipcMain.handle('bili:favorite', (_e, id: string) =>
		getFavoriteVideos(cookie(), id),
	)
	ipcMain.handle('bili:collection', (_e, id: string) =>
		getCollectionVideos(cookie(), id),
	)
	ipcMain.handle('bili:toview', () => getWatchLater(cookie()))
	ipcMain.handle('bili:uploader', (_e, mid: string) =>
		getUploaderVideos(cookie(), mid),
	)
	ipcMain.handle('search:match', async (_e, query: string) => {
		const strategy = await matchSearchStrategies(query, { resolveB23 })
		return { strategy, error: describeSearchFailure(strategy) }
	})
	ipcMain.handle('bili:search', async (_e, keyword: string) => {
		const result = await searchVideos(keyword, cookie())
		return result.map((item) => ({
			...item,
			title: item.title.replace(/<[^>]+>/g, ''),
		}))
	})
	ipcMain.handle('bili:video', async (_e, bvid: string) => {
		const details = await getVideoDetails(bvid, cookie())
		const cover = details.pic
		return {
			bvid: details.bvid,
			title: details.title,
			cover,
			owner: details.owner,
			pages: details.pages.map((page) => ({
				id: generateUniqueTrackKey({
					bvid,
					cid: page.cid,
					isMultiPage: details.pages.length > 1,
				}),
				bvid,
				cid: page.cid,
				title: page.part || details.title,
				artist: details.owner.name,
				artwork: cover,
				duration: page.duration,
			})),
		}
	})
	ipcMain.handle(
		'player:resolve',
		async (
			_e,
			track: {
				id?: string
				bvid: string
				cid: number
				title: string
				artist?: string
				artwork?: string
				duration?: number
			},
		) => {
			try {
				const id =
					track.id ||
					generateUniqueTrackKey({
						bvid: track.bvid,
						cid: track.cid,
						isMultiPage: true,
					})
				await audioProxy.start()
				const cached = downloadManager.isComplete(id)
					? downloadManager.list().find((item) => item.id === id)
					: undefined
				let playUrl: string
				if (cached) {
					playUrl = audioProxy.setFile(downloadManager.filePath(id))
				} else {
					const stream = await getAudioStream(track.bvid, track.cid, cookie())
					playUrl = audioProxy.setSource(stream.url, cookie())
					if (store.get('autoCache') ?? true) {
						downloadManager.enqueue({
							track: {
								id,
								bvid: track.bvid,
								cid: track.cid,
								title: track.title,
								artist: track.artist ?? '',
								artwork: track.artwork ?? '',
								duration: track.duration ?? 0,
								size: 0,
								cachedAt: 0,
							},
							url: stream.url,
							cookie: cookie(),
						})
					}
				}
				let lyrics: ReturnType<typeof splLinesToAmll> = []
				let lyricSource: string | undefined
				if (cached?.lyrics?.lrc) {
					lyrics = splLinesToAmll(parseAndMergeLyrics(cached.lyrics))
					lyricSource = 'cache'
				} else {
					try {
						const raw = await fetchMatchedLyrics(
							track.title,
							track.artist,
							track.duration ?? 0,
						)
						if (raw?.lrc) {
							lyrics = splLinesToAmll(parseAndMergeLyrics(raw))
							lyricSource = raw.source
							downloadManager.saveLyrics(id, raw)
						}
					} catch {
						lyrics = []
					}
				}
				if (store.get('autoOpenLyricsWindow')) openAux('lyrics', true)
				if (store.get('autoOpenMiniWindow')) openAux('mini', true)
				return { playUrl, lyrics, cached: Boolean(cached), lyricSource }
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				if (String((error as { code?: number }).code) === '-101') {
					throw new Error('登录状态失效，请重新登录')
				}
				throw new Error(message)
			}
		},
	)
	ipcMain.handle('downloads:list', () => downloadManager.list())
	ipcMain.handle('downloads:status', () => downloadManager.statusMap())
	ipcMain.handle(
		'downloads:start',
		async (
			_e,
			track: {
				id: string
				bvid: string
				cid: number
				title: string
				artist: string
				artwork: string
				duration: number
			},
		) => {
			const stream = await getAudioStream(track.bvid, track.cid, cookie())
			downloadManager.enqueue({
				track: { ...track, size: 0, cachedAt: 0 },
				url: stream.url,
				cookie: cookie(),
			})
			return true
		},
	)
	ipcMain.handle('downloads:remove', (_e, id: string) => {
		downloadManager.remove(id)
		return true
	})
	ipcMain.handle('downloads:export', (_e, ids?: string[]) =>
		exportDownloads(ids, false),
	)
	ipcMain.handle('backup:export', () => exportBackup(true))
	ipcMain.handle('backup:import', () => importBackup(true))
	ipcMain.handle(
		'bili:comments',
		(_e, payload: { bvid: string; next?: number; mode?: number }) =>
			getComments(cookie(), payload.bvid, payload.next ?? 0, payload.mode ?? 3),
	)
	ipcMain.handle(
		'bili:commentReplies',
		(_e, payload: { bvid: string; rpid: number; pn?: number }) =>
			getReplyComments(cookie(), payload.bvid, payload.rpid, payload.pn ?? 1),
	)
	ipcMain.handle(
		'bili:commentLike',
		(_e, payload: { bvid: string; rpid: number; action: 0 | 1 }) =>
			likeComment(cookie(), payload.bvid, payload.rpid, payload.action),
	)
	ipcMain.handle('bili:garbSearch', (_e, keyword: string) =>
		searchGarbSkins(cookie(), keyword),
	)
	ipcMain.handle('skin:cover', (_e, url: string) => fetchImageDataUrl(url))
	ipcMain.handle(
		'bbplayer:login',
		async (_e, payload: { username: string; password: string }) => {
			const invalid = validateCredentials(payload.username, payload.password)
			if (invalid) throw new Error(invalid)
			const data = await loginRequest(payload.username, payload.password)
			saveBbplayerSession(data.token, data.account)
			const restored = await finishBbplayerAuth()
			return { ...settings(), restoreMessage: restored.message }
		},
	)
	ipcMain.handle(
		'bbplayer:register',
		async (
			_e,
			payload: {
				username: string
				password: string
				name?: string
				face?: string
			},
		) => {
			const invalid = validateCredentials(payload.username, payload.password)
			if (invalid) throw new Error(invalid)
			const data = await registerRequest(payload)
			saveBbplayerSession(data.token, data.account)
			const restored = await finishBbplayerAuth()
			return { ...settings(), restoreMessage: restored.message }
		},
	)
	ipcMain.handle('bbplayer:logout', () => {
		clearBbplayerSession()
		return settings()
	})
	ipcMain.handle(
		'bbplayer:updateProfile',
		async (_e, payload: { name?: string; face?: string }) => {
			const token = bbplayerToken()
			if (!token) throw new Error('请先登录 BBPlayer 账号')
			const data = await updateProfileRequest(token, payload)
			store.set('bbplayerAccount', data.account)
			return settings()
		},
	)
	ipcMain.handle('bbplayer:fillFromBili', async () => {
		const token = bbplayerToken()
		if (!token) throw new Error('请先登录 BBPlayer 账号')
		const bili = store.get('account')
		if (!bili) throw new Error('请先登录 Bilibili')
		const data = await updateProfileRequest(token, {
			name: bili.name,
			face: bili.face,
		})
		store.set('bbplayerAccount', data.account)
		return settings()
	})
	ipcMain.handle('bbplayer:refresh', async () => {
		const token = bbplayerToken()
		if (!token) return settings()
		try {
			const data = await fetchMe(token)
			store.set('bbplayerAccount', data.account)
			return settings()
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === '请先登录 BBPlayer 账号'
			) {
				clearBbplayerSession()
			}
			throw error
		}
	})
	ipcMain.handle('bbplayer:restore', async () => {
		try {
			return await restoreFromCloud(playerDb, bbplayerToken())
		} catch {
			throw new Error('同步云端共享歌单失败')
		}
	})
	ipcMain.handle('share:preview', (_e, input: string) =>
		previewSharedPlaylist(input),
	)
	ipcMain.handle('share:pending', () => {
		if (!pendingShareUrl) return null
		const parsed = parseShareLink(pendingShareUrl)
		pendingShareUrl = null
		return parsed.shareId ? parsed : null
	})
	ipcMain.handle('share:enable', (_e, playlistId: string) =>
		enableSharing(playerDb, bbplayerToken(), playlistId),
	)
	ipcMain.handle(
		'share:subscribe',
		(_e, payload: { input: string; inviteCode?: string }) =>
			subscribeToSharedPlaylist(
				playerDb,
				bbplayerToken(),
				payload.input,
				payload.inviteCode,
			),
	)
	ipcMain.handle('share:pull', (_e, playlistId: string) =>
		pullSharedChanges(playerDb, bbplayerToken(), playlistId),
	)
	ipcMain.handle(
		'share:copyLink',
		async (
			_e,
			payload: { playlistId: string; kind: 'subscribe' | 'editor' },
		) => {
			const result = await copyShareLink(
				playerDb,
				bbplayerToken(),
				payload.playlistId,
				payload.kind,
			)
			clipboard.writeText(result.url)
			return result
		},
	)
	ipcMain.handle('share:rotateInvite', async (_e, playlistId: string) => {
		const result = await rotateInvite(playerDb, bbplayerToken(), playlistId)
		clipboard.writeText(result.url)
		return result
	})
}

app.setName('BBPlayer')

if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient('bbplayer', process.execPath, [
			process.argv[1],
		])
	}
} else {
	app.setAsDefaultProtocolClient('bbplayer')
}

app.on('open-url', (event, url) => {
	event.preventDefault()
	emitShareLink(url)
})

app.whenReady().then(async () => {
	installAppProtocolHandler({
		handleTrpc: (req) =>
			fetchRequestHandler({
				endpoint: '/trpc',
				req,
				router: appRouter,
				createContext: () =>
					createTRPCContext({
						events,
						store: {
							get: (key) => store.get(key as never),
							set: (key, value) => {
								store.set(key as never, value as never)
							},
							delete: (key) => {
								store.delete(key as never)
							},
						},
						playerDb,
						refreshAccount,
						applyAuxSettings,
						refreshShell,
						openExternal: (url) => shell.openExternal(url),
						copyText: (text) => {
							clipboard.writeText(text)
						},
						checkUpdate: () => checkUpdates(true),
					}),
			}),
	})
	store = new Store<Settings & Persisted>({
		defaults: {
			cookie: '',
			continuePlayingAfterClose: true,
			lyricsAlwaysOnTop: true,
			lyricsWindowLocked: false,
			autoOpenLyricsWindow: false,
			menuBarShowLyrics: false,
			miniAlwaysOnTop: true,
			autoOpenMiniWindow: false,
			autoCache: true,
			playlists: [],
			windowBounds: {},
			lyricsWindowOpen: false,
			miniWindowOpen: false,
			account: null,
			downloads: [],
		},
	})
	playerDb = PlayerDatabase.open(join(app.getPath('userData'), 'db.db'))
	const legacy = store.get('playlists') ?? []
	if (legacy.length) {
		playerDb.importPlaylists(legacy)
		store.set('playlists', [])
	}
	downloadManager.configure({
		dir: join(app.getPath('userData'), 'downloads'),
		records: store.get('downloads') ?? [],
		onChange: (records, tasks) => {
			store.set('downloads', records)
			if (mainWindow && !mainWindow.isDestroyed()) {
				mainWindow.webContents.send('downloads:update', { records, tasks })
			}
		},
	})
	await audioProxy.start()
	session.defaultSession.webRequest.onBeforeSendHeaders(
		{ urls: BILI_IMAGE_URL_FILTER },
		(details, callback) => {
			callback({
				requestHeaders: withBiliImageHeaders(details.requestHeaders),
			})
		},
	)
	autoUpdater.autoDownload = false
	autoUpdater.autoInstallOnAppQuit = true
	if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true
	registerIpc()
	createMenu()
	createWindow()
	createTray()
	registerShortcuts()
	void refreshAccount()
	if (store.get('lyricsWindowOpen')) openAux('lyrics', true)
	if (store.get('miniWindowOpen')) openAux('mini', true)
	if (pendingShareUrl) emitShareLink(pendingShareUrl)
	const argvShare = process.argv.find((item) => item.startsWith('bbplayer://'))
	if (argvShare) emitShareLink(argvShare)
	app.on('activate', () => showMain())
})

app.on('before-quit', () => {
	stopQr()
	store.set('lyricsWindowOpen', isAuxVisible('lyrics'))
	store.set('miniWindowOpen', isAuxVisible('mini'))
	isQuitting = true
	globalShortcut.unregisterAll()
	closeAuxWindow()
	playerDb?.close()
})

app.on('will-quit', () => {
	globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
