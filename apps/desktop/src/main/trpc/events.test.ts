import assert from 'node:assert/strict'

import { firstValueFrom, skip } from 'rxjs'
import { test } from 'vitest'

import { createDesktopEvents } from './events'

test('BehaviorSubject 后订阅能拿到当前歌词元数据', async () => {
	const events = createDesktopEvents()
	events.lyricsMeta$.next({
		title: 'a',
		artist: 'b',
		playing: true,
		lyric: '',
		artwork: '',
	})
	const value = await firstValueFrom(events.lyricsMeta$)
	assert.equal(value.title, 'a')
})

test('playerCommands$ 不回放历史命令', async () => {
	const events = createDesktopEvents()
	events.playerCommands$.next('prev')
	let seen = ''
	const sub = events.playerCommands$.subscribe((c) => {
		seen = c
	})
	assert.equal(seen, '')
	events.playerCommands$.next('next')
	assert.equal(seen, 'next')
	sub.unsubscribe()
})

test('退订后不再收到 downloads 更新', () => {
	const events = createDesktopEvents()
	let count = 0
	const sub = events.downloads$.pipe(skip(1)).subscribe(() => {
		count += 1
	})
	sub.unsubscribe()
	events.downloads$.next({ records: [], tasks: {} })
	assert.equal(count, 0)
})
