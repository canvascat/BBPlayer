import { TRPCError } from '@trpc/server'

import { clearWbiCache, getAccount } from '../bili'
import { PlayerDatabase } from '../db'

import { cookieFrom, type TrpcContext } from './context'
import { createDesktopEvents } from './events'
import { memoryStore } from './mock-context'

export const NODE_DESKTOP_METHODS = [
	'refreshShell',
	'openExternal',
	'copyText',
	'checkUpdate',
	'showMain',
	'openGeetest',
	'openWebLogin',
	'clearBiliLoginSession',
	'exportDownloads',
	'exportBackup',
	'importBackup',
	'resolvePlay',
] as const

export type NodeDesktopMethod = (typeof NODE_DESKTOP_METHODS)[number]

export type NodeTrpcRuntime = {
	store: TrpcContext['store']
	playerDb: TrpcContext['playerDb']
	events: TrpcContext['events']
	createContext: () => TrpcContext
}

function unsupported(name: NodeDesktopMethod) {
	return (..._args: unknown[]) => {
		throw new TRPCError({
			code: 'PRECONDITION_FAILED',
			message: `当前是 Node 开发服务，不支持 ${name}`,
		})
	}
}

export function createNodeTrpcRuntime(
	options: { cookie?: string } = {},
): NodeTrpcRuntime {
	const cookie = options.cookie ?? process.env.BILI_COOKIE ?? ''
	const store = memoryStore({ cookie })
	const playerDb = PlayerDatabase.open(':memory:')
	const events = createDesktopEvents()

	async function refreshAccount() {
		try {
			clearWbiCache()
			const account = await getAccount(cookieFrom(store))
			store.set('account', account)
			return account
		} catch {
			store.set('account', null)
			return null
		}
	}

	function createContext(): TrpcContext {
		return {
			events,
			store,
			playerDb,
			refreshAccount,
			refreshShell: unsupported('refreshShell'),
			openExternal: unsupported('openExternal'),
			copyText: unsupported('copyText'),
			checkUpdate: unsupported('checkUpdate'),
			showMain: unsupported('showMain'),
			openGeetest: unsupported('openGeetest'),
			openWebLogin: unsupported('openWebLogin'),
			clearBiliLoginSession: unsupported('clearBiliLoginSession'),
			exportDownloads: unsupported('exportDownloads'),
			exportBackup: unsupported('exportBackup'),
			importBackup: unsupported('importBackup'),
			resolvePlay: unsupported('resolvePlay'),
		}
	}

	return { store, playerDb, events, createContext }
}
