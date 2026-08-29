import type { AppStore } from '../store'

import type { TrpcContext, TrpcStore } from './context'
import { createDesktopEvents } from './events'

export function memoryStore(initial: Partial<AppStore> = {}): TrpcStore {
	const data: Partial<AppStore> = { ...initial }
	return {
		get: (key) => data[key] as AppStore[typeof key],
		set: (key, value) => {
			data[key] = value
		},
		delete: (key) => {
			delete data[key]
		},
	}
}

export function mockTrpcContext(
	overrides: Partial<TrpcContext> = {},
): TrpcContext {
	return {
		events: createDesktopEvents(),
		store: memoryStore(),
		playerDb: {
			list: () => [],
			get: () => null,
			create: () => {
				throw new Error('unused')
			},
			rename: () => undefined,
			delete: () => undefined,
			addTracks: () => undefined,
			removeTrack: () => undefined,
		},
		refreshAccount: async () => null,
		refreshShell: () => undefined,
		openExternal: async () => undefined,
		copyText: () => undefined,
		checkUpdate: async () => ({
			status: 'latest',
			currentVersion: '0.1.0',
			message: '已是最新版本',
		}),
		showMain: () => undefined,
		openGeetest: async () => ({
			validate: '',
			seccode: '',
			challenge: '',
		}),
		openWebLogin: async () => {
			throw new Error('unused')
		},
		clearBiliLoginSession: async () => undefined,
		exportDownloads: async () => ({ ok: true }),
		exportBackup: async () => ({ ok: true }),
		importBackup: async () => ({ ok: true }),
		resolvePlay: async () => ({ playUrl: '', lyrics: [] }),
		...overrides,
	}
}
