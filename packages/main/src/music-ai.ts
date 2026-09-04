import { parseMusicAiPayload, type MusicAiTrack } from './music-meta.ts'

export const MUSIC_AI_TIMEOUT_MS = 8000
export const MUSIC_AI_CONCURRENCY = 2

export type MusicAiInput = {
	title: string
	desc: string
	ownerName: string
	pages: Array<{ index: number; part: string }>
}

export type MusicAiConfig = {
	baseUrl: string
	apiKey: string
	model: string
}

const SYSTEM_PROMPT =
	'从 B 站投稿信息抽取歌曲名和歌手；禁止编造；UP 名不等于歌手，除非标题或简介明确写了原唱/演唱者。只输出 JSON。'

let active = 0
const waiters: Array<() => void> = []

async function acquire(): Promise<void> {
	if (active >= MUSIC_AI_CONCURRENCY) {
		await new Promise<void>((resolve) => {
			waiters.push(resolve)
		})
	}
	active += 1
}

function release(): void {
	active -= 1
	waiters.shift()?.()
}

export async function completeMusicAi(
	input: MusicAiInput,
	config: MusicAiConfig,
	fetchImpl: typeof fetch = fetch,
): Promise<MusicAiTrack[] | null> {
	await acquire()
	try {
		const url = new URL('chat/completions', config.baseUrl)
		const response = await fetchImpl(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: config.model,
				temperature: 0,
				response_format: { type: 'json_object' },
				thinking: { type: 'disabled' },
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{
						role: 'user',
						content: JSON.stringify({
							title: input.title,
							desc: input.desc,
							ownerName: input.ownerName,
							pages: input.pages,
						}),
					},
				],
			}),
			signal: AbortSignal.timeout(MUSIC_AI_TIMEOUT_MS),
		})
		if (!response.ok) return null
		const payload = (await response.json()) as {
			choices?: Array<{ message?: { content?: unknown } }>
		}
		const content = payload.choices?.[0]?.message?.content
		if (typeof content !== 'string') return null
		return parseMusicAiPayload(content)
	} catch {
		return null
	} finally {
		release()
	}
}
