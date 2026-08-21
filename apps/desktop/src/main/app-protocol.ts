import { protocol } from 'electron'

export const APP_SCHEME = 'app'

export function registerAppSchemePrivileged() {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: APP_SCHEME,
			privileges: {
				standard: true,
				secure: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
			},
		},
	])
}

export function installAppProtocolHandler({
	handleTrpc,
}: {
	handleTrpc: (request: Request) => Response | Promise<Response>
}) {
	protocol.handle(APP_SCHEME, (request) => {
		const { pathname } = new URL(request.url)
		if (pathname === '/trpc' || pathname.startsWith('/trpc/')) {
			return handleTrpc(request)
		}
		return new Response(null, { status: 404 })
	})
}
