import { isSongVideo } from '@bbplayer/core'

import type { PlaySession } from './store.ts'
import type { TrpcStore } from './trpc/context.ts'

export function readFilterNonSongs(store: Pick<TrpcStore, 'get'>): boolean {
	return store.get('filterNonSongs') ?? false
}

export function filterSongItems<
	T extends { title: string; tid?: number | null },
>(enabled: boolean, items: T[]): T[] {
	if (!enabled) return items
	return items.filter((item) => isSongVideo(item))
}

export function filterVideoPayload(
	enabled: boolean,
	input: { tid?: number | null; title: string; pages: unknown[] },
): { pages: unknown[]; filtered: boolean } {
	if (enabled && !isSongVideo({ tid: input.tid, title: input.title })) {
		return { pages: [], filtered: true }
	}
	return { pages: input.pages, filtered: false }
}

export function filterPlaySession(
	enabled: boolean,
	session: PlaySession,
): PlaySession {
	if (!enabled) return session

	const visible = session.queue.filter((item) => isSongVideo(item))
	const current = session.queue[session.index]

	if (current && isSongVideo(current)) {
		const index = visible.findIndex((item) => item.id === current.id)
		return { ...session, queue: visible, index }
	}

	for (let i = session.index + 1; i < session.queue.length; i++) {
		const item = session.queue[i]
		if (isSongVideo(item)) {
			const index = visible.findIndex(
				(visibleItem) => visibleItem.id === item.id,
			)
			return { ...session, queue: visible, index }
		}
	}

	return {
		...session,
		queue: visible,
		index: visible.length === 0 ? 0 : visible.length,
	}
}

export function mergePlaySessionSet(
	enabled: boolean,
	stored: PlaySession | undefined,
	incoming: PlaySession,
): PlaySession {
	if (!enabled) return incoming
	if (!stored) return incoming

	if (incoming.queue.length === 0) {
		return {
			...incoming,
			queue: stored.queue,
			index: incoming.index,
		}
	}

	const storedIds = new Set(stored.queue.map((item) => item.id))
	const hasOverlap = incoming.queue.some((item) => storedIds.has(item.id))
	if (!hasOverlap) return incoming

	const incomingIds = new Set(incoming.queue.map((item) => item.id))
	const kept = stored.queue.filter(
		(item) => !isSongVideo(item) || incomingIds.has(item.id),
	)
	const appended = incoming.queue.filter((item) => !storedIds.has(item.id))
	const queue = [...kept, ...appended]

	const incomingCurrent = incoming.queue[incoming.index]
	let index = stored.index
	if (incomingCurrent) {
		const mapped = queue.findIndex((item) => item.id === incomingCurrent.id)
		if (mapped >= 0) index = mapped
	}

	return {
		...incoming,
		queue,
		index,
	}
}
