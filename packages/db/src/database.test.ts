import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { test } from 'vitest'

import { PlayerDatabase } from './database.ts'

const sampleTrack = {
	id: 'bilibili::BV1xx',
	bvid: 'BV1xx',
	cid: 0,
	title: '歌',
	artist: 'UP',
	artwork: 'https://example.com/a.jpg',
	duration: 120,
}

test('新建歌单标题不能为空', () => {
	const db = PlayerDatabase.open(':memory:')
	assert.throws(() => db.create({ title: '  ' }), /标题不能为空/)
	db.close()
})

test('添加曲目会去重并更新封面', () => {
	const db = PlayerDatabase.open(':memory:')
	const created = db.create({ title: '晚间' })
	const added = db.addTracks(created.id, [sampleTrack, sampleTrack])
	assert.equal(added.tracks.length, 1)
	assert.equal(added.coverUrl, sampleTrack.artwork)
	assert.equal(db.list()[0].itemCount, 1)
	db.close()
})

test('导入歌单会写入新的整数 id', () => {
	const db = PlayerDatabase.open(':memory:')
	const first = db.create({ title: '晚间', tracks: [sampleTrack] })
	db.importPlaylists([first])
	assert.equal(db.list().length, 2)
	assert.notEqual(db.list()[0].id, db.list()[1].id)
	db.close()
})

test('空库会创建 playlists 表并打上 drizzle 迁移戳', () => {
	const db = PlayerDatabase.open(':memory:')
	assert.equal(db.list().length, 0)
	db.create({ title: '空歌单' })
	assert.equal(db.list().length, 1)
	db.close()
})

test('VACUUM INTO 可以打出可再打开的快照', () => {
	const dir = mkdtempSync(join(tmpdir(), 'bbplayer-db-'))
	const path = join(dir, 'db.db')
	const db = PlayerDatabase.open(path)
	db.create({ title: '晚间', tracks: [sampleTrack] })
	const snapshot = join(dir, 'snap.db')
	db.vacuumInto(snapshot)
	assert.equal(existsSync(snapshot), true)
	const restored = PlayerDatabase.open(snapshot)
	assert.equal(restored.list()[0].title, '晚间')
	assert.equal(restored.listFull()[0].tracks[0].bvid, 'BV1xx')
	restored.close()
	db.close()
	rmSync(dir, { recursive: true, force: true })
})

test('共享拉取会按 unique_key upsert 和删除', () => {
	const db = PlayerDatabase.open(':memory:')
	const created = db.create({
		title: '共享',
		shareId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
		shareRole: 'subscriber',
		lastShareSyncAt: 0,
	})
	db.applySharePull(created.id, {
		metadata: { title: '云端歌单', cover_url: 'https://example.com/c.jpg' },
		tracks: [
			{
				op: 'upsert',
				sort_key: 'a0',
				track: {
					unique_key: 'bilibili::BV1aa',
					title: '第一首',
					artist_name: 'UP',
					artist_id: '123',
					cover_url: 'https://example.com/c.jpg',
					duration: 90,
					bilibili_bvid: 'BV1aa',
				},
			},
			{
				op: 'upsert',
				sort_key: 'a1',
				track: {
					unique_key: 'bilibili::BV1bb::9',
					title: '第二首',
					artist_name: 'UP',
					bilibili_bvid: 'BV1bb',
					bilibili_cid: '9',
				},
			},
		],
	})
	const after = db.get(created.id)!
	assert.equal(after.title, '云端歌单')
	assert.equal(after.tracks.length, 2)
	assert.equal(after.tracks[0].title, '第一首')
	db.applySharePull(created.id, {
		tracks: [{ op: 'delete', track_unique_key: 'bilibili::BV1aa' }],
	})
	assert.equal(db.get(created.id)!.tracks.length, 1)
	assert.equal(db.get(created.id)!.tracks[0].bvid, 'BV1bb')
	assert.equal(
		db.findByShareId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')?.id,
		created.id,
	)
	db.close()
})

test('replaceFromBytes 会换成新的库文件', () => {
	const dir = mkdtempSync(join(tmpdir(), 'bbplayer-db-'))
	const source = PlayerDatabase.open(join(dir, 'src.db'))
	source.create({ title: '导入的歌单', tracks: [sampleTrack] })
	const snapshot = join(dir, 'snap.db')
	source.vacuumInto(snapshot)
	source.close()
	const target = PlayerDatabase.open(join(dir, 'dst.db'))
	target.create({ title: '旧歌单' })
	target.replaceFromBytes(readFileSync(snapshot))
	assert.equal(target.list().length, 1)
	assert.equal(target.list()[0].title, '导入的歌单')
	target.close()
	rmSync(dir, { recursive: true, force: true })
})
