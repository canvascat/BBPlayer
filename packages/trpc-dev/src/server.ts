import { createServer, type Server } from 'node:http'

import { renderTrpcPanel } from '@ajayche/trpc-panel'
import { appRouter } from '@bbplayer/main/router'
import { createNodeTrpcRuntime } from '@bbplayer/main/trpc/node-context'
import { createHTTPHandler } from '@trpc/server/adapters/standalone'

export type StartTrpcDevServerOptions = {
	port?: number
	cookie?: string
	hostname?: string
}

export type TrpcDevServer = {
	server: Server
	runtime: ReturnType<typeof createNodeTrpcRuntime>
	port: number
	url: string
	close: () => Promise<void>
}

export async function startTrpcDevServer(
	options: StartTrpcDevServerOptions = {},
): Promise<TrpcDevServer> {
	const hostname = options.hostname ?? '127.0.0.1'
	const requestedPort = options.port ?? 4000
	const runtime = createNodeTrpcRuntime({ cookie: options.cookie })
	const trpcHandler = createHTTPHandler({
		router: appRouter,
		createContext: () => runtime.createContext(),
		basePath: '/trpc/',
	})

	const server = createServer((req, res) => {
		const path = (req.url ?? '/').split('?')[0] ?? '/'
		if (path === '/' || path === '/panel') {
			const host = req.headers.host ?? `${hostname}:${requestedPort}`
			const origin = `http://${host}`
			res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
			res.end(
				renderTrpcPanel(appRouter, {
					url: `${origin}/trpc`,
					meta: {
						title: 'BBPlayer tRPC',
						description:
							'Node 开发服务。桌面能力（窗口 / 托盘 / 对话框）会返回 PRECONDITION_FAILED。登录态来自 BILI_COOKIE。',
					},
				}),
			)
			return
		}
		if (path === '/trpc' || path.startsWith('/trpc/')) {
			trpcHandler(req, res)
			return
		}
		res.writeHead(404)
		res.end('Not Found')
	})

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject)
		server.listen(requestedPort, hostname, () => resolve())
	})
	const address = server.address()
	const port =
		typeof address === 'object' && address ? address.port : requestedPort
	const url = `http://${hostname}:${port}`

	return {
		server,
		runtime,
		port,
		url,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()))
			}),
	}
}
