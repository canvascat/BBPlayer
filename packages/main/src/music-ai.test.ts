import { assert, test } from 'vitest'

import { completeMusicAi } from './music-ai.ts'

const input = {
	title: '【翻唱】起风了',
	desc: '原唱买辣椒也用券',
	ownerName: 'UP',
	pages: [{ index: 1, part: '起风了' }],
}

test('成功时解析 tracks，并关掉 thinking、带 json_object', async () => {
	let body: Record<string, unknown> | undefined
	let url = ''
	const tracks = await completeMusicAi(
		input,
		{
			baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
			apiKey: 'sk-test',
			model: 'glm-4-flash',
		},
		async (requestUrl, init) => {
			url = String(requestUrl)
			body = JSON.parse(String(init?.body))
			assert.equal(
				(init?.headers as Record<string, string>)?.Authorization,
				'Bearer sk-test',
			)
			return new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: JSON.stringify({
									tracks: [
										{
											index: 1,
											title: '起风了',
											artist: '买辣椒也用券',
											confidence: 'high',
											kind: 'cover',
										},
									],
								}),
							},
						},
					],
				}),
				{ status: 200 },
			)
		},
	)
	assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions')
	assert.equal(body?.model, 'glm-4-flash')
	assert.equal(body?.temperature, 0)
	assert.deepEqual(body?.response_format, { type: 'json_object' })
	assert.deepEqual(body?.thinking, { type: 'disabled' })
	assert.equal(tracks?.[0]?.title, '起风了')
})

test('4xx 或非 JSON 返回 null', async () => {
	assert.equal(
		await completeMusicAi(
			input,
			{
				baseUrl: 'https://example.com/v4/',
				apiKey: 'k',
				model: 'm',
			},
			async () => new Response('nope', { status: 401 }),
		),
		null,
	)
})

test('同时最多两个请求', async () => {
	let current = 0
	let max = 0
	const fetchImpl: typeof fetch = async () => {
		current += 1
		max = Math.max(max, current)
		await new Promise((resolve) => setTimeout(resolve, 30))
		current -= 1
		return new Response(
			JSON.stringify({
				choices: [
					{
						message: {
							content:
								'{"tracks":[{"index":1,"title":"a","artist":"b","confidence":"high","kind":"cover"}]}',
						},
					},
				],
			}),
			{ status: 200 },
		)
	}
	await Promise.all([
		completeMusicAi(
			input,
			{ baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' },
			fetchImpl,
		),
		completeMusicAi(
			input,
			{ baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' },
			fetchImpl,
		),
		completeMusicAi(
			input,
			{ baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' },
			fetchImpl,
		),
	])
	assert.equal(max, 2)
})

test('waiter 排队时插入迟到的第四个调用，并发 fetch 仍不超过 2', async () => {
	let current = 0
	let max = 0
	let started = 0
	let first = true
	let releaseFirst: (() => void) | undefined
	const laterHolds: Array<() => void> = []
	const config = { baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' }
	let fourth: ReturnType<typeof completeMusicAi> | undefined

	const okBody = JSON.stringify({
		choices: [
			{
				message: {
					content:
						'{"tracks":[{"index":1,"title":"a","artist":"b","confidence":"high","kind":"cover"}]}',
				},
			},
		],
	})

	const fetchImpl: typeof fetch = async () => {
		const isFirst = first
		first = false
		current += 1
		started += 1
		max = Math.max(max, current)
		await new Promise<void>((resolve) => {
			if (isFirst) releaseFirst = resolve
			else laterHolds.push(resolve)
		})
		current -= 1
		if (!isFirst) {
			return {
				ok: true,
				status: 200,
				json: async () => JSON.parse(okBody),
			} as Response
		}
		return {
			ok: true,
			status: 200,
			json: async () => {
				queueMicrotask(() => {
					queueMicrotask(() => {
						fourth ??= completeMusicAi(input, config, fetchImpl)
					})
				})
				return JSON.parse(okBody)
			},
		} as Response
	}

	const firstCall = completeMusicAi(input, config, fetchImpl)
	const secondCall = completeMusicAi(input, config, fetchImpl)
	for (let i = 0; i < 20; i++) {
		if (started >= 2) break
		await Promise.resolve()
	}
	assert.equal(started, 2)

	const thirdCall = completeMusicAi(input, config, fetchImpl)
	await Promise.resolve()
	await Promise.resolve()
	assert.equal(started, 2)

	releaseFirst!()
	await firstCall
	for (let i = 0; i < 40; i++) {
		if (fourth && started >= 3) break
		await Promise.resolve()
	}
	assert.ok(fourth)
	assert.ok(max <= 2)

	for (let i = 0; i < 30; i++) {
		while (laterHolds.length > 0) laterHolds.shift()!()
		await Promise.resolve()
	}
	await Promise.all([secondCall, thirdCall, fourth])
	assert.equal(max, 2)
})
