import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { PlayerDatabase } from '@bbplayer/db'

import { readBackupZip, writeBackupZip } from './backup.ts'

test('备份 zip 含 database.db 与 manifest.json', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'bbplayer-backup-test-'))
	const db = PlayerDatabase.open(join(dir, 'db.db'))
	db.create({
		title: '晚间',
		description: 'desc',
		tracks: [
			{
				id: 'bilibili::BV1xx',
				bvid: 'BV1xx',
				cid: 0,
				title: '歌',
				artist: 'UP',
				artwork: 'https://example.com/a.jpg',
				duration: 120,
			},
		],
	})
	const bytes = await writeBackupZip(db)
	const result = await readBackupZip(bytes)
	assert.equal(result.playlists.length, 1)
	assert.equal(result.playlists[0].title, '晚间')
	assert.equal(result.playlists[0].tracks[0].bvid, 'BV1xx')
	assert.ok(result.sqliteBytes)
	db.close()
	rmSync(dir, { recursive: true, force: true })
})
