# 过滤非歌曲视频 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置里用开关按分区和标题隐藏非歌曲，主进程过滤列表 / 歌单 / 队列 / 分 P，关掉后原内容还在。

**Architecture:** `isSongVideo` 放在 `@bbplayer/core`。主进程读 `filterNonSongs`，在 tRPC 返回前过滤；完整播放队列仍写在 `electron-store`，`session.set` 在过滤开启且上报为子集时合并，避免把隐藏曲写丢。渲染进程只展示主进程给的数据，开关变化后重拉列表并同步会话。

**Tech Stack:** `@bbplayer/core`、Electron `electron-store`、tRPC、React 设置页 / 曲库、Vitest（`vp test`）。

## Global Constraints

- 判定：`tid` 在音乐分区白名单 **或** 去 HTML 后的标题命中关键词；有非音乐 `tid` 仍走标题兜底
- 设置键：`filterNonSongs: boolean`，默认 `false`
- 过滤只发生在读路径；`library.create` / `addTracks` / 备份导入仍写全量
- 不改 SQLite schema，不写 `tid` 进库，不给搜索加 `tids=`，不请求 `bgm_info`
- 远程收藏夹 / 合集 / 稍后再看侧栏数字仍用 B 站 `media_count` / `count`
- 当前曲被滤掉：落到过滤后列表里的下一首并播放；没有下一首则停止、清空当前播放展示（队列仍可显示其余歌曲；`index` 越界使 `current` 为空）
- 命令在仓库根目录：`vp test`、`vp check`、`pnpm type-check`
- 提交格式：`:sparkles: feat(scope): 简体中文` / `:white_check_mark: test: …`，走钩子，不 `--no-verify`

对照 spec：`docs/superpowers/specs/2026-09-04-filter-non-songs-design.md`

---

## File map

**Create:**

- `packages/core/src/song-video.ts` — `MUSIC_TIDS`、`isSongVideo`
- `packages/core/src/song-video.test.ts`
- `packages/main/src/filter-non-songs.ts` — 读开关、过滤列表 / 详情 / 会话 get·set
- `packages/main/src/filter-non-songs.test.ts`
- `packages/main/src/trpc/routers/session.test.ts`
- `packages/main/src/trpc/routers/library.test.ts`
- `packages/renderer/src/filter-session.ts` — 开关变化后如何套用 `session.get`
- `packages/renderer/src/filter-session.test.ts`

**Modify:**

- `packages/core/src/index.ts` — 导出 `song-video`
- `packages/main/src/store.ts` — `Settings.filterNonSongs`
- `packages/main/src/trpc/routers/settings.ts` — get/set
- `packages/main/src/trpc/routers/settings.test.ts`
- `packages/main/src/bili.ts` — `RemoteVideo.tid`、各列表透传 `tid`/`typeid`、`getVideoDetails` 带 `tid`、`videoTid`
- `packages/main/src/bili.test.ts` — `videoTid`
- `packages/main/src/db/types.ts` — `LibraryTrack.tid?`
- `packages/main/src/trpc/routers/bili.ts` — 过滤搜索 / 收藏 / 合集 / 稍后再看 / UP / `video.filtered`
- `packages/main/src/trpc/routers/library.ts` — get 滤曲、list 重计 `itemCount`；schema `tid` 可选
- `packages/main/src/trpc/routers/downloads.ts` — `list` 与 `updates` 过滤
- `packages/main/src/trpc/routers/session.ts` — get 映射、set 合并
- `packages/renderer/src/playback.ts` — `TrackItem.tid?`
- `packages/renderer/src/components/setting-switch.tsx` — 可选说明
- `packages/renderer/src/routes/settings.tsx` — 开关
- `packages/renderer/src/app-context.tsx` — 状态、持久化、开关后重拉
- `packages/renderer/src/usePlayback.ts` — `applySessionQueue`
- `packages/renderer/src/routes/library/favorites.$id.tsx`、`collections.$id.tsx`、`watch-later.tsx`、`playlists.$id.tsx`、`downloads.tsx`、`multipage.$bvid.tsx` — 依赖开关重拉；空态文案

---

### Task 1: core 歌曲判定

**Files:**

