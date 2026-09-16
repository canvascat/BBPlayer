import { isSongVideo } from './song-video.ts'

export type NormalizedChapter = {
	content: string
	from: number
	to: number
}

export function shouldFetchViewPoints(input: {
	pageCount: number
	tid?: number | null
	title: string
	musicAiApiKey?: string
}): boolean {
	if (input.pageCount !== 1) return false
	if (isSongVideo({ tid: input.tid, title: input.title })) return true
	return Boolean(input.musicAiApiKey?.trim())
}

export function normalizeViewPoints(
	points: unknown,
	durationSec: number,
): NormalizedChapter[] {
	if (
		!Array.isArray(points) ||
		!Number.isFinite(durationSec) ||
		durationSec <= 0
	) {
		return []
	}
	const raw = points
		.map((item) => {
			if (!item || typeof item !== 'object') return null
			const row = item as { content?: unknown; from?: unknown; to?: unknown }
			const content = typeof row.content === 'string' ? row.content.trim() : ''
			const from = Number(row.from)
			const to = row.to == null || row.to === '' ? undefined : Number(row.to)
			if (!content || !Number.isFinite(from) || from < 0) return null
			return { content, from, to }
		})
		.filter(
			(item): item is { content: string; from: number; to?: number } => !!item,
		)
		.sort((a, b) => a.from - b.from)
		.filter((item) => !Number.isFinite(item.to) || item.from < item.to!)

	const filled: NormalizedChapter[] = []
	for (let i = 0; i < raw.length; i++) {
		const current = raw[i]!
		const to = Number.isFinite(current.to)
			? current.to!
			: (raw[i + 1]?.from ?? durationSec)
		if (current.from >= to) continue
		filled.push({ content: current.content, from: current.from, to })
	}
	return filled.length >= 2 ? filled : []
}
