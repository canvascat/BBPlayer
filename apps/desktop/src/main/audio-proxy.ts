import { randomUUID } from 'node:crypto'
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export class AudioProxy {
	private server: http.Server | null = null
	private port = 0
	private current: { url: string; cookie: string } | null = null
	private token = randomUUID()

	async start() {
		if (this.server) return this.port
		this.server = http.createServer((req, res) => {
			void this.handle(req, res)
		})
		await new Promise<void>((resolve) => {
			this.server!.listen(0, '127.0.0.1', () => resolve())
		})
		const address = this.server.address()
		if (!address || typeof address === 'string') {
			throw new Error('音频代理启动失败')
		}
		this.port = address.port
		return this.port
	}

	setSource(url: string, cookie: string) {
		this.current = { url, cookie }
		this.token = randomUUID()
		return `http://127.0.0.1:${this.port}/stream?t=${this.token}`
	}

	private async handle(req: IncomingMessage, res: ServerResponse) {
		if (!req.url?.startsWith('/stream') || !this.current) {
			res.writeHead(404)
			res.end()
			return
		}
		try {
			const headers: Record<string, string> = {
				'User-Agent': UA,
				Referer: 'https://www.bilibili.com/',
				Origin: 'https://www.bilibili.com',
			}
			if (this.current.cookie) headers.Cookie = this.current.cookie
			if (req.headers.range) headers.Range = String(req.headers.range)

			const upstream = await fetch(this.current.url, { headers })
			const outHeaders: Record<string, string> = {
				'Content-Type':
					upstream.headers.get('content-type') ?? 'audio/mp4',
				'Accept-Ranges': 'bytes',
			}
			const length = upstream.headers.get('content-length')
			if (length) outHeaders['Content-Length'] = length
			const contentRange = upstream.headers.get('content-range')
			if (contentRange) outHeaders['Content-Range'] = contentRange

			res.writeHead(upstream.status, outHeaders)
			if (!upstream.body) {
				res.end()
				return
			}
			Readable.fromWeb(upstream.body as never).pipe(res)
		} catch {
			if (!res.headersSent) res.writeHead(502)
			res.end()
		}
	}
}

export const audioProxy = new AudioProxy()