- Create: `packages/core/src/song-video.ts`
- Create: `packages/core/src/song-video.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces:
  - `MUSIC_TIDS: ReadonlySet<number>` — `3, 28, 31, 30, 59, 193, 29, 130, 243, 244`
  - `SongVideoHint = { tid?: number | null; title: string }`
  - `isSongVideo(input: SongVideoHint): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { isSongVideo } from './song-video.ts'

test('音乐分区算歌曲', () => {
	assert.equal(isSongVideo({ tid: 31, title: '随便' }), true)
	assert.equal(isSongVideo({ tid: 3, title: '随便' }), true)
})

test('非音乐分区但标题含翻唱或 Cover 算歌曲', () => {
	assert.equal(isSongVideo({ tid: 17, title: '【翻唱】夜に駆ける' }), true)
	assert.equal(isSongVideo({ tid: 17, title: 'Foo Cover Bar' }), true)
})

test('MV 要单词边界，不能靠子串', () => {
	assert.equal(isSongVideo({ title: '【MV】天ノ弱' }), true)
	assert.equal(isSongVideo({ title: '[MV] 歌' }), true)
	assert.equal(isSongVideo({ title: 'Official MV' }), true)
	assert.equal(isSongVideo({ title: 'mvplayer 评测' }), false)
})

test('去 HTML 后再匹配', () => {
	assert.equal(isSongVideo({ title: '<em>翻唱</em> 测试' }), true)
})

test('无 tid 且标题不中则不是歌曲', () => {
	assert.equal(isSongVideo({ title: '手机开箱' }), false)
	assert.equal(isSongVideo({ tid: 17, title: '手机开箱' }), false)
})

