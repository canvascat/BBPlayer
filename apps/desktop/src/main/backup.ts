import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PlayerDatabase, type LocalPlaylist } from '@bbplayer/db'
import JSZip from 'jszip'

function assertBackupVersion(raw: string) {
	const parsed = JSON.parse(raw) as { version?: number }
	if (parsed.version !== 1) {
		throw new Error(`不支持的备份版本：${parsed.version ?? '未知'}`)
	}
}

function playlistsFromSqlite(bytes: Uint8Array) {
	const dir = mkdtempSync(join(tmpdir(), 'bbplayer-backup-'))
	const path = join(dir, 'database.db')
	writeFileSync(path, bytes)
	const db = PlayerDatabase.open(path)
	try {
		return db.listFull()
	} finally {
		db.close()
		rmSync(dir, { recursive: true, force: true })
	}
}

export async function readBackupZip(bytes: Uint8Array | ArrayBuffer) {
	const zip = await JSZip.loadAsync(bytes)
	const manifestEntry = zip.file('manifest.json')
	if (!manifestEntry) throw new Error('备份文件无效：缺少 manifest.json')
	assertBackupVersion(await manifestEntry.async('string'))
	const dbEntry = zip.file('database.db')
	if (dbEntry) {
		const sqliteBytes = await dbEntry.async('uint8array')
		return {
			sqliteBytes,
			playlists: playlistsFromSqlite(sqliteBytes),
		}
	}
	const desktopEntry = zip.file('playlists.json')
	if (desktopEntry) {
		const playlists = JSON.parse(
			await desktopEntry.async('string'),
		) as LocalPlaylist[]
		if (!Array.isArray(playlists)) {
			throw new Error('备份文件无效：playlists.json 格式错误')
		}
		return { playlists, sqliteBytes: null }
	}
	throw new Error('备份文件无效：缺少 database.db')
}

export async function writeBackupZip(db: PlayerDatabase) {
	const dir = mkdtempSync(join(tmpdir(), 'bbplayer-backup-'))
	const snapshot = join(dir, 'database.db')
	try {
		db.vacuumInto(snapshot)
		const zip = new JSZip()
		zip.file(
			'manifest.json',
			JSON.stringify(
				{
					version: 1,
					exportedAt: new Date().toISOString(),
				},
				null,
				2,
			),
		)
		zip.file('database.db', readFileSync(snapshot))
		return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
}
