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
