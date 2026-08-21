import { contextBridge } from 'electron'

const api = {
	trpcUrl: 'app://localhost/trpc',
}

contextBridge.exposeInMainWorld('bbplayer', api)

export type DesktopApi = typeof api
