import { existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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

const FORBIDDEN_FORWARD_HEADERS = new Set([
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'via',
])

export function headersWithoutHost(headers: Headers) {
	const next = new Headers()
	for (const [key, value] of headers.entries()) {
		const lower = key.toLowerCase()
		if (FORBIDDEN_FORWARD_HEADERS.has(lower) || lower.startsWith('sec-')) {
			continue
		}
		next.append(key, value)
	}
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

export type AppAssetFetch = (
	input: string,
	init?: RequestInit & { bypassCustomProtocolHandlers?: boolean },
) => Promise<Response>

export function installAppProtocolHandler({
	handleTrpc,
	rendererDist,
	viteDevServerUrl,
	handle: handleScheme = (scheme, listener) =>
		electron().protocol.handle(scheme, listener),
	fetch: fetchAsset = (input, init = {}) => {
		if (/^https?:/i.test(input)) {
			const { bypassCustomProtocolHandlers: _ignored, ...rest } = init
			return globalThis.fetch(input, rest)
		}
		return electron().net.fetch(input, init)
	},
	isFile = (absPath) => existsSync(absPath) && statSync(absPath).isFile(),
}: {
	handleTrpc: (request: Request) => Response | Promise<Response>
	rendererDist: string
	viteDevServerUrl?: string
	handle?: (
		scheme: string,
		listener: (request: Request) => Response | Promise<Response>,
	) => void
	fetch?: AppAssetFetch
	isFile?: (absPath: string) => boolean
}) {
	handleScheme(APP_SCHEME, async (request) => {
		const route = resolveAppRequest(request.url, request.method, {
			rendererDist,
			viteDevServerUrl,
		})
		switch (route.type) {
			case 'trpc':
				return handleTrpc(request)
			case 'error':
				return new Response(null, { status: route.status })
			case 'forward':
				try {
					return await fetchAsset(route.url, {
						method: request.method,
						headers: headersWithoutHost(request.headers),
						bypassCustomProtocolHandlers: true,
					})
				} catch (error) {
					console.error('[app-protocol] 转发 Vite 失败', route.url, error)
					return new Response(null, { status: 502 })
				}
			case 'file':
				if (!isFile(route.absPath)) {
					return new Response(null, { status: 404 })
				}
				return fetchAsset(pathToFileURL(route.absPath).href)
		}
	})
}
