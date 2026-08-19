import { join } from 'node:path'

import {
	describeSearchFailure,
	generateUniqueTrackKey,
	matchSearchStrategies,
	splLinesToAmll,
} from '@bbplayer/core'
import { parseAndMergeLyrics } from '@bbplayer/splash'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import Store from 'electron-store'

import { audioProxy } from './audio-proxy'
import {
	fetchNeteaseLyrics,
	getAudioStream,
	getVideoDetails,
	resolveB23,
	searchVideos,
} from './bili'

interface Settings {
	cookie: string
	continuePlayingAfterClose: boolean
}

const store = new Store<Settings>({
	defaults: { cookie: '', continuePlayingAfterClose: true },
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 780,
		minWidth: 880,
		minHeight: 560,
		title: 'BBPlayer',
		webPreferences: {
			preload: join(import.meta.dirname, '../preload/index.mjs'),
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
	if (process.env.ELECTRON_RENDERER_URL) {
		void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		void mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
	}
}

function createTray() {
	const image = nativeImage.createEmpty()
	tray = new Tray(image)
	tray.setTitle('BB')
	tray.setToolTip('BBPlayer')
	tray.setContextMenu(
		Menu.buildFromTemplate([
			{
				label: '显示主窗口',
				click: () => {
					mainWindow?.show()
					mainWindow?.focus()
				},
			},
			{ type: 'separator' },
			{
				label: '退出 BBPlayer',
				click: () => {
					isQuitting = true
					app.quit()
				},
			},
		]),
	)
	tray.on('click', () => mainWindow?.show())
}

function cookie() {
	return store.get('cookie') ?? ''
}

function registerIpc() {
	ipcMain.handle('settings:get', () => ({
		cookie: cookie(),
		continuePlayingAfterClose: store.get('continuePlayingAfterClose'),
	}))
	ipcMain.handle(
		'settings:set',
		(_e, patch: Partial<Settings>) => {
			if (typeof patch.cookie === 'string') store.set('cookie', patch.cookie)
			if (typeof patch.continuePlayingAfterClose === 'boolean') {
				store.set('continuePlayingAfterClose', patch.continuePlayingAfterClose)
			}
			return true
		},
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
			pic: item.pic.startsWith('http') ? item.pic : `https:${item.pic}`,
		}))
	})
	ipcMain.handle('bili:video', async (_e, bvid: string) => {
		const details = await getVideoDetails(bvid, cookie())
		return {
			bvid: details.bvid,
			title: details.title,
			cover: details.pic.startsWith('http') ? details.pic : `https:${details.pic}`,
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
				artwork: details.pic.startsWith('http')
					? details.pic
					: `https:${details.pic}`,
				duration: page.duration,
			})),
		}
	})
	ipcMain.handle(
		'player:resolve',
		async (
			_e,
			track: { bvid: string; cid: number; title: string; artist?: string },
		) => {
			try {
				const stream = await getAudioStream(track.bvid, track.cid, cookie())
				await audioProxy.start()
				const playUrl = audioProxy.setSource(stream.url, cookie())
				let lyrics: ReturnType<typeof splLinesToAmll> = []
				try {
					const raw = await fetchNeteaseLyrics(track.title, track.artist)
					if (raw?.lrc) {
						const merged = parseAndMergeLyrics(raw)
						lyrics = splLinesToAmll(merged)
					}
				} catch {
					lyrics = []
				}
				return { playUrl, lyrics }
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error)
				if (String((error as { code?: number }).code) === '-101') {
					throw new Error('登录状态失效，请重新登录')
				}
				throw new Error(message)
			}
		},
	)
	ipcMain.handle('shell:open', (_e, url: string) => shell.openExternal(url))
}

app.whenReady().then(async () => {
	await audioProxy.start()
	registerIpc()
	createWindow()
	createTray()
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
		else mainWindow?.show()
	})
})

app.on('before-quit', () => {
	isQuitting = true
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
