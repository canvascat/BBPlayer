import { contextBridge, ipcRenderer } from 'electron'

const api = {
	getSettings: () => ipcRenderer.invoke('settings:get'),
	setSettings: (patch: {
		cookie?: string
		continuePlayingAfterClose?: boolean
	}) => ipcRenderer.invoke('settings:set', patch),
	matchSearch: (query: string) => ipcRenderer.invoke('search:match', query),
	searchVideos: (keyword: string) => ipcRenderer.invoke('bili:search', keyword),
	getVideo: (bvid: string) => ipcRenderer.invoke('bili:video', bvid),
	resolvePlay: (track: {
		bvid: string
		cid: number
		title: string
		artist?: string
	}) => ipcRenderer.invoke('player:resolve', track),
	openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
}

contextBridge.exposeInMainWorld('bbplayer', api)

export type DesktopApi = typeof api
