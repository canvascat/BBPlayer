const ANSI_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, 'g')
const VITE_LOCAL_URL_RE = /Local:\s+(https?:\/\/\S+)/

/** 从 `vp dev` 日志里解析 Vite Local URL。 */
export function parseViteLocalUrl(chunk: string): string | null {
	const match = chunk.replace(ANSI_RE, '').match(VITE_LOCAL_URL_RE)
	if (!match?.[1]) return null
	return match[1].replace(/\/$/, '')
}
