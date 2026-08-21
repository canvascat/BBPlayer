import { createRequire } from 'node:module'
import { isAbsolute, relative, resolve } from 'node:path'

const electronRequire = createRequire(import.meta.url)

function electron() {
	return electronRequire('electron') as typeof import('electron')
}

export const APP_SCHEME = 'app'
export const APP_ORIGIN = 'app://localhost'

export type RendererPage = 'index.html' | 'lyrics.html' | 'mini.html'

export function rendererUrl(page: RendererPage) {
	return page === 'index.html' ? `${APP_ORIGIN}/` : `${APP_ORIGIN}/${page}`
}

export function headersWithoutHost(headers: Headers) {
	const next = new Headers(headers)
	next.delete('host')
	return next
}

export type AppRequestEnv = {
	viteDevServerUrl?: string
	rendererDist: string
}

export type AppRequestRoute =
	| { type: 'trpc' }
	| { type: 'forward'; url: string }
	| { type: 'file'; absPath: string }
	| { type: 'error'; status: 404 | 405 }

export function resolveRendererFile(pathname: string, rendererDist: string) {
	let decoded: string
	try {
		decoded = decodeURIComponent(pathname)
	} catch {
		return null
	}
	const relativePath =
		decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
	if (!relativePath || relativePath.endsWith('/')) return null
	const root = resolve(rendererDist)
	const abs = resolve(root, relativePath)
	const rel = relative(root, abs)
	if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
	return abs
}

export function resolveAppRequest(
	requestUrl: string,
	method: string,
	env: AppRequestEnv,
): AppRequestRoute {
	let url: URL
	try {
		url = new URL(requestUrl)
	} catch {
		return { type: 'error', status: 404 }
	}
	if (url.pathname === '/trpc' || url.pathname.startsWith('/trpc/')) {
		return { type: 'trpc' }
	}
	const upper = method.toUpperCase()
	if (upper !== 'GET' && upper !== 'HEAD') {
		return { type: 'error', status: 405 }
	}
	if (env.viteDevServerUrl) {
		return {
			type: 'forward',
			url: new URL(url.pathname + url.search, env.viteDevServerUrl).href,
		}
	}
	const absPath = resolveRendererFile(url.pathname, env.rendererDist)
	if (!absPath) return { type: 'error', status: 404 }
	return { type: 'file', absPath }
}

export function registerAppSchemePrivileged() {
	electron().protocol.registerSchemesAsPrivileged([
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
	electron().protocol.handle(APP_SCHEME, (request) => {
		const { pathname } = new URL(request.url)
		if (pathname === '/trpc' || pathname.startsWith('/trpc/')) {
			return handleTrpc(request)
		}
		return new Response(null, { status: 404 })
	})
}
