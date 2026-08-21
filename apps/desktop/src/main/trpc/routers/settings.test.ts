import assert from 'node:assert/strict'

import { test } from 'vitest'

import { createDesktopEvents } from '../events'

import { settingsRouter } from './settings'

function memoryStore(initial: Record<string, unknown> = {}) {
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

function testContext(
	store = memoryStore(),
	overrides: {
		refreshAccount?: () => Promise<unknown>
		applyAuxSettings?: (
			kind: 'lyrics' | 'mini',
			patch: { alwaysOnTop?: boolean; locked?: boolean },
		) => void
		refreshShell?: () => void
	} = {},
) {
	return {
		events: createDesktopEvents(),
		store,
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
		refreshAccount: overrides.refreshAccount ?? (async () => null),
		applyAuxSettings: overrides.applyAuxSettings ?? (() => undefined),
		refreshShell: overrides.refreshShell ?? (() => undefined),
		openExternal: async () => undefined,
		copyText: () => undefined,
		checkUpdate: async () => ({
			status: 'latest' as const,
			currentVersion: '0.1.0',
			message: '已是最新版本',
		}),
	}
}

test('settings.get 返回 store 中的 cookie 与默认值', async () => {
	const caller = settingsRouter.createCaller(
		testContext(memoryStore({ cookie: 'SESS=1' })),
	)
	const result = await caller.get()
	assert.equal(result.cookie, 'SESS=1')
	assert.equal(result.continuePlayingAfterClose, true)
	assert.equal(result.account, null)
	assert.equal(result.bbplayerAccount, null)
})

test('settings.set 写入 cookie 并刷新账号', async () => {
	const store = memoryStore()
	let refreshed = 0
	const caller = settingsRouter.createCaller(
		testContext(store, {
			refreshAccount: async () => {
				refreshed += 1
				return null
			},
		}),
	)
	const ok = await caller.set({ cookie: 'SESS=2' })
	assert.equal(ok, true)
	assert.equal(store.get('cookie'), 'SESS=2')
	assert.equal(refreshed, 1)
})
