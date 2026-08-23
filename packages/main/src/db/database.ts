import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { generateKeyBetween } from 'fractional-indexing'

import { DRIZZLE_MIGRATION_TIMES, SCHEMA_SQL } from './schema.ts'
import type {
	LibraryTrack,
	LocalPlaylist,
	PlaylistSummary,
	SharePullData,
	ShareRole,
	ShareTrackPayload,
	ShareUploadTrack,
} from './types.ts'

interface PlaylistRow {
	id: number
	title: string
	description: string | null
	cover_url: string | null
	created_at: number
	updated_at: number
	item_count: number
	share_id: string | null
	share_role: string | null
	last_share_sync_at: number | null
}

function asShareRole(value: string | null | undefined): ShareRole | null {
	if (value === 'owner' || value === 'editor' || value === 'subscriber') {
		return value
	}
	return null
}

function asNumber(value: number | bigint) {
	return typeof value === 'bigint' ? Number(value) : value
}

function trackKey(track: LibraryTrack) {
	if (track.id) return track.id
	return track.cid
		? `bilibili::${track.bvid}::${track.cid}`
		: `bilibili::${track.bvid}`
}

export class PlayerDatabase {
	readonly path: string
	private db: DatabaseSync

	private constructor(path: string, db: DatabaseSync) {
		this.path = path
		this.db = db
	}

	static open(path: string) {
		if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
		const sqlite = new DatabaseSync(path)
		sqlite.exec('PRAGMA foreign_keys = ON')
		if (path !== ':memory:') sqlite.exec('PRAGMA journal_mode = WAL')
		const instance = new PlayerDatabase(path, sqlite)
		instance.ensureSchema()
		return instance
	}

	close() {
		try {
			this.db.close()
		} catch {
			// already closed
		}
	}

