import assert from 'node:assert/strict'

import { test } from 'vitest'

import { mockTrpcContext } from '../mock-context'

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
