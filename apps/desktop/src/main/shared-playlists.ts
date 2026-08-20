import type { PlayerDatabase } from '@bbplayer/db'

import {
	createSharedPlaylist,
	getEditorInvite,
	listCloudPlaylists,
	previewCloudPlaylist,
	pullCloudChanges,
	rotateEditorInvite,
	subscribeCloudPlaylist,
} from './bbplayer-api.ts'
import { parseShareLink, subscribeUrl } from './share-link.ts'

function requireToken(token: string | null | undefined) {
	if (!token) throw new Error('请先登录 BBPlayer 账号')
	return token
}

function restoreMessage(restored: number) {
	if (restored > 0) return `已恢复 ${restored} 个共享歌单`
	return '云端共享歌单已同步'
}

export async function previewSharedPlaylist(input: string) {
	const { shareId } = parseShareLink(input)
	if (!shareId) throw new Error('请粘贴分享链接或歌单 ID')
	const data = await previewCloudPlaylist(shareId)
	return {
		shareId,
		title: data.playlist.title,
		description: data.playlist.description ?? '',
		coverUrl: data.playlist.cover_url ?? '',
		trackCount: data.playlist.track_count,
		ownerName: data.owner?.name ?? '',
	}
}

export async function enableSharing(
	db: PlayerDatabase,
	token: string | null | undefined,
	playlistId: string,
) {
	const auth = requireToken(token)
	const playlist = db.get(playlistId)
	if (!playlist) throw new Error('找不到该播放列表')
	if (playlist.shareId) {
		return {
			shareId: playlist.shareId,
			subscribeUrl: subscribeUrl(playlist.shareId),
			alreadyShared: true,
		}
	}
	const tracks = db.exportShareTracks(playlistId)
	const created = await createSharedPlaylist(auth, {
		title: playlist.title,
		description: playlist.description || undefined,
		cover_url: playlist.coverUrl || undefined,
		tracks,
	})
	const shareId = created.playlist.id
	const parsed = created.playlist.updatedAt
		? new Date(created.playlist.updatedAt).getTime()
		: Number(created.playlist.updated_at)
	const serverTime = Number.isFinite(parsed) ? parsed : Date.now()
	db.setShareMeta(playlistId, {
		shareId,
		shareRole: 'owner',
		lastShareSyncAt: serverTime,
	})
	return {
		shareId,
		subscribeUrl: subscribeUrl(shareId),
		alreadyShared: false,
	}
}

export async function subscribeToSharedPlaylist(
	db: PlayerDatabase,
	token: string | null | undefined,
	input: string,
	inviteCode?: string,
) {
	const auth = requireToken(token)
	const parsed = parseShareLink(input)
	const shareId = parsed.shareId
	if (!shareId) throw new Error('请粘贴分享链接或歌单 ID')
	const code = (inviteCode || parsed.inviteCode || '').trim()
	const existing = db.findByShareId(shareId)
	if (existing) {
		return {
			playlistId: existing.id,
			alreadyMember: true,
			title: existing.title,
		}
	}
	const subscribed = await subscribeCloudPlaylist(
		auth,
		shareId,
		code || undefined,
	)
	const changes = await pullCloudChanges(auth, shareId, 0)
	const created = db.create({
		title: changes.metadata?.title || '共享歌单',
		description: changes.metadata?.description ?? '',
		coverUrl: changes.metadata?.cover_url ?? '',
		shareId,
		shareRole: subscribed.role,
		lastShareSyncAt: 0,
	})
	db.applySharePull(created.id, changes)
	db.setShareMeta(created.id, {
		lastShareSyncAt: changes.server_time ?? Date.now(),
	})
	const playlist = db.get(created.id)!
	return {
		playlistId: playlist.id,
		alreadyMember: Boolean(subscribed.already_member),
		title: playlist.title,
	}
}

export async function restoreFromCloud(
	db: PlayerDatabase,
	token: string | null | undefined,
) {
	const auth = requireToken(token)
	const { playlists } = await listCloudPlaylists(auth)
	const localShareIds = new Set(db.listShareIds())
	const missing = playlists.filter((item) => !localShareIds.has(item.id))
	let restored = 0
	for (const remote of missing) {
		try {
			const changes = await pullCloudChanges(auth, remote.id, 0)
			const created = db.create({
				title: remote.title,
				description: remote.description ?? '',
				coverUrl: remote.coverUrl ?? '',
				shareId: remote.id,
				shareRole: remote.role,
				lastShareSyncAt: 0,
			})
			db.applySharePull(created.id, changes)
			db.setShareMeta(created.id, {
				lastShareSyncAt: changes.server_time ?? Date.now(),
			})
			restored += 1
		} catch (error) {
			console.error('恢复共享歌单失败', remote.id, error)
		}
	}
	return { restored, message: restoreMessage(restored) }
}

export async function pullSharedChanges(
	db: PlayerDatabase,
	token: string | null | undefined,
	playlistId: string,
) {
	const auth = requireToken(token)
	const playlist = db.get(playlistId)
	if (!playlist?.shareId) throw new Error('该歌单未开启共享')
	try {
		const changes = await pullCloudChanges(
			auth,
			playlist.shareId,
			playlist.lastShareSyncAt ?? 0,
		)
		const applied = db.applySharePull(playlistId, changes)
		db.setShareMeta(playlistId, {
			lastShareSyncAt: changes.server_time ?? Date.now(),
		})
		return { applied }
	} catch (error) {
		if (
			error instanceof Error &&
			(error.message === '共享歌单不存在或已删除' ||
				error.message === '共享歌单已被删除或无权限访问')
		) {
			throw error
		}
		throw error
	}
}

export async function copyShareLink(
	db: PlayerDatabase,
	token: string | null | undefined,
	playlistId: string,
	kind: 'subscribe' | 'editor',
) {
	const playlist = db.get(playlistId)
	if (!playlist?.shareId) throw new Error('该歌单未开启共享')
	if (kind === 'subscribe') {
		return {
			url: subscribeUrl(playlist.shareId),
			inviteCode: null as string | null,
		}
	}
	if (playlist.shareRole !== 'owner') {
		throw new Error('只有创建者可以复制协作链接')
	}
	const auth = requireToken(token)
	let invite = (await getEditorInvite(auth, playlist.shareId))
		.editor_invite_code
	if (!invite) {
		invite = (await rotateEditorInvite(auth, playlist.shareId))
			.editor_invite_code
	}
	return { url: subscribeUrl(playlist.shareId, invite), inviteCode: invite }
}

export async function rotateInvite(
	db: PlayerDatabase,
	token: string | null | undefined,
	playlistId: string,
) {
	const auth = requireToken(token)
	const playlist = db.get(playlistId)
	if (!playlist?.shareId) throw new Error('该歌单未开启共享')
	if (playlist.shareRole !== 'owner') {
		throw new Error('只有创建者可以重置邀请码')
	}
	const result = await rotateEditorInvite(auth, playlist.shareId)
	return {
		inviteCode: result.editor_invite_code,
		url: subscribeUrl(playlist.shareId, result.editor_invite_code),
	}
}
