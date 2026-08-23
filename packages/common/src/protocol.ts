export const APP_SCHEME = 'app'
export const APP_ORIGIN = `${APP_SCHEME}://localhost`
export const TRPC_PATH = '/trpc'
export const TRPC_URL = `${APP_ORIGIN}${TRPC_PATH}`

export type RendererPage = 'index.html' | 'lyrics.html' | 'mini.html'

export function rendererUrl(page: RendererPage) {
	return page === 'index.html' ? `${APP_ORIGIN}/` : `${APP_ORIGIN}/${page}`
}
