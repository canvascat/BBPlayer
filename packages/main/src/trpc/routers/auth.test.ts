import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { test, assert } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context'

import { authRouter } from './auth'

test('auth router 不从 phone-login 引入 electron', () => {
	const source = readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), 'auth.ts'),
		'utf8',
	)
	assert.equal(source.includes("from '../../phone-login'"), false)
	assert.equal(source.includes("from '../../phone-sms'"), true)
})

test('webStart 把网页登录 Cookie 写入 store 并刷新账号', async () => {
	const store = memoryStore()
	const account = { mid: 1, name: '测试', face: 'https://example/face.png' }
	const caller = authRouter.createCaller(
		mockTrpcContext({
			store,
			openWebLogin: async () => 'SESSDATA=abc; bili_jct=csrf; DedeUserID=1',
			refreshAccount: async () => {
				store.set('account', account)
				return account
			},
		}),
	)
	const result = await caller.webStart()
	assert.equal(store.get('cookie'), 'SESSDATA=abc; bili_jct=csrf; DedeUserID=1')
	assert.deepEqual(result.account, account)
	assert.equal(result.cookie, 'SESSDATA=abc; bili_jct=csrf; DedeUserID=1')
})

test('logout 清空登录态并清理网页登录 session', async () => {
	const store = memoryStore({
		cookie: 'SESSDATA=abc',
		account: { mid: 1, name: '测试', face: '' },
	})
	let cleared = 0
	const caller = authRouter.createCaller(
		mockTrpcContext({
			store,
			clearBiliLoginSession: async () => {
				cleared += 1
			},
		}),
	)
	await caller.logout()
	assert.equal(store.get('cookie'), '')
	assert.equal(store.get('account'), null)
	assert.equal(cleared, 1)
})
