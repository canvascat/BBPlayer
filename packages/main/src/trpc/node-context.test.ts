import { TRPCError } from '@trpc/server'
import { test, assert, expect } from 'vitest'

import { createNodeTrpcRuntime, NODE_DESKTOP_METHODS } from './node-context'
import { appRouter } from './router'

test('从 options.cookie 写入 store', () => {
	const runtime = createNodeTrpcRuntime({ cookie: 'SESS=1' })
	assert.equal(runtime.store.get('cookie'), 'SESS=1')
})

test('未传 cookie 时读 BILI_COOKIE', () => {
	const previous = process.env.BILI_COOKIE
	process.env.BILI_COOKIE = 'SESS=env'
	try {
		const runtime = createNodeTrpcRuntime()
		assert.equal(runtime.store.get('cookie'), 'SESS=env')
	} finally {
		if (previous === undefined) delete process.env.BILI_COOKIE
		else process.env.BILI_COOKIE = previous
	}
})

test('health.ping 可在 Node runtime 上调用', async () => {
	const caller = appRouter.createCaller(createNodeTrpcRuntime().createContext())
	assert.deepEqual(await caller.health.ping(), { ok: true })
})

test('library.create 写入内存数据库', async () => {
	const runtime = createNodeTrpcRuntime()
	const caller = appRouter.createCaller(runtime.createContext())
	const created = await caller.library.create({ title: '测试歌单' })
	assert.equal(created.title, '测试歌单')
	assert.equal(runtime.playerDb.list().length, 1)
})

for (const name of NODE_DESKTOP_METHODS) {
	test(`${name} 抛 PRECONDITION_FAILED`, async () => {
		const ctx = createNodeTrpcRuntime().createContext()
		const method = ctx[name] as () => unknown
		await expect(Promise.resolve().then(() => method())).rejects.toSatisfy(
			(error: unknown) => {
				assert.ok(error instanceof TRPCError)
				assert.equal(error.code, 'PRECONDITION_FAILED')
				assert.ok(error.message.includes(name))
				assert.ok(error.message.includes('Node 开发服务'))
				return true
			},
		)
	})
}
