import { test, assert } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context'

import { playerRouter } from './player'

test('player.sendCommand 推入 playerCommands$', async () => {
	const ctx = mockTrpcContext()
	const seen: string[] = []
	ctx.events.playerCommands$.subscribe((command) => {
		seen.push(command)
	})
	const caller = playerRouter.createCaller(ctx)
	await caller.sendCommand({ command: 'playpause' })
	assert.deepEqual(seen, ['playpause'])
})

test('player.setLyricOffset 按曲写入并在 0 时删除', async () => {
	const store = memoryStore()
	const caller = playerRouter.createCaller(mockTrpcContext({ store }))
	assert.equal(
		await caller.setLyricOffset({ trackId: 't1', offsetSec: 1.5 }),
		1.5,
	)
	assert.equal(store.get('lyricOffsets')?.t1, 1.5)
	assert.equal(await caller.setLyricOffset({ trackId: 't1', offsetSec: 0 }), 0)
	assert.equal(store.get('lyricOffsets')?.t1, undefined)
})