test('宽泛词「原创」「音乐」「歌曲」不算', () => {
	assert.equal(isSongVideo({ title: '原创动画' }), false)
	assert.equal(isSongVideo({ title: '音乐游戏实况' }), false)
	assert.equal(isSongVideo({ title: '歌曲推荐盘点但是生活区' }), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/core/src/song-video.test.ts`

Expected: FAIL，找不到 `./song-video.ts`

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/song-video.ts`：

```ts
export const MUSIC_TIDS: ReadonlySet<number> = new Set([
	3, 28, 31, 30, 59, 193, 29, 130, 243, 244,
])

export type SongVideoHint = {
	tid?: number | null
	title: string
}

const TITLE_HTML = /<[^>]+>/g

const SONG_TITLE_RE =
	/翻唱|cover|原创曲|official\s*audio|【mv】|\[mv\]|\bmv\b|歌ってみた|vocaloid|ボカロ|歌切|纯享|官方音频/i

export function isSongVideo(input: SongVideoHint): boolean {
	if (input.tid != null && MUSIC_TIDS.has(input.tid)) return true
	const title = input.title.replace(TITLE_HTML, '')
	return SONG_TITLE_RE.test(title)
}
```

`packages/core/src/index.ts` 增加：`export * from './song-video'`

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/core/src/song-video.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/song-video.ts packages/core/src/song-video.test.ts packages/core/src/index.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(core): 按分区和标题判断视频是否为歌曲

EOF
)"
```

---

### Task 2: 设置 `filterNonSongs`

**Files:**

- Modify: `packages/main/src/store.ts`
- Modify: `packages/main/src/trpc/routers/settings.ts`
- Modify: `packages/main/src/trpc/routers/settings.test.ts`

**Interfaces:**

- Consumes: 无
- Produces: `Settings.filterNonSongs: boolean`；`settings.get` 默认 `false`；`settings.set({ filterNonSongs })` 可写

- [ ] **Step 1: Write the failing test**

在 `settings.test.ts` 追加：

```ts
test('settings.get 默认 filterNonSongs 为 false', async () => {
	const caller = settingsRouter.createCaller(
		mockTrpcContext({ store: memoryStore() }),
	)
	assert.equal((await caller.get()).filterNonSongs, false)
})

test('settings.set 写入 filterNonSongs', async () => {
	const store = memoryStore()
	const caller = settingsRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({ filterNonSongs: true })
	assert.equal(store.get('filterNonSongs'), true)
	assert.equal((await caller.get()).filterNonSongs, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/settings.test.ts`

Expected: FAIL，`filterNonSongs` 为 `undefined` 或类型报错

- [ ] **Step 3: Write minimal implementation**

`store.ts` 的 `Settings` 增加 `filterNonSongs: boolean`。

`settings.ts`：

- `settingsPatchSchema` 增加 `filterNonSongs: z.boolean().optional()`
- `readSettings` 增加 `filterNonSongs: store.get('filterNonSongs') ?? false`
- `set` 里 `if (typeof patch.filterNonSongs === 'boolean') ctx.store.set('filterNonSongs', patch.filterNonSongs)`

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/trpc/routers/settings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/store.ts packages/main/src/trpc/routers/settings.ts packages/main/src/trpc/routers/settings.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 增加过滤非歌曲设置项

EOF
)"
```

---

### Task 3: 主进程过滤纯函数

**Files:**

- Create: `packages/main/src/filter-non-songs.ts`
- Create: `packages/main/src/filter-non-songs.test.ts`

**Interfaces:**

- Consumes: `isSongVideo`；`TrpcStore.get`；`PlaySession`（`packages/main/src/store.ts`）
- Produces:
  - `readFilterNonSongs(store: Pick<TrpcStore, 'get'>): boolean`
  - `filterSongItems<T extends { title: string; tid?: number | null }>(enabled: boolean, items: T[]): T[]`
  - `filterVideoPayload(enabled: boolean, input: { tid?: number | null; title: string; pages: unknown[] }): { pages: unknown[]; filtered: boolean }`
  - `filterPlaySession(enabled: boolean, session: PlaySession): PlaySession` — 队列只留歌曲；当前曲仍在则映射下标；否则落到原队列当前位置之后的第一首歌曲；没有则 `index = queue.length`（越界，`current` 为空）且 `queue` 仍为全部歌曲（全非歌曲时 `queue` 为空、`index` 为 0）
  - `mergePlaySessionSet(enabled: boolean, stored: PlaySession | undefined, incoming: PlaySession): PlaySession` — 过滤关：返回 `incoming`；过滤开且 `incoming.queue` 每个 id 都在 `stored.queue` 里：保留 `stored.queue`，把 `incoming.index` 对应曲映射回完整队列下标，其余字段用 `incoming`；否则整份采用 `incoming`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import {
	filterPlaySession,
	filterSongItems,
	filterVideoPayload,
	mergePlaySessionSet,
	readFilterNonSongs,
} from './filter-non-songs.ts'
import { memoryStore } from './trpc/mock-context.ts'
import type { PlaySession } from './store.ts'

const song = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
	tid: 31,
}
const talk = {
	id: 't',
	bvid: 'BV1t',
	cid: 1,
	title: '开箱',
	artist: 'A',
	artwork: '',
	duration: 1,
	tid: 17,
}

test('开关关闭不过滤', () => {
	assert.equal(readFilterNonSongs(memoryStore()), false)
	assert.equal(filterSongItems(false, [talk]).length, 1)
})

test('开关打开丢掉非歌曲', () => {
	assert.deepEqual(
		filterSongItems(true, [talk, song]).map((item) => item.id),
		['s'],
	)
})

test('非歌曲稿件详情 pages 清空并标记 filtered', () => {
	const result = filterVideoPayload(true, {
		tid: 17,
		title: '开箱',
		pages: [{ cid: 1 }],
	})
	assert.equal(result.filtered, true)
	assert.deepEqual(result.pages, [])
})

test('歌曲稿件不过滤 pages', () => {
	const pages = [{ cid: 1 }]
	const result = filterVideoPayload(true, {
		tid: 31,
		title: '开箱',
		pages,
	})
	assert.equal(result.filtered, false)
	assert.equal(result.pages, pages)
})

function session(queue: PlaySession['queue'], index: number): PlaySession {
	return {
		queue,
		index,
		positionMs: 10,
		repeatMode: 0,
		shuffle: false,
		playbackRate: 1,
	}
}

test('session 当前曲是歌曲时映射到过滤后下标', () => {
	const next = filterPlaySession(true, session([talk, song], 1))
	assert.deepEqual(
		next.queue.map((item) => item.id),
		['s'],
	)
	assert.equal(next.index, 0)
})

test('session 当前曲被滤掉则落到后面的歌曲', () => {
	const later = { ...song, id: 's2' }
	const next = filterPlaySession(true, session([talk, song, later], 0))
	assert.equal(next.queue[next.index]?.id, 's')
})

test('session 后面没有歌曲则 index 越界以清空当前曲', () => {
	const next = filterPlaySession(true, session([song, talk], 1))
	assert.deepEqual(
		next.queue.map((item) => item.id),
		['s'],
	)
	assert.equal(next.index, next.queue.length)
	assert.equal(next.queue[next.index], undefined)
})

test('session 全是非歌曲则空队列', () => {
	const next = filterPlaySession(true, session([talk], 0))
	assert.deepEqual(next.queue, [])
	assert.equal(next.index, 0)
})

test('set 在过滤开启且为子集时保留隐藏曲', () => {
	const stored = session([talk, song], 0)
	const incoming = session([song], 0)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['t', 's'],
	)
	assert.equal(merged.queue[merged.index]?.id, 's')
})

test('set 换了一轮队列则整份覆盖', () => {
	const stored = session([talk, song], 0)
	const other = { ...song, id: 'x', bvid: 'BVx' }
	const incoming = session([other], 0)
	const merged = mergePlaySessionSet(true, stored, incoming)
	assert.deepEqual(
		merged.queue.map((item) => item.id),
		['x'],
	)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/filter-non-songs.test.ts`

Expected: FAIL，找不到模块

- [ ] **Step 3: Write minimal implementation**

按上面的接口实现 `packages/main/src/filter-non-songs.ts`。注意：

- `readFilterNonSongs`：`store.get('filterNonSongs') ?? false`
- `filterSongItems`：`enabled` 为假原样返回，否则 `items.filter((item) => isSongVideo(item))`
- `filterVideoPayload`：`enabled && !isSongVideo({ tid, title })` 时 `{ pages: [], filtered: true }`
- `filterPlaySession`：未启用返回原 session；`visible = queue.filter(isSongVideo)`；当前曲在 `visible` 里则用其下标；否则从 `index + 1` 向后找第一首歌曲并映射到 `visible`；找不到则 `{ ...session, queue: visible, index: visible.length }`（`visible` 为空时 `index` 为 0）
- `mergePlaySessionSet`：按接口；子集判断用 id；映射 `incoming.queue[incoming.index]?.id` 到 `stored.queue`；找不到 id 时保留 `stored.index`

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/filter-non-songs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/filter-non-songs.ts packages/main/src/filter-non-songs.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 按开关过滤歌曲列表和播放会话

EOF
)"
```

---

### Task 4: session tRPC

**Files:**

- Modify: `packages/main/src/trpc/routers/session.ts`
- Create: `packages/main/src/trpc/routers/session.test.ts`
- Modify: `packages/main/src/db/types.ts` — `LibraryTrack` 增加 `tid?: number`

**Interfaces:**

- Consumes: `readFilterNonSongs`、`filterPlaySession`、`mergePlaySessionSet`；`libraryTrackSchema` 增加 `tid: z.number().optional()`
- Produces: `session.get` / `session.set` 行为与 Task 3 一致

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context.ts'

import { sessionRouter } from './session.ts'

const song = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
}
const talk = {
	id: 't',
	bvid: 'BV1t',
	cid: 1,
	title: '开箱',
	artist: 'A',
	artwork: '',
	duration: 1,
}

const body = {
	queue: [talk, song],
	index: 0,
	positionMs: 0,
	repeatMode: 0 as const,
	shuffle: false,
	playbackRate: 1,
}

test('session.get 在过滤开启时去掉非歌曲并映射 index', async () => {
	const store = memoryStore({
		filterNonSongs: true,
		session: body,
	})
	const caller = sessionRouter.createCaller(mockTrpcContext({ store }))
	const result = await caller.get()
	assert.deepEqual(
		result?.queue.map((item) => item.id),
		['s'],
	)
})

test('session.set 在过滤开启且为子集时不覆盖完整队列', async () => {
	const store = memoryStore({
		filterNonSongs: true,
		session: body,
	})
	const caller = sessionRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({
		...body,
		queue: [song],
		index: 0,
	})
	assert.deepEqual(
		store.get('session')?.queue.map((item) => item.id),
		['t', 's'],
	)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/session.test.ts`

Expected: FAIL，`get` 仍返回带非歌曲的队列

- [ ] **Step 3: Write minimal implementation**

`session.ts`：

```ts
get: publicProcedure.query(({ ctx }) => {
	const session = ctx.store.get('session')
	if (!session) return null
	return filterPlaySession(readFilterNonSongs(ctx.store), session)
}),
set: publicProcedure.input(z.union([playSessionSchema, z.null()])).mutation(({ ctx, input }) => {
	if (!input) {
		ctx.store.delete('session')
		return true
	}
	ctx.store.set(
		'session',
		mergePlaySessionSet(
			readFilterNonSongs(ctx.store),
			ctx.store.get('session'),
			input,
		),
	)
	return true
}),
```

`libraryTrackSchema` 增加 `tid: z.number().optional()`。`LibraryTrack` 同步可选 `tid`。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/trpc/routers/session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/trpc/routers/session.ts packages/main/src/trpc/routers/session.test.ts packages/main/src/db/types.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 播放会话按过滤开关读写队列

EOF
)"
```

---

### Task 5: B 站列表透传 tid 并过滤

**Files:**

- Modify: `packages/main/src/bili.ts`
- Modify: `packages/main/src/bili.test.ts`
- Modify: `packages/main/src/trpc/routers/bili.ts`

**Interfaces:**

- Consumes: `videoTid`、`filterSongItems`、`filterVideoPayload`、`readFilterNonSongs`、`isSongVideo`
- Produces:
  - `videoTid(item: { tid?: unknown; typeid?: unknown }): number | undefined` — 取有限正数
  - `RemoteVideo.tid?: number`
  - `getVideoDetails` 返回 `tid: number`
  - `bili.search` / `uploader` / `favorite` / `collection` / `watchLater` 的 `videos` 经过 `filterSongItems`
  - `bili.video` 增加 `filtered: boolean`；非歌曲且开关开则 `pages: []`
  - `bili.library` 的 `watchLater` 数字仍用接口 `itemCount`，不要改成过滤后的 `videos.length`

- [ ] **Step 1: Write the failing test**

在 `bili.test.ts` 追加：

```ts
import { videoTid } from './bili.ts'

test('videoTid 读取 tid 或 typeid', () => {
	assert.equal(videoTid({ tid: 31 }), 31)
	assert.equal(videoTid({ typeid: '28' }), 28)
	assert.equal(videoTid({}), undefined)
	assert.equal(videoTid({ tid: 0 }), undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/bili.test.ts`

Expected: FAIL，`videoTid` 未导出

- [ ] **Step 3: Write minimal implementation**

`bili.ts`：

```ts
export function videoTid(item: {
	tid?: unknown
	typeid?: unknown
}): number | undefined {
	const n = Number(item.tid ?? item.typeid)
	if (!Number.isFinite(n) || n <= 0) return undefined
	return n
}
```

`RemoteVideo` 增加 `tid?: number`。

各 mapper 写入 `tid: videoTid(item)`：

- `searchVideos`：搜索项的 `typeid`
- `getFavoriteVideos` / `getCollectionVideos` / `getWatchLater`：`tid`
- `getUploaderVideos`：`typeid`
- `getVideoDetails`：view 的 `tid`，随 data 返回

`packages/main/src/trpc/routers/bili.ts`：每个返回 `videos` 的 procedure 在 return 前：

```ts
const enabled = readFilterNonSongs(ctx.store)
return { ...result, videos: filterSongItems(enabled, result.videos) }
```

`search` 对数组同样 `filterSongItems`。

`video`：

```ts
const details = await getVideoDetails(...)
const enabled = readFilterNonSongs(ctx.store)
const gate = filterVideoPayload(enabled, {
	tid: details.tid,
	title: details.title,
	pages: details.pages,
})
const pages = (gate.pages as typeof details.pages).map((page) => ({
	...existing mapping,
	tid: details.tid,
}))
return { bvid, title, cover, owner, pages, filtered: gate.filtered }
```

`library` 里 `watchLater` 继续用 `watchLater.itemCount`（过滤前的 count）。不要对 `getWatchLater` 内部改 `itemCount`。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/bili.test.ts packages/main/src/filter-non-songs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/bili.ts packages/main/src/bili.test.ts packages/main/src/trpc/routers/bili.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 远程视频列表按开关过滤非歌曲

EOF
)"
```

---

### Task 6: 本地歌单与下载列表过滤

**Files:**

- Modify: `packages/main/src/trpc/routers/library.ts`
- Create: `packages/main/src/trpc/routers/library.test.ts`
- Modify: `packages/main/src/trpc/routers/downloads.ts`

**Interfaces:**

- Consumes: `readFilterNonSongs`、`filterSongItems`、`isSongVideo`
- Produces: `library.get` 的 `tracks` 过滤；`library.list` 的 `itemCount` 按标题重计（库中无 tid）；`create`/`addTracks` 不过滤；`downloads.list` 与 `updates` 的 `records` 过滤；`libraryTrackSchema` / `trackSchema` 增加 `tid: z.number().optional()`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { memoryStore, mockTrpcContext } from '../mock-context.ts'

import { libraryRouter } from './library.ts'

const tracks = [
	{
		id: 't',
		bvid: 'BV1t',
		cid: 1,
		title: '开箱',
		artist: 'A',
		artwork: '',
		duration: 1,
	},
	{
		id: 's',
		bvid: 'BV1s',
		cid: 1,
		title: '【翻唱】夜',
		artist: 'A',
		artwork: '',
		duration: 1,
	},
]

test('library.list 在过滤开启时按歌曲数计数', async () => {
	const caller = libraryRouter.createCaller(
		mockTrpcContext({
			store: memoryStore({ filterNonSongs: true }),
			playerDb: {
				...mockTrpcContext().playerDb,
				list: () => [
					{
						id: '1',
						title: '晚间',
						description: '',
						coverUrl: '',
						itemCount: 2,
						updatedAt: 0,
						shareId: null,
						shareRole: null,
					},
				],
				get: () => ({
					id: '1',
					title: '晚间',
					description: '',
					coverUrl: '',
					createdAt: 0,
					updatedAt: 0,
					shareId: null,
					shareRole: null,
					lastShareSyncAt: null,
					tracks,
				}),
			},
		}),
	)
	const list = await caller.list()
	assert.equal(list[0]?.itemCount, 1)
})

test('library.get 在过滤开启时去掉非歌曲', async () => {
	const caller = libraryRouter.createCaller(
		mockTrpcContext({
			store: memoryStore({ filterNonSongs: true }),
			playerDb: {
				...mockTrpcContext().playerDb,
				get: () => ({
					id: '1',
					title: '晚间',
					description: '',
					coverUrl: '',
					createdAt: 0,
					updatedAt: 0,
					shareId: null,
					shareRole: null,
					lastShareSyncAt: null,
					tracks,
				}),
			},
		}),
	)
	const playlist = await caller.get({ id: '1' })
	assert.deepEqual(
		playlist?.tracks.map((item) => item.id),
		['s'],
	)
})
```

`mockTrpcContext().playerDb` 展开时注意 TypeScript：把完整 `playerDb` 对象写在变量里再覆盖 `list`/`get`，不要依赖省略导致缺方法。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/library.test.ts`

Expected: FAIL，`itemCount` 仍为 2

- [ ] **Step 3: Write minimal implementation**

`library.ts`：

```ts
list: publicProcedure.query(({ ctx }) => {
	const list = ctx.playerDb.list()
	if (!readFilterNonSongs(ctx.store)) return list
	return list.map((item) => {
		const playlist = ctx.playerDb.get(item.id)
		const itemCount = playlist
			? playlist.tracks.filter((track) => isSongVideo(track)).length
			: 0
		return { ...item, itemCount }
	})
}),
get: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
	const playlist = ctx.playerDb.get(input.id)
	if (!playlist || !readFilterNonSongs(ctx.store)) return playlist
	return { ...playlist, tracks: filterSongItems(true, playlist.tracks) }
}),
```

`downloads.ts`：`list` 改为 `({ ctx }) => filterSongItems(readFilterNonSongs(ctx.store), downloadManager.list())`。

`updates` 用 `rxjs/map`：

```ts
fromObservable(
	ctx.events.downloads$.pipe(
		map((payload) => ({
			...payload,
			records: filterSongItems(
				readFilterNonSongs(ctx.store),
				payload.records as Array<{ title: string; tid?: number | null }>,
			),
		})),
	),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/trpc/routers/library.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/trpc/routers/library.ts packages/main/src/trpc/routers/library.test.ts packages/main/src/trpc/routers/downloads.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 本地歌单和下载列表隐藏非歌曲

EOF
)"
```

---

### Task 7: 渲染进程开关与会话套用

**Files:**

- Create: `packages/renderer/src/filter-session.ts`
- Create: `packages/renderer/src/filter-session.test.ts`
- Modify: `packages/renderer/src/playback.ts` — `TrackItem.tid?: number`
- Modify: `packages/renderer/src/components/setting-switch.tsx`
- Modify: `packages/renderer/src/routes/settings.tsx`
- Modify: `packages/renderer/src/app-context.tsx`
- Modify: `packages/renderer/src/usePlayback.ts`

**Interfaces:**

- Consumes: `session.get` 的 `{ queue, index }`；`settings.set({ filterNonSongs })`
- Produces:
  - `applyFilterSessionView(prevCurrentId: string | undefined, session: { queue: TrackItem[]; index: number }): { queue: TrackItem[]; index: number; action: 'keep' | 'play' | 'stop' }`
    - `queue.length === 0` → `stop`
    - `prevCurrentId` 仍在 `queue` → `keep`，index 为该 id
    - 否则若 `queue[index]` 存在且有 `prevCurrentId` → `play`（被滤掉，落到下一首）
    - 否则若无 `prevCurrentId` 且 `queue[index]` 存在 → `keep`（启动恢复，不自动播）
    - 否则 `stop`
  - `usePlayback().applySessionQueue(session)` 按 `action` 更新队列；`stop` 时 pause 并清 `audio.src`；`play` 时 `playTrack`
  - 设置页开关「过滤非歌曲视频」，说明「按分区和标题隐藏非歌曲，不删除已保存内容。」
  - `setFilterNonSongs`：先 mutate 设置，再 `session.get` + `applySessionQueue`，再 `refreshPlaylists`、`bumpLibrary`、`loadRemoteLibrary`、`downloads.list`；若搜索框有内容则 `submitSearch(query)`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { applyFilterSessionView } from './filter-session.ts'

const song = {
	id: 's',
	bvid: 'BV1s',
	cid: 1,
	title: '【翻唱】夜',
	artist: 'A',
	artwork: '',
	duration: 1,
}

test('当前曲还在则 keep', () => {
	const result = applyFilterSessionView('s', { queue: [song], index: 0 })
	assert.equal(result.action, 'keep')
	assert.equal(result.index, 0)
})

test('当前曲被滤掉且有下一首则 play', () => {
	const result = applyFilterSessionView('gone', { queue: [song], index: 0 })
	assert.equal(result.action, 'play')
	assert.equal(result.queue[result.index]?.id, 's')
})

test('空队列则 stop', () => {
	assert.equal(
		applyFilterSessionView('x', { queue: [], index: 0 }).action,
		'stop',
	)
})

test('越界 index 则 stop 但保留队列', () => {
	const result = applyFilterSessionView('gone', { queue: [song], index: 1 })
	assert.equal(result.action, 'stop')
	assert.equal(result.queue.length, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/filter-session.test.ts`

Expected: FAIL，找不到模块

- [ ] **Step 3: Write minimal implementation**

实现 `filter-session.ts` 如上。

`SettingSwitch` 增加可选 `description?: string`，有则渲染 `FieldDescription`。

设置页在自动缓存开关下增加：

```tsx
<SettingSwitch
	id='filter-non-songs'
	label='过滤非歌曲视频'
	description='按分区和标题隐藏非歌曲，不删除已保存内容。'
	checked={filterNonSongs}
	onCheckedChange={setFilterNonSongs}
/>
```

`app-context.tsx`：状态、`settings.get` 读取、`persist` 流程见 Interfaces。

`usePlayback.ts` 增加 `applySessionQueue`，并加入返回值。启动时的 `session.get` 改为走 `applySessionQueue`（无 `prevCurrentId`，不自动播）。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/renderer/src/filter-session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/filter-session.ts packages/renderer/src/filter-session.test.ts packages/renderer/src/playback.ts packages/renderer/src/components/setting-switch.tsx packages/renderer/src/routes/settings.tsx packages/renderer/src/app-context.tsx packages/renderer/src/usePlayback.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 设置里开关过滤非歌曲并同步播放队列

EOF
)"
```

---

### Task 8: 曲库页重拉与空态

**Files:**

- Modify: `packages/renderer/src/routes/library/favorites.$id.tsx`
- Modify: `packages/renderer/src/routes/library/collections.$id.tsx`
- Modify: `packages/renderer/src/routes/library/watch-later.tsx`
- Modify: `packages/renderer/src/routes/library/playlists.$id.tsx`
- Modify: `packages/renderer/src/routes/library/downloads.tsx`
- Modify: `packages/renderer/src/routes/library/multipage.$bvid.tsx`

**Interfaces:**

- Consumes: `useApp().filterNonSongs`、`libraryTick`（歌单页已有）；`bili.video` 的 `filtered: boolean`
- Produces: 上述页面 `useEffect` 依赖 `filterNonSongs`（及已有 id）；列表为空且 `filterNonSongs` 时 Empty 文案「已按设置隐藏非歌曲视频」；`multipage` 在 `filtered === true` 时用该空态，不自动播放

- [ ] **Step 1: Write the failing test**

此任务是 UI 接线，沿用 Task 7 的 `applyFilterSessionView` 单测，不新增路由测试。打开 `multipage.$bvid.tsx`，确认成功回调读取 `result.filtered`。

- [ ] **Step 2: 各列表页依赖开关重拉**

收藏 / 合集 / 稍后再看 / 下载：`useApp()` 取 `filterNonSongs`，放进 `useEffect` 依赖。歌单页已用 `libraryTick` 作 `key`，Task 7 的 `bumpLibrary` 会重挂；仍把 `filterNonSongs` 放进内部 `useEffect` 依赖以防万一。

- [ ] **Step 3: 空态**

加载完成后 `videos`/`tracks` 长度为 0：

```tsx
<Empty>
	<EmptyHeader>
		<EmptyTitle>没有歌曲</EmptyTitle>
		<EmptyDescription>
			{filterNonSongs ? '已按设置隐藏非歌曲视频' : '这个列表还是空的。'}
		</EmptyDescription>
	</EmptyHeader>
</Empty>
```

`multipage`：

```tsx
if (video.filtered) {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>已按设置隐藏非歌曲视频</EmptyTitle>
				<EmptyDescription>
					关闭设置中的「过滤非歌曲视频」后即可打开。
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	)
}
```

`bili.video` 的本地 state 类型加上 `filtered?: boolean`。

- [ ] **Step 4: Run verification**

Run: `vp test && vp check && pnpm type-check`

Expected: 全部通过

用 `pnpm desktop` 手动：开开关后搜索「手机评测」应变空或只剩标题像歌的；关开关恢复。本地含非歌曲的歌单条数变少，关掉后条数回来。粘贴非歌曲 BV 出现空态。

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/routes/library
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 曲库在过滤开启时重拉并给出空态

EOF
)"
```

---

## Self-review

| Spec 要求                                  | Task                                |
| ------------------------------------------ | ----------------------------------- |
| `isSongVideo` 分区或标题                   | 1                                   |
| `filterNonSongs` 默认关、可持久化          | 2                                   |
| 主进程过滤搜索 / 远程列表 / video.filtered | 5                                   |
| 下载、本地歌单 tracks、list 计数           | 6                                   |
| session get 映射、set 子集合并             | 3–4                                 |
| 设置开关文案                               | 7                                   |
| 开关后重拉 + 当前非歌曲切下一首或停        | 7                                   |
| 列表 / 直接 BV 空态                        | 8                                   |
| 不改 DB、不删数据、远程侧栏仍用 B 站 count | 5–6（library 只改本地 `itemCount`） |
