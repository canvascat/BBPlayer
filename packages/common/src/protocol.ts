export const APP_SCHEME = 'app'
export const APP_ORIGIN = `${APP_SCHEME}://localhost`
export const TRPC_PATH = '/trpc'
export const TRPC_URL = `${APP_ORIGIN}${TRPC_PATH}`

export type RendererPage = 'index.html'

export function rendererUrl(_page: RendererPage) {
	return `${APP_ORIGIN}/`
}
