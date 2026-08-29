import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	generateUniqueTrackKey,
	parseAndMergeLyrics,
	splLinesToAmll,
} from '@bbplayer/core'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	globalShortcut,
	Menu,
	nativeImage,
	session,
	shell,
	Tray,
} from 'electron'
import Store from 'electron-store'
import { firstValueFrom, take } from 'rxjs'

const { autoUpdater } = createRequire(import.meta.url)(
	'electron-updater',
) as typeof import('electron-updater')

import {
	installAppProtocolHandler,
	registerAppSchemePrivileged,
	rendererUrl,
} from './app-protocol'
import { audioProxy } from './audio-proxy'
import { readBackupZip, writeBackupZip } from './backup'
import { clearWbiCache, getAccount, getAudioStream } from './bili'
import { BILI_IMAGE_URL_FILTER, withBiliImageHeaders } from './bili-image'
import { PlayerDatabase } from './db'
import { downloadManager } from './downloads'
import { exportCachedTracks, exportSummary } from './export-audio'
import { fetchMatchedLyrics } from './lyrics-fetch'
import { openGeetestWindow } from './phone-login'
import { parseShareLink } from './share-link'
import { restoreFromCloud } from './shared-playlists'
import { type AppStore } from './store'
import { createTRPCContext } from './trpc/context'
import { createDesktopEvents } from './trpc/events'
import { liveState } from './trpc/live-state'
import { appRouter } from './trpc/router'
import { stopQrLogin } from './trpc/routers/auth'
import { interpretUpdate, notesFromRelease } from './updater'

registerAppSchemePrivileged()

const events = createDesktopEvents()

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRELOAD = join(__dirname, 'preload.cjs')
const RENDERER_DIST = app.isPackaged
	? join(process.resourcesPath, 'renderer')
	: join(__dirname, '../../renderer/dist')

let store!: Store<AppStore>
let playerDb!: PlayerDatabase

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

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

function bbplayerToken() {
	return store.get('bbplayerToken') || null
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
	events.shareIncoming$.next(parsed)
}

function loadRenderer(win: BrowserWindow) {
	const vite = process.env.VITE_DEV_SERVER_URL?.trim()
	if (vite) {
		const base = vite.endsWith('/') ? vite : `${vite}/`
		void win.loadURL(base)
		return
	}
	void win.loadURL(rendererUrl('index.html'))
}

function showMain() {
	if (!mainWindow || mainWindow.isDestroyed()) createWindow()
	mainWindow?.show()
	mainWindow?.focus()
}

function sendCommand(command: string) {
	events.playerCommands$.next(command)
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1024,
		height: 640,
		minWidth: 900,
		minHeight: 560,
		title: 'BBPlayer',
		titleBarStyle: 'hiddenInset',
		trafficLightPosition: { x: 20, y: 36 },
		backgroundColor: '#ffffff',
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
	loadRenderer(mainWindow)
}

function truncate(text: string, max = 22) {
	const trimmed = text.trim()
	if (trimmed.length <= max) return trimmed
	return `${trimmed.slice(0, max)}…`
}

function refreshShell() {
	const hasTrack = Boolean(liveState.snapshot.title)
	const lyricOrTitle = liveState.snapshot.lyric || liveState.snapshot.title
	const trayTitle = store.get('menuBarShowLyrics')
		? truncate(lyricOrTitle || 'BB')
		: hasTrack
			? truncate(liveState.snapshot.title, 10)
			: 'BB'
	tray?.setTitle(trayTitle)
	tray?.setToolTip(
		hasTrack
			? `${liveState.snapshot.title} · ${liveState.snapshot.artist}`
			: 'BBPlayer',
	)
	const playbackItems: Electron.MenuItemConstructorOptions[] = [
		{
			label: liveState.snapshot.title || '未在播放',
			enabled: false,
		},
		{ type: 'separator' },
		{
			label: liveState.snapshot.playing ? '暂停' : '播放',
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
					label: liveState.snapshot.playing ? '暂停' : '播放',
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
	const hasTrack = Boolean(liveState.snapshot.title)
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
					label: liveState.snapshot.playing ? '暂停' : '播放',
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

async function resolvePlay(track: {
	id?: string
	bvid: string
	cid: number
	title: string
	artist?: string
	artwork?: string
	duration?: number
}) {
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
		return { playUrl, lyrics, cached: Boolean(cached), lyricSource }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		if (String((error as { code?: number }).code) === '-101') {
			throw new Error('登录状态失效，请重新登录')
		}
		throw new Error(message)
	}
}

function takePendingShare() {
	if (!pendingShareUrl) return null
	const parsed = parseShareLink(pendingShareUrl)
	pendingShareUrl = null
	return parsed.shareId ? parsed : null
}

function openGeetest(input: { gt: string; challenge: string }) {
	return openGeetestWindow({
		gt: input.gt,
		challenge: input.challenge,
		preload: PRELOAD,
		parent: mainWindow,
		waitForDone: () => firstValueFrom(events.geetest$.pipe(take(1))),
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
		rendererDist: RENDERER_DIST,
		handleTrpc: (req) =>
			fetchRequestHandler({
				endpoint: '/trpc',
				req,
				router: appRouter,
				createContext: () =>
					createTRPCContext({
						events,
						store,
						playerDb,
						refreshAccount,
						refreshShell,
						openExternal: (url) => shell.openExternal(url),
						copyText: (text) => {
							clipboard.writeText(text)
						},
						checkUpdate: () => checkUpdates(true),
						showMain,
						openGeetest,
						exportDownloads: (ids) => exportDownloads(ids, false),
						exportBackup: () => exportBackup(true),
						importBackup: () => importBackup(true),
						resolvePlay,
						restoreShared: finishBbplayerAuth,
						takePendingShare,
					}),
			}),
	})
	store = new Store<AppStore>({
		defaults: {
			cookie: '',
			continuePlayingAfterClose: true,
			menuBarShowLyrics: false,
			autoCache: true,
			playlists: [],
			account: null,
			skin: null,
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
			events.downloads$.next({ records, tasks })
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
	createMenu()
	createWindow()
	createTray()
	registerShortcuts()
	void refreshAccount()
	if (pendingShareUrl) emitShareLink(pendingShareUrl)
	const argvShare = process.argv.find((item) => item.startsWith('bbplayer://'))
	if (argvShare) emitShareLink(argvShare)
	app.on('activate', () => showMain())
})

app.on('before-quit', () => {
	stopQrLogin()
	isQuitting = true
	globalShortcut.unregisterAll()
	playerDb?.close()
})

app.on('will-quit', () => {
	globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
