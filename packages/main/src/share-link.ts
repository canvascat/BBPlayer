export const SHARE_BASE_URL = 'https://bbplayer.roitium.com/share/playlist'

export const SHARE_ID_RE =
	/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function parseShareLink(input: string): {
	shareId?: string
	inviteCode?: string
} {
	const trimmed = input.trim()
	if (!trimmed) return {}

	try {
		const url = new URL(trimmed)
		const qpShareId = url.searchParams.get('shareId') ?? undefined
		const qpInvite = url.searchParams.get('inviteCode') ?? undefined
		const pathUuid = url.pathname.match(SHARE_ID_RE)?.[0]
		return {
			shareId: qpShareId ?? pathUuid ?? undefined,
			inviteCode: qpInvite ?? undefined,
		}
	} catch {
		const uuid = trimmed.match(SHARE_ID_RE)?.[0]
		return { shareId: uuid ?? undefined, inviteCode: undefined }
	}
}

export function subscribeUrl(shareId: string, inviteCode?: string | null) {
	const url = `${SHARE_BASE_URL}?shareId=${encodeURIComponent(shareId)}`
	if (!inviteCode) return url
	return `${url}&inviteCode=${encodeURIComponent(inviteCode)}`
}
