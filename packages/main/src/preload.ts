import { TRPC_URL } from '@bbplayer/common'
import { contextBridge } from 'electron'

const api = {
	trpcUrl: TRPC_URL,
}

contextBridge.exposeInMainWorld('bbplayer', api)

export type DesktopApi = typeof api
