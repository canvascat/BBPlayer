import { assert, test } from 'vitest'

import { createDesktopEvents } from '../events.ts'
import { memoryStore, mockTrpcContext } from '../mock-context.ts'

import { downloadsRouter } from './downloads.ts'

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
