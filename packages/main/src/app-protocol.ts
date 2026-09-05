import { existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
	APP_ORIGIN,
	APP_SCHEME,
	TRPC_PATH,
	rendererUrl,
	type RendererPage,
} from '@bbplayer/common'

import { getLogger } from './logger/runtime.ts'

export { APP_ORIGIN, APP_SCHEME, rendererUrl, type RendererPage }

const electronRequire = createRequire(import.meta.url)

function electron() {
	return electronRequire('electron') as typeof import('electron')
}

export type AppRequestEnv = {
	rendererDist: string
}

export type AppRequestRoute =
	| { type: 'trpc' }
	| { type: 'file'; absPath: string }
	| { type: 'error'; status: 404 | 405 }

export function resolveRendererFile(pathname: string, rendererDist: string) {
	let decoded: string
	try {
		decoded = decodeURIComponent(pathname)
	} catch (error) {
		getLogger('protocol').debug({ err: error }, 'decode pathname failed')
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
	} catch (error) {
		getLogger('protocol').debug({ err: error }, 'parse request url failed')
		return { type: 'error', status: 404 }
	}
	if (url.pathname === TRPC_PATH || url.pathname.startsWith(`${TRPC_PATH}/`)) {
		return { type: 'trpc' }
	}
	const upper = method.toUpperCase()
	if (upper !== 'GET' && upper !== 'HEAD') {
		return { type: 'error', status: 405 }
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
	rendererDist,
	handle: handleScheme = (scheme, listener) =>
		electron().protocol.handle(scheme, listener),
	fetch: fetchAsset = (input) => electron().net.fetch(input),
	isFile = (absPath) => existsSync(absPath) && statSync(absPath).isFile(),
}: {
	handleTrpc: (request: Request) => Response | Promise<Response>
	rendererDist: string
	handle?: (
		scheme: string,
		listener: (request: Request) => Response | Promise<Response>,
	) => void
	fetch?: (input: string) => Promise<Response>
	isFile?: (absPath: string) => boolean
}) {
	try {
		handleScheme(APP_SCHEME, async (request) => {
			const route = resolveAppRequest(request.url, request.method, {
				rendererDist,
			})
			switch (route.type) {
				case 'trpc':
					return handleTrpc(request)
				case 'error':
					return new Response(null, { status: route.status })
				case 'file':
					if (!isFile(route.absPath)) {
						return new Response(null, { status: 404 })
					}
					return fetchAsset(pathToFileURL(route.absPath).href)
			}
		})
	} catch (error) {
		getLogger('protocol').warn(
			{ err: error },
			'install protocol handler failed',
		)
		throw error
	}
}
