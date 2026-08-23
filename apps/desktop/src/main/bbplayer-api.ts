import { mapAuthError } from './bbplayer-account.ts'
import type { BbplayerAccount } from './bbplayer-account.ts'
import type { SharePullData, ShareRole, ShareUploadTrack } from './db'

export const BBPLAYER_API_BASE = 'https://be.bbplayer.roitium.com'

export class BbplayerApiError extends Error {
	status: number
	code?: string
	constructor(message: string, status: number, code?: string) {
		super(message)
		this.status = status
		this.code = code
	}
}

interface RequestOptions {
	token?: string | null
	method?: string
	body?: unknown
	query?: Record<string, string | number | undefined>
}

async function request<T>(
	path: string,
	options: RequestOptions = {},
): Promise<T> {
	const url = new URL(path, BBPLAYER_API_BASE)
	if (options.query) {
		for (const [key, value] of Object.entries(options.query)) {
			if (value === undefined) continue
			url.searchParams.set(key, String(value))
		}
	}
	const headers: Record<string, string> = { Accept: 'application/json' }
	if (options.token) headers.Authorization = `Bearer ${options.token}`
	if (options.body !== undefined) headers['Content-Type'] = 'application/json'
	const response = await fetch(url, {
		method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	})
	const raw = await response.text()
	let json: unknown = null
	if (raw) {
		try {
			json = JSON.parse(raw)
		} catch {
			json = { error: raw }
		}
	}
	if (!response.ok) {
		const body = (json ?? {}) as { error?: string; summary?: string }
		throw new BbplayerApiError(
			mapAuthError(response.status, body, `请求失败：${response.status}`),
			response.status,
			body.error,
		)
	}
	return json as T
}

export function loginRequest(username: string, password: string) {
	return request<{ token: string; account: BbplayerAccount }>('/auth/login', {
		body: { username: username.trim().toLowerCase(), password },
	})
}

export function registerRequest(payload: {
	username: string
	password: string
	name?: string
	face?: string
}) {
	return request<{ token: string; account: BbplayerAccount }>(
		'/auth/register',
		{
			body: {
				username: payload.username.trim().toLowerCase(),
				password: payload.password,
				name: payload.name?.trim() || undefined,
				face: payload.face?.trim() || undefined,
			},
		},
	)
}

export function fetchMe(token: string) {
	return request<{ account: BbplayerAccount }>('/auth/me', { token })
}

export function updateProfileRequest(
	token: string,
	payload: { name?: string; face?: string },
) {
	return request<{ account: BbplayerAccount }>('/auth/profile', {
		token,
		method: 'PATCH',
		body: payload,
	})
}

export function listCloudPlaylists(token: string) {
	return request<{
		playlists: Array<{
			id: string
			title: string
			description: string | null
			coverUrl: string | null
			role: ShareRole
		}>
	}>('/me/playlists', { token })
}

export function createSharedPlaylist(
	token: string,
	payload: {
		title: string
		description?: string
		cover_url?: string
		tracks?: ShareUploadTrack[]
	},
) {
	return request<{
		playlist: { id: string; updatedAt?: string; updated_at?: number }
	}>('/playlists', { token, body: payload })
}

export function subscribeCloudPlaylist(
	token: string,
	shareId: string,
	inviteCode?: string,
) {
	return request<{ role: ShareRole; already_member?: boolean }>(
		`/playlists/${encodeURIComponent(shareId)}/subscribe`,
		{
			token,
			body: inviteCode ? { invite_code: inviteCode } : {},
		},
	)
}

export function pullCloudChanges(
	token: string,
	shareId: string,
	since: number,
) {
	return request<
		SharePullData & {
			server_time?: number
		}
	>(`/playlists/${encodeURIComponent(shareId)}/changes`, {
		token,
		query: { since },
	})
}

export function previewCloudPlaylist(shareId: string) {
	return request<{
		playlist: {
			id: string
			title: string
			description: string | null
			cover_url: string | null
			track_count: number
		}
		owner: { name: string } | null
	}>(`/playlists/${encodeURIComponent(shareId)}/preview`)
}

export function getEditorInvite(token: string, shareId: string) {
	return request<{ editor_invite_code: string | null }>(
		`/playlists/${encodeURIComponent(shareId)}/invite`,
		{ token },
	)
}

export function rotateEditorInvite(token: string, shareId: string) {
	return request<{ editor_invite_code: string }>(
		`/playlists/${encodeURIComponent(shareId)}/invite/rotate`,
		{ token, method: 'POST', body: {} },
	)
}
