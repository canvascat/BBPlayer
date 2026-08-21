import type { TrpcContext } from './context'
import { createDesktopEvents } from './events'

export function memoryStore(initial: Record<string, unknown> = {}) {
	const data = { ...initial }
	return {
		get: (key: string) => data[key],
		set: (key: string, value: unknown) => {
			data[key] = value
		},
		delete: (key: string) => {
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
		applyAuxSettings: () => undefined,
		refreshShell: () => undefined,
		openExternal: async () => undefined,
		copyText: () => undefined,
		checkUpdate: async () => ({
			status: 'latest',
			currentVersion: '0.1.0',
			message: '已是最新版本',
		}),
		openAux: () => false,
		auxVisible: () => false,
		showMain: () => undefined,
		openGeetest: async () => ({
			validate: '',
			seccode: '',
			challenge: '',
		}),
		exportDownloads: async () => ({ ok: true }),
		exportBackup: async () => ({ ok: true }),
		importBackup: async () => ({ ok: true }),
		resolvePlay: async () => ({ playUrl: '', lyrics: [] }),
		restoreShared: async () => ({ restored: 0, message: '' }),
		takePendingShare: () => null,
		...overrides,
	}
}
