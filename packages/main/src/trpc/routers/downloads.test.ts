import { assert, test } from 'vitest'

import { createDesktopEvents } from '../events.ts'
import { memoryStore, mockTrpcContext } from '../mock-context.ts'

import { cachedTrackForEnqueue, downloadsRouter } from './downloads.ts'

const record = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
	size: 0,
	cachedAt: 0,
}

test('cachedTrackForEnqueue 合辑章节只保留 CachedTrack 字段', () => {
	const track = cachedTrackForEnqueue({
		id: 'bilibili::BV1xx::9::0::195',
		bvid: 'BV1xx',
		cid: 9,
		title: '章节标题',
		videoTitle: '稿件标题',
		artist: 'UP',
		artwork: 'https://example.com/cover.jpg',
		duration: 195,
		sourceDuration: 2726,
		musicTitle: '章节曲名',
		clipStartSec: 0,
		clipEndSec: 195,
	})
	assert.equal(track.id, 'bilibili::BV1xx::9')
	assert.equal(track.title, '稿件标题')
	assert.equal(track.duration, 2726)
	assert.equal('clipStartSec' in track, false)
	assert.equal('musicTitle' in track, false)
})

test('downloads.updates 叠上 musicMeta 缓存', async () => {
	const events = createDesktopEvents()
	const store = memoryStore({
		musicMeta: {
			s: {
				musicTitle: '夜に駆ける',
				musicArtist: 'YOASOBI',
				sourceHash: 'x',
			},
		},
	})
	events.downloads$.next({ records: [record], tasks: {} })
	const caller = downloadsRouter.createCaller(
		mockTrpcContext({ store, events }),
	)
	const observable = await caller.updates()
	const seen: Array<{
		records: Array<{ musicTitle?: string; musicArtist?: string }>
	}> = []
	const sub = (
		observable as {
			subscribe: (observer: { next: (value: unknown) => void }) => {
				unsubscribe: () => void
			}
		}
	).subscribe({
		next: (value) => {
			seen.push(
				value as {
					records: Array<{ musicTitle?: string; musicArtist?: string }>
				},
			)
		},
	})
	sub.unsubscribe()
	assert.equal(seen[0]?.records[0]?.musicTitle, '夜に駆ける')
	assert.equal(seen[0]?.records[0]?.musicArtist, 'YOASOBI')
})