	reopen() {
		this.close()
		this.db = new DatabaseSync(this.path)
		this.db.exec('PRAGMA foreign_keys = ON')
		if (this.path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL')
		this.ensureSchema()
	}

	replaceFromBytes(bytes: Uint8Array) {
		if (this.path === ':memory:') {
			throw new Error('内存库不能替换文件')
		}
		try {
			this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
		} catch {
			// ignore
		}
		this.close()
		for (const suffix of ['-wal', '-shm']) {
			const extra = `${this.path}${suffix}`
			if (existsSync(extra)) unlinkSync(extra)
		}
		writeFileSync(this.path, bytes)
		this.db = new DatabaseSync(this.path)
		this.db.exec('PRAGMA foreign_keys = ON')
		this.db.exec('PRAGMA journal_mode = WAL')
		this.ensureSchema()
		this.clearSyncQueue()
	}

	clearSyncQueue() {
		try {
			this.db.exec('DELETE FROM playlist_sync_queue')
		} catch {
			// 旧库可能没有这张表
		}
	}

	vacuumInto(dest: string) {
		if (existsSync(dest)) unlinkSync(dest)
		const escaped = dest.replaceAll("'", "''")
		this.db.exec(`VACUUM INTO '${escaped}'`)
	}

	private ensureSchema() {
		const hasPlaylists = this.db
			.prepare(
				`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'playlists'`,
			)
			.get()
		if (!hasPlaylists) {
			this.db.exec(SCHEMA_SQL)
			this.stampMigrations()
			return
		}
		this.stampMigrations()
	}

	private stampMigrations() {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS __drizzle_migrations (
				id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
				hash TEXT NOT NULL,
				created_at NUMERIC
			)
		`)
		const last = this.db
			.prepare(
				`SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
			)
			.get() as { created_at: number | string } | undefined
		const lastWhen = last ? Number(last.created_at) : 0
		const insert = this.db.prepare(
			`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
		)
		this.db.exec('BEGIN')
		try {
			for (const when of DRIZZLE_MIGRATION_TIMES) {
				if (when <= lastWhen) continue
				insert.run('', when)
			}
			this.db.exec('COMMIT')
		} catch (error) {
			this.db.exec('ROLLBACK')
			throw error
		}
	}

	private transaction<T>(work: () => T) {
		this.db.exec('BEGIN')
		try {
			const result = work()
			this.db.exec('COMMIT')
			return result
		} catch (error) {
			this.db.exec('ROLLBACK')
			throw error
		}
	}

	private findOrCreateArtist(name: string, remoteId?: string) {
		const artistName = name.trim() || '未知'
		const remote = remoteId?.trim()
		if (remote) {
			const existing = this.db
				.prepare(
					`SELECT id FROM artists WHERE source = 'bilibili' AND remote_id = ? LIMIT 1`,
				)
				.get(remote) as { id: number } | undefined
			if (existing) {
				this.db
					.prepare(`UPDATE artists SET name = ?, updated_at = ? WHERE id = ?`)
					.run(artistName, Date.now(), existing.id)
				return existing.id
			}
			const now = Date.now()
			const result = this.db
				.prepare(
					`INSERT INTO artists (name, source, remote_id, created_at, updated_at)
           VALUES (?, 'bilibili', ?, ?, ?)`,
				)
				.run(artistName, remote, now, now)
			return asNumber(result.lastInsertRowid)
		}
		const existing = this.db
			.prepare(
				`SELECT id FROM artists WHERE source = 'local' AND name = ? LIMIT 1`,
			)
			.get(artistName) as { id: number } | undefined
		if (existing) return existing.id
		const now = Date.now()
		const result = this.db
			.prepare(
				`INSERT INTO artists (name, source, remote_id, created_at, updated_at)
         VALUES (?, 'local', NULL, ?, ?)`,
			)
			.run(artistName, now, now)
		return asNumber(result.lastInsertRowid)
	}

	private findOrCreateTrack(track: LibraryTrack) {
		const uniqueKey = trackKey(track)
		const existing = this.db
			.prepare(`SELECT id FROM tracks WHERE unique_key = ? LIMIT 1`)
			.get(uniqueKey) as { id: number } | undefined
		if (existing) return existing.id
		const now = Date.now()
		const artistId = this.findOrCreateArtist(track.artist)
		const inserted = this.db
			.prepare(
				`INSERT INTO tracks (unique_key, title, artist_id, cover_url, duration, created_at, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'bilibili', ?)`,
			)
			.run(
				uniqueKey,
				track.title,
				artistId,
				track.artwork || null,
				track.duration || 0,
				now,
				now,
			)
		const trackId = asNumber(inserted.lastInsertRowid)
		this.db
			.prepare(
				`INSERT INTO bilibili_metadata (track_id, bvid, cid, is_multi_page, video_is_valid)
         VALUES (?, ?, ?, ?, 1)`,
			)
			.run(trackId, track.bvid, track.cid || 0, track.cid ? 1 : 0)
		return trackId
	}

	private nextSortKey(playlistId: number) {
		const last = this.db
			.prepare(
				`SELECT sort_key FROM playlist_tracks WHERE playlist_id = ? ORDER BY sort_key DESC LIMIT 1`,
			)
			.get(playlistId) as { sort_key: string } | undefined
		return generateKeyBetween(last?.sort_key ?? null, null)
	}

	private playlistById(id: number): LocalPlaylist | null {
		const row = this.db
			.prepare(
				`SELECT id, title, description, cover_url, created_at, updated_at, item_count,
                share_id, share_role, last_share_sync_at
         FROM playlists WHERE id = ?`,
			)
			.get(id) as unknown as PlaylistRow | undefined
		if (!row) return null
		const tracks = this.db
			.prepare(
				`SELECT t.unique_key, t.title, t.cover_url, t.duration, a.name as artist,
                b.bvid, b.cid
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         LEFT JOIN artists a ON a.id = t.artist_id
         LEFT JOIN bilibili_metadata b ON b.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY pt.sort_key`,
			)
			.all(id) as Array<{
			unique_key: string
			title: string
			cover_url: string | null
			duration: number | null
			artist: string | null
			bvid: string | null
			cid: number | null
		}>
		return {
			id: String(row.id),
			title: row.title,
			description: row.description ?? '',
			coverUrl: row.cover_url ?? '',
			createdAt: Number(row.created_at),
			updatedAt: Number(row.updated_at),
			shareId: row.share_id ?? null,
			shareRole: asShareRole(row.share_role),
			lastShareSyncAt: row.last_share_sync_at
				? Number(row.last_share_sync_at)
				: null,
			tracks: tracks
				.filter((item) => item.bvid)
				.map((item) => ({
					id: item.unique_key,
					bvid: item.bvid as string,
					cid: Number(item.cid ?? 0),
					title: item.title,
					artist: item.artist ?? '',
					artwork: item.cover_url ?? '',
					duration: Number(item.duration ?? 0),
				})),
		}
	}

	list(): PlaylistSummary[] {
		const rows = this.db
			.prepare(
				`SELECT id, title, description, cover_url, created_at, updated_at, item_count,
                share_id, share_role, last_share_sync_at
         FROM playlists
         ORDER BY updated_at DESC, id DESC`,
			)
			.all() as unknown as PlaylistRow[]
		return rows.map((row) => ({
			id: String(row.id),
			title: row.title,
			description: row.description ?? '',
			coverUrl: row.cover_url ?? '',
			itemCount: Number(row.item_count ?? 0),
			updatedAt: Number(row.updated_at),
			shareId: row.share_id ?? null,
			shareRole: asShareRole(row.share_role),
		}))
	}

	listFull(): LocalPlaylist[] {
		return this.list()
			.map((item) => this.get(item.id))
			.filter((item): item is LocalPlaylist => Boolean(item))
	}

	get(id: string) {
		const numeric = Number(id)
		if (!Number.isInteger(numeric)) return null
		return this.playlistById(numeric)
	}

	create(payload: {
		title: string
		description?: string
		coverUrl?: string
		tracks?: LibraryTrack[]
		shareId?: string | null
		shareRole?: ShareRole | null
		lastShareSyncAt?: number | null
	}) {
		const title = payload.title.trim()
		if (!title) throw new Error('标题不能为空')
		const tracks = (payload.tracks ?? []).filter((track) => track.bvid)
		return this.transaction(() => {
			const now = Date.now()
			const inserted = this.db
				.prepare(
					`INSERT INTO playlists (
             title, description, cover_url, item_count, type, is_pinned,
             created_at, updated_at, share_id, share_role, last_share_sync_at
           )
           VALUES (?, ?, ?, ?, 'local', 0, ?, ?, ?, ?, ?)`,
				)
				.run(
					title,
					payload.description?.trim() ?? '',
					payload.coverUrl?.trim() || tracks[0]?.artwork || '',
					tracks.length,
					now,
					now,
					payload.shareId ?? null,
					payload.shareRole ?? null,
					payload.lastShareSyncAt ?? null,
				)
			const playlistId = asNumber(inserted.lastInsertRowid)
			for (const track of tracks) {
				const trackId = this.findOrCreateTrack(track)
				this.db
					.prepare(
						`INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, sort_key, created_at)
             VALUES (?, ?, ?, ?)`,
					)
					.run(playlistId, trackId, this.nextSortKey(playlistId), now)
			}
			this.syncItemCount(playlistId)
			return this.playlistById(playlistId)!
		})
	}

	rename(id: string, title: string) {
		const nextTitle = title.trim()
		if (!nextTitle) throw new Error('标题不能为空')
		const playlist = this.requirePlaylist(id)
		this.db
			.prepare(`UPDATE playlists SET title = ?, updated_at = ? WHERE id = ?`)
			.run(nextTitle, Date.now(), Number(playlist.id))
		return this.playlistById(Number(playlist.id))!
	}

	delete(id: string) {
		this.requirePlaylist(id)
		this.db.prepare(`DELETE FROM playlists WHERE id = ?`).run(Number(id))
		return true
	}

	addTracks(playlistId: string, tracks: LibraryTrack[]) {
		const playlist = this.requirePlaylist(playlistId)
		return this.transaction(() => {
			const now = Date.now()
			const numericId = Number(playlist.id)
			for (const track of tracks.filter((item) => item.bvid)) {
				const trackId = this.findOrCreateTrack(track)
				this.db
					.prepare(
						`INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, sort_key, created_at)
             VALUES (?, ?, ?, ?)`,
					)
					.run(numericId, trackId, this.nextSortKey(numericId), now)
			}
			this.db
				.prepare(
					`UPDATE playlists
           SET cover_url = COALESCE(NULLIF(cover_url, ''), ?), updated_at = ?
           WHERE id = ?`,
				)
				.run(tracks[0]?.artwork ?? '', now, numericId)
			this.syncItemCount(numericId)
			return this.playlistById(numericId)!
		})
	}

	removeTrack(playlistId: string, trackId: string) {
		const playlist = this.requirePlaylist(playlistId)
		const numericId = Number(playlist.id)
		const track = this.db
			.prepare(`SELECT id FROM tracks WHERE unique_key = ?`)
			.get(trackId) as { id: number } | undefined
		if (!track) throw new Error('找不到该曲目')
		this.db
			.prepare(
				`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`,
			)
			.run(numericId, track.id)
		const cover = this.db
			.prepare(
				`SELECT t.cover_url FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = ?
         ORDER BY pt.sort_key LIMIT 1`,
			)
			.get(numericId) as { cover_url: string | null } | undefined
		this.db
			.prepare(
				`UPDATE playlists SET cover_url = ?, updated_at = ? WHERE id = ?`,
			)
			.run(cover?.cover_url ?? '', Date.now(), numericId)
		this.refreshCover(numericId)
		this.syncItemCount(numericId)
		return this.playlistById(numericId)!
	}

	findByShareId(shareId: string) {
		const id = shareId.trim()
		if (!id) return null
		const row = this.db
			.prepare(`SELECT id FROM playlists WHERE share_id = ? LIMIT 1`)
			.get(id) as { id: number } | undefined
		if (!row) return null
		return this.playlistById(row.id)
	}

	listShareIds() {
		const rows = this.db
			.prepare(
				`SELECT share_id FROM playlists WHERE share_id IS NOT NULL AND share_id != ''`,
			)
			.all() as Array<{ share_id: string }>
		return rows.map((row) => row.share_id)
	}

	setShareMeta(
		id: string,
		patch: {
			shareId?: string | null
			shareRole?: ShareRole | null
			lastShareSyncAt?: number | null
			title?: string
			description?: string | null
			coverUrl?: string | null
		},
	) {
		const playlist = this.requirePlaylist(id)
		const numericId = Number(playlist.id)
		const current = this.db
			.prepare(
				`SELECT title, description, cover_url, share_id, share_role, last_share_sync_at
         FROM playlists WHERE id = ?`,
			)
			.get(numericId) as unknown as PlaylistRow
		this.db
			.prepare(
				`UPDATE playlists
         SET title = ?, description = ?, cover_url = ?, share_id = ?, share_role = ?,
             last_share_sync_at = ?, updated_at = ?
         WHERE id = ?`,
			)
			.run(
				patch.title?.trim() || current.title,
				patch.description !== undefined
					? (patch.description ?? '')
					: (current.description ?? ''),
				patch.coverUrl !== undefined
					? (patch.coverUrl ?? '')
					: (current.cover_url ?? ''),
				patch.shareId !== undefined ? patch.shareId : current.share_id,
				patch.shareRole !== undefined ? patch.shareRole : current.share_role,
				patch.lastShareSyncAt !== undefined
					? patch.lastShareSyncAt
					: current.last_share_sync_at,
				Date.now(),
				numericId,
			)
		return this.playlistById(numericId)!
	}

	exportShareTracks(id: string): ShareUploadTrack[] {
		const playlist = this.requirePlaylist(id)
		const rows = this.db
			.prepare(
				`SELECT t.unique_key, t.title, t.cover_url, t.duration, a.name as artist_name,
                a.remote_id as artist_id, b.bvid, b.cid, pt.sort_key
         FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         LEFT JOIN artists a ON a.id = t.artist_id
         LEFT JOIN bilibili_metadata b ON b.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY pt.sort_key`,
			)
			.all(Number(playlist.id)) as Array<{
			unique_key: string
			title: string
			cover_url: string | null
			duration: number | null
			artist_name: string | null
			artist_id: string | null
			bvid: string | null
			cid: number | null
			sort_key: string
		}>
		return rows
			.filter((row) => row.bvid)
			.map((row) => ({
				track: {
					unique_key: row.unique_key,
					title: row.title,
					cover_url: row.cover_url ?? undefined,
					duration: row.duration ?? undefined,
					artist_name: row.artist_name ?? undefined,
					artist_id: row.artist_id ?? undefined,
					bilibili_bvid: row.bvid as string,
					bilibili_cid: row.cid ? String(row.cid) : undefined,
				},
				sort_key: row.sort_key,
			}))
	}

	applySharePull(id: string, data: SharePullData) {
		const playlist = this.requirePlaylist(id)
		const numericId = Number(playlist.id)
		return this.transaction(() => {
			let applied = 0
			if (data.metadata) {
				const meta = data.metadata
				this.setShareMeta(id, {
					title: meta.title ?? undefined,
					description: meta.description,
					coverUrl: meta.cover_url,
				})
			}
			for (const change of data.tracks ?? []) {
				if (change.op === 'delete') {
					this.unlinkByUniqueKey(numericId, change.track_unique_key)
					applied += 1
					continue
				}
				this.upsertSharedTrack(numericId, change.track, change.sort_key)
				applied += 1
			}
			if (data.metadata?.cover_url == null) this.refreshCover(numericId)
			this.syncItemCount(numericId)
			return applied
		})
	}

	private upsertSharedTrack(
		playlistId: number,
		track: ShareTrackPayload,
		sortKey: string,
	) {
		const uniqueKey = track.unique_key
		const cid = track.bilibili_cid ? Number(track.bilibili_cid) : 0
		const now = Date.now()
		const artistId = this.findOrCreateArtist(
			track.artist_name ?? '',
			track.artist_id,
		)
		const existing = this.db
			.prepare(`SELECT id FROM tracks WHERE unique_key = ? LIMIT 1`)
			.get(uniqueKey) as { id: number } | undefined
		let trackId: number
		if (existing) {
			trackId = existing.id
			this.db
				.prepare(
					`UPDATE tracks
           SET title = ?, artist_id = ?, cover_url = ?, duration = ?, updated_at = ?
           WHERE id = ?`,
				)
				.run(
					track.title,
					artistId,
					track.cover_url || null,
					track.duration || 0,
					now,
					trackId,
				)
			this.db
				.prepare(
					`INSERT INTO bilibili_metadata (track_id, bvid, cid, is_multi_page, video_is_valid)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(track_id) DO UPDATE SET
             bvid = excluded.bvid,
             cid = excluded.cid,
             is_multi_page = excluded.is_multi_page`,
				)
				.run(trackId, track.bilibili_bvid, cid || 0, cid ? 1 : 0)
		} else {
			const inserted = this.db
				.prepare(
					`INSERT INTO tracks (unique_key, title, artist_id, cover_url, duration, created_at, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'bilibili', ?)`,
				)
				.run(
					uniqueKey,
					track.title,
					artistId,
					track.cover_url || null,
					track.duration || 0,
					now,
					now,
				)
			trackId = asNumber(inserted.lastInsertRowid)
			this.db
				.prepare(
					`INSERT INTO bilibili_metadata (track_id, bvid, cid, is_multi_page, video_is_valid)
           VALUES (?, ?, ?, ?, 1)`,
				)
				.run(trackId, track.bilibili_bvid, cid || 0, cid ? 1 : 0)
		}
		this.db
			.prepare(
				`INSERT INTO playlist_tracks (playlist_id, track_id, sort_key, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(playlist_id, track_id) DO UPDATE SET sort_key = excluded.sort_key`,
			)
			.run(playlistId, trackId, sortKey, now)
	}

	private unlinkByUniqueKey(playlistId: number, uniqueKey: string) {
		const track = this.db
			.prepare(`SELECT id FROM tracks WHERE unique_key = ?`)
			.get(uniqueKey) as { id: number } | undefined
		if (!track) return
		this.db
			.prepare(
				`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`,
			)
			.run(playlistId, track.id)
	}

	private refreshCover(playlistId: number) {
		const cover = this.db
			.prepare(
				`SELECT t.cover_url FROM playlist_tracks pt
         JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = ?
         ORDER BY pt.sort_key LIMIT 1`,
			)
			.get(playlistId) as { cover_url: string | null } | undefined
		this.db
			.prepare(
				`UPDATE playlists SET cover_url = ?, updated_at = ? WHERE id = ?`,
			)
			.run(cover?.cover_url ?? '', Date.now(), playlistId)
	}

	importPlaylists(incoming: LocalPlaylist[]) {
		let count = 0
		for (const playlist of incoming) {
			this.create({
				title: playlist.title,
				description: playlist.description,
				tracks: playlist.tracks,
			})
			count += 1
		}
		return count
	}

	private requirePlaylist(id: string) {
		const playlist = this.get(id)
		if (!playlist) throw new Error('找不到该播放列表')
		return playlist
	}

	private syncItemCount(playlistId: number) {
		this.db
			.prepare(
				`UPDATE playlists SET item_count = (
           SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?
         ) WHERE id = ?`,
			)
			.run(playlistId, playlistId)
	}
}
