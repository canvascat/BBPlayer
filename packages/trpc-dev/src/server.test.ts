import { test, assert } from 'vitest'

import { startTrpcDevServer } from './server'

test('GET / 返回 Panel HTML', async () => {
	const { url, close } = await startTrpcDevServer({ port: 0 })
	try {
		const response = await fetch(url)
		assert.equal(response.status, 200)
		assert.ok(
			(response.headers.get('content-type') ?? '').includes('text/html'),
		)
		const html = await response.text()
		assert.ok(html.toLowerCase().includes('<html'))
		assert.ok(html.includes('/trpc'))
	} finally {
		await close()
	}
})

test('GET /trpc/health.ping 返回 ok', async () => {
	const { url, close } = await startTrpcDevServer({ port: 0 })
	try {
		const response = await fetch(`${url}/trpc/health.ping`)
		assert.equal(response.status, 200)
		const body = (await response.json()) as {
			result?: { data?: { ok?: boolean } }
		}
		assert.equal(body.result?.data?.ok, true)
	} finally {
		await close()
	}
})

test('desktop.checkUpdate 经 HTTP 返回 PRECONDITION_FAILED', async () => {
	const { url, close } = await startTrpcDevServer({ port: 0 })
	try {
		const response = await fetch(`${url}/trpc/desktop.checkUpdate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ json: null }),
		})
		const body = (await response.json()) as {
			error?: { data?: { code?: string }; message?: string }
		}
		assert.equal(body.error?.data?.code, 'PRECONDITION_FAILED')
		assert.ok(body.error?.message?.includes('checkUpdate'))
	} finally {
		await close()
	}
})
