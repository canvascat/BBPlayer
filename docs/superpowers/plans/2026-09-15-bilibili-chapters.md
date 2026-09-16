# B 站视频章节拆成多首歌 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 单 P 合辑若有 B 站章节，在 `bili.video` 拆成多条曲目；同一 `cid` 上按窗口 seek 播放，每章单独匹配歌词。

**Architecture:** `view_points` 在 `bili.video` 规范化后写成带 `clipStartSec` / `clipEndSec` 的 `pages[]`。身份键含 `from`/`to`，音频缓存键只有 `bvid+cid`。渲染进程把 `<audio>` 整段文件映射成章节窗口；同 cid 切章不换 `src`。

**Tech Stack:** 现有 tRPC、`electron-store`、Vitest（`vp test`）、`@bbplayer/core` 纯函数。不改 SQLite schema、不新增设置项。

## Global Constraints

- 不改 SQLite schema、不改歌单分享协议字段、不新增设置开关
- 搜索 / 收藏夹 / 合集 / 稍后再看列表不预拉章节
- 多分 P 稿件忽略章节
- 拆章失败、AI 失败、歌词失败都不得让点播抛错
- 有窗口的曲目不读、不用整片 `bgm_info`
- 命令在仓库根目录：`vp test`、`vp check`、`pnpm type-check`
- 提交格式：`:sparkles: feat(scope): 简体中文`，走钩子，不 `--no-verify`

对照 spec：`docs/superpowers/specs/2026-09-07-bilibili-chapters-design.md`

---

## File map

**Create:**

- `packages/core/src/bilibili-id.test.ts` — 身份键 / 解析 / 音频缓存键
- `packages/core/src/video-chapters.ts` — 是否请求章节、规范化 `view_points`
- `packages/core/src/video-chapters.test.ts`
- `packages/main/src/video-chapter-tracks.ts` — 把章节变成 `LibraryTrack[]`（含 AI 丢章）
- `packages/main/src/video-chapter-tracks.test.ts`
- `packages/main/src/track-lyrics-store.ts` — `trackLyrics` 读写
- `packages/main/src/track-lyrics-store.test.ts`

**Modify:**

- `packages/core/src/bilibili-id.ts` — `generateUniqueTrackKey`、`parseBilibiliTrackKey`、`hasClipWindow`、`audioCacheKey`
- `packages/core/src/index.ts` — 导出 `video-chapters`
- `packages/renderer/src/playback.ts` — `TrackItem` clip 字段、窗口时间纯函数
- `packages/renderer/src/playback.test.ts`
- `packages/renderer/src/usePlayback.ts` — 窗口 seek、章末切歌、同 cid 不换 src
- `packages/main/src/db/types.ts` — `LibraryTrack` clip 字段
- `packages/main/src/db/database.ts` — 读回歌单时从 `unique_key` 还原 clip
- `packages/main/src/db/database.test.ts`
- `packages/main/src/trpc/context.ts` — `ResolveTrack` clip 字段
- `packages/main/src/trpc/routers/player.ts`、`session.ts`、`library.ts`、`downloads.ts` — zod 可选 clip 字段
- `packages/main/src/music-meta.ts` — 章节规则不吃稿件书名号；`alwaysAi`；返回 `drop`
- `packages/main/src/music-meta.test.ts`
- `packages/main/src/music-meta-store.ts` — 可选缓存 `kind`
- `packages/main/src/music-ai.ts` — system 注明视频章节
- `packages/main/src/bili.ts` — `getVideoViewPoints`
- `packages/main/src/trpc/routers/bili.ts` — `bili.video` 拆章
- `packages/main/src/index.ts` — `resolvePlay` 音频键 / 歌词键 / 跳过 BGM
- `packages/main/src/store.ts` — `trackLyrics`
- `packages/main/src/lyric-offset.ts` — 缺 id 时把 clip 编进键

---

### Task 1: 身份键、解析、音频缓存键

**Files:**

- Modify: `packages/core/src/bilibili-id.ts`
- Create: `packages/core/src/bilibili-id.test.ts`

**Interfaces:**

- Produces:
  - `hasClipWindow(input: { clipStartSec?: number; clipEndSec?: number }): boolean`
  - `generateUniqueTrackKey(input: { bvid: string; cid?: number; isMultiPage?: boolean; clipStartSec?: number; clipEndSec?: number }): string`
  - `parseBilibiliTrackKey(id: string): { bvid: string; cid?: number; clipStartSec?: number; clipEndSec?: number } | null`
  - `audioCacheKey(input: { bvid: string; cid?: number; isMultiPage?: boolean; clipStartSec?: number; clipEndSec?: number }): string`
  - `sameAudioStream(a: { bvid: string; cid: number }, b: { bvid: string; cid: number }): boolean`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/bilibili-id.test.ts`:

```ts
import { assert, test } from 'vitest'

import {
	audioCacheKey,
	generateUniqueTrackKey,
	hasClipWindow,
	parseBilibiliTrackKey,
	sameAudioStream,
} from './bilibili-id.ts'

test('旧单 P / 分 P 键不变', () => {
	assert.equal(generateUniqueTrackKey({ bvid: 'BV1xx' }), 'bilibili::BV1xx')
	assert.equal(
		generateUniqueTrackKey({ bvid: 'BV1xx', cid: 9, isMultiPage: true }),
		'bilibili::BV1xx::9',
	)
})

test('章节键带 round 后的 from/to，含 0', () => {
	assert.equal(
		generateUniqueTrackKey({
			bvid: 'BV1xx',
			cid: 9,
			clipStartSec: 0,
			clipEndSec: 195.4,
		}),
		'bilibili::BV1xx::9::0::195',
	)
})

test('从键还原 clip；非法键为 null', () => {
	assert.deepEqual(parseBilibiliTrackKey('bilibili::BV1xx::9::0::195'), {
		bvid: 'BV1xx',
		cid: 9,
		clipStartSec: 0,
		clipEndSec: 195,
	})
	assert.deepEqual(parseBilibiliTrackKey('bilibili::BV1xx'), { bvid: 'BV1xx' })
	assert.equal(parseBilibiliTrackKey('av123'), null)
})

test('有窗口时音频键不含 from/to', () => {
	assert.equal(
		audioCacheKey({
			bvid: 'BV1xx',
			cid: 9,
			clipStartSec: 0,
			clipEndSec: 195,
		}),
		'bilibili::BV1xx::9',
	)
	assert.equal(audioCacheKey({ bvid: 'BV1xx' }), 'bilibili::BV1xx')
	assert.equal(hasClipWindow({ clipStartSec: 0, clipEndSec: 10 }), true)
	assert.equal(hasClipWindow({ clipStartSec: 0 }), false)
	assert.equal(
		sameAudioStream({ bvid: 'a', cid: 1 }, { bvid: 'a', cid: 1 }),
		true,
	)
	assert.equal(
		sameAudioStream({ bvid: 'a', cid: 1 }, { bvid: 'a', cid: 2 }),
		false,
	)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/core/src/bilibili-id.test.ts`

Expected: FAIL（`hasClipWindow` 未导出）

- [ ] **Step 3: Write minimal implementation**

Replace `generateUniqueTrackKey` in `packages/core/src/bilibili-id.ts` and append:

```ts
export function hasClipWindow(input: {
	clipStartSec?: number
	clipEndSec?: number
}): boolean {
	return (
		Number.isFinite(input.clipStartSec) && Number.isFinite(input.clipEndSec)
	)
}

export function generateUniqueTrackKey(input: {
	bvid: string
	cid?: number
	isMultiPage?: boolean
	clipStartSec?: number
	clipEndSec?: number
}): string {
	if (hasClipWindow(input) && input.cid) {
		return `bilibili::${input.bvid}::${input.cid}::${Math.round(input.clipStartSec!)}::${Math.round(input.clipEndSec!)}`
	}
	if (input.isMultiPage && input.cid) {
		return `bilibili::${input.bvid}::${input.cid}`
	}
	return `bilibili::${input.bvid}`
}

export function parseBilibiliTrackKey(id: string): {
	bvid: string
	cid?: number
	clipStartSec?: number
	clipEndSec?: number
} | null {
	const parts = id.split('::')
	if (parts[0] !== 'bilibili' || !parts[1]) return null
	if (parts.length === 2) return { bvid: parts[1] }
	if (parts.length === 3) {
		const cid = Number(parts[2])
		if (!Number.isFinite(cid)) return null
		return { bvid: parts[1], cid }
	}
	if (parts.length === 5) {
		const cid = Number(parts[2])
		const clipStartSec = Number(parts[3])
		const clipEndSec = Number(parts[4])
		if (![cid, clipStartSec, clipEndSec].every(Number.isFinite)) return null
		return { bvid: parts[1], cid, clipStartSec, clipEndSec }
	}
	return null
}

export function audioCacheKey(input: {
	bvid: string
	cid?: number
	isMultiPage?: boolean
	clipStartSec?: number
	clipEndSec?: number
}): string {
	if (hasClipWindow(input)) {
		return generateUniqueTrackKey({
			bvid: input.bvid,
			cid: input.cid,
			isMultiPage: true,
		})
	}
	return generateUniqueTrackKey({
		bvid: input.bvid,
		cid: input.cid,
		isMultiPage: input.isMultiPage,
	})
}

export function sameAudioStream(
	a: { bvid: string; cid: number },
	b: { bvid: string; cid: number },
): boolean {
	return a.bvid === b.bvid && a.cid === b.cid
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/core/src/bilibili-id.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/bilibili-id.ts packages/core/src/bilibili-id.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(core): 章节曲目用 from/to 写入身份键

EOF
)"
```

---

### Task 2: 规范化 view_points

**Files:**

- Create: `packages/core/src/video-chapters.ts`
- Create: `packages/core/src/video-chapters.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `isSongVideo`（`./song-video.ts`）
- Produces:
  - `export type NormalizedChapter = { content: string; from: number; to: number }`
  - `shouldFetchViewPoints(input: { pageCount: number; tid?: number | null; title: string; musicAiApiKey?: string }): boolean`
  - `normalizeViewPoints(points: unknown, durationSec: number): NormalizedChapter[]`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/video-chapters.test.ts`:

```ts
import { assert, test } from 'vitest'

import { normalizeViewPoints, shouldFetchViewPoints } from './video-chapters.ts'

test('多 P 或不像歌且无 AI 时不请求', () => {
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 2,
			tid: 31,
			title: '专辑',
			musicAiApiKey: 'sk',
		}),
		false,
	)
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 1,
			tid: 17,
			title: '手机开箱',
			musicAiApiKey: '',
		}),
		false,
	)
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 1,
			tid: 31,
			title: '专辑',
			musicAiApiKey: '',
		}),
		true,
	)
	assert.equal(
		shouldFetchViewPoints({
			pageCount: 1,
			tid: 17,
			title: '手机开箱',
			musicAiApiKey: 'sk',
		}),
		true,
	)
})

test('按 from 排序、补 to、丢掉非法章；不足 2 章得到空数组', () => {
	assert.deepEqual(
		normalizeViewPoints(
			[
				{ content: '说了再见', from: 195, to: 477 },
				{ content: '跨时代', from: 0 },
				{ content: '  ', from: 10, to: 20 },
				{ content: '坏', from: 90, to: 80 },
			],
			2726,
		),
		[
			{ content: '跨时代', from: 0, to: 195 },
			{ content: '说了再见', from: 195, to: 477 },
		],
	)
	assert.deepEqual(
		normalizeViewPoints([{ content: '仅一章', from: 0, to: 10 }], 10),
		[],
	)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/core/src/video-chapters.test.ts`

Expected: FAIL（模块不存在）

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/video-chapters.ts`:

```ts
import { isSongVideo } from './song-video.ts'

export type NormalizedChapter = {
	content: string
	from: number
	to: number
}

export function shouldFetchViewPoints(input: {
	pageCount: number
	tid?: number | null
	title: string
	musicAiApiKey?: string
}): boolean {
	if (input.pageCount !== 1) return false
	if (isSongVideo({ tid: input.tid, title: input.title })) return true
	return Boolean(input.musicAiApiKey?.trim())
}

export function normalizeViewPoints(
	points: unknown,
	durationSec: number,
): NormalizedChapter[] {
	if (
		!Array.isArray(points) ||
		!Number.isFinite(durationSec) ||
		durationSec <= 0
	) {
		return []
	}
	const raw = points
		.map((item) => {
			if (!item || typeof item !== 'object') return null
			const row = item as { content?: unknown; from?: unknown; to?: unknown }
			const content = typeof row.content === 'string' ? row.content.trim() : ''
			const from = Number(row.from)
			const to = row.to == null || row.to === '' ? undefined : Number(row.to)
			if (!content || !Number.isFinite(from) || from < 0) return null
			return { content, from, to }
		})
		.filter(
			(item): item is { content: string; from: number; to?: number } => !!item,
		)
		.sort((a, b) => a.from - b.from)

	const filled: NormalizedChapter[] = []
	for (let i = 0; i < raw.length; i++) {
		const current = raw[i]!
		const to = Number.isFinite(current.to)
			? current.to!
			: (raw[i + 1]?.from ?? durationSec)
		if (current.from >= to) continue
		filled.push({ content: current.content, from: current.from, to })
	}
	return filled.length >= 2 ? filled : []
}
```

Add to `packages/core/src/index.ts`:

```ts
export * from './video-chapters'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/core/src/video-chapters.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/video-chapters.ts packages/core/src/video-chapters.test.ts packages/core/src/index.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(core): 规范化 B 站 view_points 并决定是否拆章

EOF
)"
```

---

### Task 3: 播放窗口纯函数

**Files:**

- Modify: `packages/renderer/src/playback.ts`
- Modify: `packages/renderer/src/playback.test.ts`

**Interfaces:**

- Consumes: `hasClipWindow` from `@bbplayer/core`
- Produces:
  - `TrackItem` 增加可选 `clipStartSec?: number`、`clipEndSec?: number`、`videoTitle?: string`、`sourceDuration?: number`
  - `clipStartSecOf(track: { clipStartSec?: number; clipEndSec?: number }): number`
  - `uiTimeMs(audioTimeSec: number, track: { clipStartSec?: number; clipEndSec?: number }): number`
  - `uiDurationMs(track: { clipStartSec?: number; clipEndSec?: number; duration?: number }, audioDurationSec?: number): number`
  - `audioTimeSec(uiTimeMs: number, track: { clipStartSec?: number; clipEndSec?: number }): number`
  - `clipEnded(audioTimeSec: number, track: { clipStartSec?: number; clipEndSec?: number }): boolean`

- [ ] **Step 1: Write the failing test**

Append to `packages/renderer/src/playback.test.ts`:

```ts
import {
	audioTimeSec,
	clipEnded,
	clipStartSecOf,
	uiDurationMs,
	uiTimeMs,
} from './playback.ts'

const clip = { clipStartSec: 195, clipEndSec: 477, duration: 282 }

test('窗口时间从 clipStart 起算，seek 加回起点并夹紧', () => {
	assert.equal(clipStartSecOf(clip), 195)
	assert.equal(uiTimeMs(195, clip), 0)
	assert.equal(uiTimeMs(200.5, clip), 5500)
	assert.equal(audioTimeSec(0, clip), 195)
	assert.equal(audioTimeSec(10_000, clip), 205)
	assert.equal(audioTimeSec(-1, clip), 195)
	assert.equal(audioTimeSec(999_000, clip), 477)
	assert.equal(uiDurationMs(clip), 282_000)
	assert.equal(clipEnded(477, clip), true)
	assert.equal(clipEnded(476.9, clip), false)
})

test('无窗口时音频时间原样进出', () => {
	assert.equal(uiTimeMs(12, {}), 12_000)
	assert.equal(audioTimeSec(12_000, {}), 12)
	assert.equal(clipEnded(12, {}), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/playback.test.ts`

Expected: FAIL（导出不存在）

- [ ] **Step 3: Write minimal implementation**

In `packages/renderer/src/playback.ts`，给 `TrackItem` 加上：

```ts
	clipStartSec?: number
	clipEndSec?: number
	videoTitle?: string
	sourceDuration?: number
```

并增加（文件顶部已有其它导出；从 `@bbplayer/core` 引入 `hasClipWindow`）：

```ts
import { hasClipWindow } from '@bbplayer/core'

export function clipStartSecOf(track: {
	clipStartSec?: number
	clipEndSec?: number
}): number {
	return hasClipWindow(track) ? track.clipStartSec! : 0
}

export function uiTimeMs(
	audioTimeSec: number,
	track: { clipStartSec?: number; clipEndSec?: number },
): number {
	const start = clipStartSecOf(track)
	const end = hasClipWindow(track)
		? track.clipEndSec!
		: Number.POSITIVE_INFINITY
	const clamped = Math.min(end, Math.max(start, audioTimeSec))
	return Math.round((clamped - start) * 1000)
}

export function uiDurationMs(
	track: {
		clipStartSec?: number
		clipEndSec?: number
		duration?: number
	},
	audioDurationSec?: number,
): number {
	if (hasClipWindow(track)) {
		return Math.round((track.clipEndSec! - track.clipStartSec!) * 1000)
	}
	if (Number.isFinite(audioDurationSec) && (audioDurationSec ?? 0) > 0) {
		return Math.round((audioDurationSec as number) * 1000)
	}
	return (track.duration ?? 0) * 1000
}

export function audioTimeSec(
	uiTimeMs: number,
	track: { clipStartSec?: number; clipEndSec?: number },
): number {
	const start = clipStartSecOf(track)
	const raw = start + Math.max(0, uiTimeMs) / 1000
	if (!hasClipWindow(track)) return raw
	return Math.min(track.clipEndSec!, Math.max(start, raw))
}

export function clipEnded(
	audioTimeSec: number,
	track: { clipStartSec?: number; clipEndSec?: number },
): boolean {
	return hasClipWindow(track) && audioTimeSec >= track.clipEndSec!
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/renderer/src/playback.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/playback.ts packages/renderer/src/playback.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 章节播放窗口与界面时间互转

EOF
)"
```

---

### Task 4: 曲目类型与 Zod 可选 clip 字段

**Files:**

- Modify: `packages/main/src/db/types.ts`
- Modify: `packages/main/src/trpc/context.ts`
- Modify: `packages/main/src/trpc/routers/player.ts`
- Modify: `packages/main/src/trpc/routers/session.ts`
- Modify: `packages/main/src/trpc/routers/library.ts`
- Modify: `packages/main/src/trpc/routers/downloads.ts`
- Modify: `packages/main/src/trpc/routers/session.test.ts`（加一条：带 clip 的 session 能写入）

**Interfaces:**

- Consumes: Task 3 的 `TrackItem` 字段名（保持一致）
- Produces: `LibraryTrack` / `ResolveTrack` / 各 router zod 同样的可选字段：`clipStartSec`、`clipEndSec`、`videoTitle`、`sourceDuration`

在四个 router 的曲目 `z.object` 上追加：

```ts
	clipStartSec: z.number().optional(),
	clipEndSec: z.number().optional(),
	videoTitle: z.string().optional(),
	sourceDuration: z.number().optional(),
```

`ResolveTrack` 与 `LibraryTrack` 加相同可选字段。

- [ ] **Step 1: Write the failing test**

Append to `packages/main/src/trpc/routers/session.test.ts`：

```ts
test('session.set 接受章节 clip 字段', async () => {
	const store = memoryStore()
	const caller = sessionRouter.createCaller(mockTrpcContext({ store }))
	const chapter = {
		id: 'bilibili::BV1s::1::0::195',
		bvid: 'BV1s',
		cid: 1,
		title: '跨时代',
		artist: 'A',
		artwork: '',
		duration: 195,
		clipStartSec: 0,
		clipEndSec: 195,
		videoTitle: '专辑',
		sourceDuration: 2726,
	}
	await caller.set({
		queue: [chapter],
		index: 0,
		positionMs: 1000,
		repeatMode: 0,
		shuffle: false,
		playbackRate: 1,
	})
	assert.equal(store.get('session')?.queue[0]?.clipEndSec, 195)
	assert.equal(store.get('session')?.queue[0]?.videoTitle, '专辑')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/session.test.ts`

Expected: FAIL（zod 剥掉未知字段，`clipEndSec` 为 undefined）

- [ ] **Step 3: Write minimal implementation**

按上面字段改 `LibraryTrack`、`ResolveTrack`、四个 router 的曲目 schema。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/trpc/routers/session.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/db/types.ts packages/main/src/trpc/context.ts packages/main/src/trpc/routers/player.ts packages/main/src/trpc/routers/session.ts packages/main/src/trpc/routers/library.ts packages/main/src/trpc/routers/downloads.ts packages/main/src/trpc/routers/session.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 曲目协议加上章节时间窗口字段

EOF
)"
```

---

### Task 5: 章节歌名规则、alwaysAi、丢掉 not_music

**Files:**

- Modify: `packages/main/src/music-meta.ts`
- Modify: `packages/main/src/music-meta.test.ts`
- Modify: `packages/main/src/music-meta-store.ts` — `MusicMetaEntry.kind?`
- Modify: `packages/main/src/music-ai.ts` — 仅改 `SYSTEM_PROMPT` 字符串

**Interfaces:**

- Consumes: `cleanKeyword` from `./lyric-match.ts`；`MusicAiTrack`
- Produces:
  - `ruleGuess(input: { part: string; videoTitle: string; desc: string; partIsChapter?: boolean })`
  - `fillMusicFields` 增加 `alwaysAi?: boolean`，返回项增加 `drop?: boolean`
  - `shouldDropChapter(ai: MusicAiTrack | undefined): boolean`

- [ ] **Step 1: Write the failing test**

Append to `packages/main/src/music-meta.test.ts`：

```ts
test('章节规则不用稿件书名号，章名经 cleanKeyword', () => {
	const guessed = ruleGuess({
		part: '说了再见',
		videoTitle: '周杰伦专辑《跨时代》音频修复',
		desc: '',
		partIsChapter: true,
	})
	assert.equal(guessed.title, '说了再见')
})

test('alwaysAi 时 high+not_music 标记 drop', async () => {
	const store = memoryStore({ musicAiApiKey: 'sk' })
	const result = await fillMusicFields(
		{
			bvid: 'BV1',
			title: '周杰伦专辑《跨时代》',
			pages: [
				{ id: 'a', part: '片头' },
				{ id: 'b', part: '说了再见' },
				{ id: 'c', part: '烟花易冷' },
			],
			ownerName: 'UP',
			isMultiPage: true,
			alwaysAi: true,
			partIsChapter: true,
		},
		{
			store,
			complete: async () => [
				{
					index: 1,
					title: null,
					artist: null,
					confidence: 'high',
					kind: 'not_music',
				},
				{
					index: 2,
					title: '说了再见',
					artist: '周杰伦',
					confidence: 'high',
					kind: 'original',
				},
				{
					index: 3,
					title: '烟花易冷',
					artist: '周杰伦',
					confidence: 'high',
					kind: 'original',
				},
			],
		},
	)
	assert.equal(result[0]?.drop, true)
	assert.equal(result[1]?.drop, false)
	assert.equal(result[1]?.musicTitle, '说了再见')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/music-meta.test.ts`

Expected: FAIL（章节仍抽出《跨时代》）

- [ ] **Step 3: Write minimal implementation**

1. `shouldDropChapter`：`ai?.confidence === 'high' && ai.kind === 'not_music'`
2. `ruleGuess`：若 `partIsChapter`，`title = extractBracketTitle(part) ?? cleanKeyword(part)`，**不要** `extractBracketTitle(videoTitle)`；简介歌手仍可用
3. `fillMusicFields` input 增加 `alwaysAi?`、`partIsChapter?`；`needsAi || alwaysAi` 时才在有 Key 时调模型；每页返回 `{ ..., drop: shouldDropChapter(ai) }`；`partIsChapter` 传给 `ruleGuess`
4. 早退缓存：`alwaysAi` 为真时，仅当每条缓存都带 `kind` 才跳过模型，并把 `drop` 从缓存 `kind` 算出
5. `writeMusicMeta` 写入 `kind`（有 AI 结果时）
6. `SYSTEM_PROMPT` 改为：`从 B 站投稿信息抽取歌曲名和歌手；pages 可能是视频章节；禁止编造；UP 名不等于歌手，除非标题或简介明确写了原唱/演唱者。口播/片头/花絮用 kind=not_music。只输出 JSON。`

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/music-meta.test.ts`

Expected: PASS（含原有用例）

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/music-meta.ts packages/main/src/music-meta.test.ts packages/main/src/music-meta-store.ts packages/main/src/music-ai.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 章节歌名不用专辑书名号并丢掉 not_music

EOF
)"
```

---

### Task 6: 章节展开成曲目列表

**Files:**

- Create: `packages/main/src/video-chapter-tracks.ts`
- Create: `packages/main/src/video-chapter-tracks.test.ts`

**Interfaces:**

- Consumes: `normalizeViewPoints`、`generateUniqueTrackKey`、`fillMusicFields`
- Produces:
  - `expandChapterTracks(input, deps): Promise<LibraryTrack[] | null>`
  - `null` 表示不拆，调用方保留原来的单 P

`input`：

```ts
{
	bvid: string
	cid: number
	videoTitle: string
	videoDuration: number
	tid?: number
	artist: string
	artwork: string
	desc?: string
	ownerName: string
	points: unknown
}
```

`deps`: `{ store, complete?: typeof completeMusicAi }`

逻辑：

1. `chapters = normalizeViewPoints(points, videoDuration)`；空则 `null`
2. 每章生成 `LibraryTrack`：`id = generateUniqueTrackKey({ bvid, cid, clipStartSec: from, clipEndSec: to })`，`title = content`，`duration = to - from`，`clipStartSec/clipEndSec`，`videoTitle`，`sourceDuration = videoDuration`，`tid/artist/artwork/bvid/cid`
3. `fillMusicFields({ ..., pages: chapters 的 { id, part: title }, isMultiPage: true, alwaysAi: true, partIsChapter: true })`
4. 丢掉 `drop === true` 的章；剩余 `< 2` 则 `null`
5. 把 `musicTitle` / `musicArtist` 叠回去

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { memoryStore } from './trpc/mock-context.ts'
import { expandChapterTracks } from './video-chapter-tracks.ts'

const base = {
	bvid: 'BV1xx',
	cid: 9,
	videoTitle: '周杰伦专辑《跨时代》',
	videoDuration: 2726,
	tid: 31,
	artist: 'UP',
	artwork: 'https://example.com/a.jpg',
	ownerName: 'UP',
	points: [
		{ content: '片头', from: 0, to: 10 },
		{ content: '跨时代', from: 10, to: 195 },
		{ content: '说了再见', from: 195, to: 477 },
	],
}

test('无 AI 时全拆，章名当 title，id 含 from/to', async () => {
	const tracks = await expandChapterTracks(base, { store: memoryStore() })
	assert.equal(tracks?.length, 3)
	assert.equal(tracks?.[0]?.id, 'bilibili::BV1xx::9::0::10')
	assert.equal(tracks?.[1]?.title, '跨时代')
	assert.equal(tracks?.[1]?.duration, 185)
	assert.equal(tracks?.[1]?.videoTitle, base.videoTitle)
})

test('AI 丢掉片头后仍 ≥2 章则拆剩余', async () => {
	const tracks = await expandChapterTracks(base, {
		store: memoryStore({ musicAiApiKey: 'sk' }),
		complete: async () => [
			{
				index: 1,
				title: null,
				artist: null,
				confidence: 'high',
				kind: 'not_music',
			},
			{
				index: 2,
				title: '跨时代',
				artist: '周杰伦',
				confidence: 'high',
				kind: 'original',
			},
			{
				index: 3,
				title: '说了再见',
				artist: '周杰伦',
				confidence: 'high',
				kind: 'original',
			},
		],
	})
	assert.equal(tracks?.length, 2)
	assert.equal(tracks?.[0]?.title, '跨时代')
	assert.equal(tracks?.[0]?.musicTitle, '跨时代')
})

test('丢掉后不足 2 章则不拆', async () => {
	const tracks = await expandChapterTracks(base, {
		store: memoryStore({ musicAiApiKey: 'sk' }),
		complete: async () => [
			{
				index: 1,
				title: null,
				artist: null,
				confidence: 'high',
				kind: 'not_music',
			},
			{
				index: 2,
				title: null,
				artist: null,
				confidence: 'high',
				kind: 'not_music',
			},
			{
				index: 3,
				title: '说了再见',
				artist: '周杰伦',
				confidence: 'high',
				kind: 'original',
			},
		],
	})
	assert.equal(tracks, null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/video-chapter-tracks.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

按上面逻辑实现 `expandChapterTracks`。AI `complete` 失败时 `fillMusicFields` 已会静默，此时不 drop，三章全留。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/video-chapter-tracks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/video-chapter-tracks.ts packages/main/src/video-chapter-tracks.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 把规范化章节展开成可播曲目

EOF
)"
```

---

### Task 7: bili.video 读取 view_points 并拆章

**Files:**

- Modify: `packages/main/src/bili.ts` — 新增 `getVideoViewPoints`
- Modify: `packages/main/src/trpc/routers/bili.ts`

**Interfaces:**

- Consumes: `shouldFetchViewPoints`、`expandChapterTracks`、`getVideoViewPoints(bvid, cid, cookie): Promise<unknown>`
- Produces: `bili.video` 在单 P 且应当请求时拆章；失败则原 `pages`

`getVideoViewPoints`：WBI 请求 `/x/player/wbi/v2`，返回 `data.view_points`（不是数组则 `[]`）。`catch` 后返回 `[]`，打 `getLogger('bili').warn`。不要 throw。

`bili.video` 在现有 `filterVideoPayload` 之后、构造单 P `pages` 之后：

```ts
let pages = /* 现有 map */
if (shouldFetchViewPoints({
	pageCount: details.pages.length,
	tid: details.tid,
	title: details.title,
	musicAiApiKey: ctx.store.get('musicAiApiKey'),
})) {
	const points = await getVideoViewPoints(input.bvid, pages[0]!.cid, cookieFrom(ctx.store))
	const expanded = await expandChapterTracks({
		bvid: input.bvid,
		cid: pages[0]!.cid,
		videoTitle: details.title,
		videoDuration: details.duration,
		tid: details.tid,
		artist: details.owner.name,
		artwork: cover,
		desc: details.desc,
		ownerName: details.owner.name,
		points,
	}, { store: ctx.store })
	if (expanded) pages = expanded
}
```

若未展开，再走现有 `fillMusicFields`（不要对已展开的章节再跑一遍无 `partIsChapter` 的填充）。结构：

```
if (expanded) {
  return { ..., pages: expanded }
}
// 现有 fillMusicFields + withMusic
```

- [ ] **Step 1: Write the failing test**

本任务在 `packages/main/src/bili.ts` 增加可测的 `readViewPoints(data: unknown): unknown`：

```ts
export function readViewPoints(data: unknown): unknown {
	if (!data || typeof data !== 'object') return []
	const points = (data as { view_points?: unknown }).view_points
	return Array.isArray(points) ? points : []
}
```

追加到已有的 `packages/main/src/bili.test.ts`，并增加 `readViewPoints` 的 import：

```ts
import { readViewPoints, videoTid } from './bili.ts'

test('readViewPoints 缺字段得空数组', () => {
	assert.deepEqual(readViewPoints(undefined), [])
	assert.deepEqual(
		readViewPoints({ view_points: [{ content: 'a', from: 0, to: 1 }] }).length,
		1,
	)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/bili.test.ts`

Expected: FAIL（`readViewPoints` 未从 `./bili.ts` 导出）

- [ ] **Step 3: Write minimal implementation**

实现 `readViewPoints`、`getVideoViewPoints`（内部 `readViewPoints(json.data)`），并改 `bili.video` 如上。

- [ ] **Step 4: Run tests**

Run: `vp test packages/main/src/bili.test.ts packages/main/src/video-chapter-tracks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/bili.ts packages/main/src/bili.test.ts packages/main/src/trpc/routers/bili.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 打开稿件时按 B 站章节拆成多首

EOF
)"
```

---

### Task 8: 歌词按章缓存，音频按 cid 缓存，有窗口不用 BGM

**Files:**

- Create: `packages/main/src/track-lyrics-store.ts`
- Create: `packages/main/src/track-lyrics-store.test.ts`
- Modify: `packages/main/src/store.ts` — `trackLyrics?: Record<string, LyricPayload>`
- Modify: `packages/main/src/index.ts` — `resolvePlay`
- Modify: `packages/main/src/lyric-offset.ts` — `trackIdForOffset` 传入 clip
- Modify: `packages/main/src/trpc/routers/downloads.ts` — `start` 用 `audioCacheKey`

**Interfaces:**

- Consumes: `hasClipWindow`、`audioCacheKey`、`lyricSearchInput`、`trackIdForOffset`
- Produces:
  - `readTrackLyrics(store, id)` / `writeTrackLyrics(store, id, payload)`
  - `resolvePlay`：音频命中/入队用 `audioCacheKey`；歌词读写用曲目 `id`；`hasClipWindow(track)` 时不调用 `getPreciseMusicNameOnBilibiliVideo`

歌词 payload 类型与 `CachedTrack['lyrics']` 相同（可再加 `source`）。`LyricPayload` 已有 `source`。store 用：

```ts
trackLyrics?: Record<string, { lrc: string; tlyric?: string; romalrc?: string; source?: string }>
```

`resolvePlay` 伪代码：

```ts
const id = trackIdForOffset(track)
const fileId = audioCacheKey({
	bvid: track.bvid,
	cid: track.cid,
	isMultiPage: true,
	clipStartSec: track.clipStartSec,
	clipEndSec: track.clipEndSec,
})
const cachedFile = downloadManager.isComplete(fileId)
	? downloadManager.list().find((item) => item.id === fileId)
	: undefined
// playUrl from cachedFile or getAudioStream；enqueue 时 id=fileId，title=track.videoTitle ?? track.title，duration=track.sourceDuration ?? track.duration

const storedLyrics = readTrackLyrics(store, id) ?? (id === fileId ? cachedFile?.lyrics : undefined)
if (storedLyrics?.lrc) { /* 现有解析 */ }
else {
	const preciseKeyword = hasClipWindow(track)
		? undefined
		: await getPreciseMusicNameOnBilibiliVideo(...)
	// lyricSearchInput + fetchMatchedLyrics({ durationSec: track.duration })
	writeTrackLyrics(store, id, raw)
	if (id === fileId) downloadManager.saveLyrics(fileId, raw)
}
```

文件键：

```ts
const fileId = hasClipWindow(track)
	? audioCacheKey({
			bvid: track.bvid,
			cid: track.cid,
			clipStartSec: track.clipStartSec,
			clipEndSec: track.clipEndSec,
		})
	: trackIdForOffset(track)
```

无窗口仍用现在的 `trackIdForOffset` 当文件键，旧下载能命中。有窗口才用 `audioCacheKey`（`bilibili::{bvid}::{cid}`）。歌词键始终是 `trackIdForOffset(track)`（章节为 `track.id`）。

`downloads.start`：若 `hasClipWindow(input)`，enqueue 的 `track.id = audioCacheKey(input)`，`title = input.videoTitle ?? input.title`，`duration = input.sourceDuration ?? input.duration`。

- [ ] **Step 1: Write the failing test**

`packages/main/src/track-lyrics-store.test.ts`：

```ts
import { assert, test } from 'vitest'

import { readTrackLyrics, writeTrackLyrics } from './track-lyrics-store.ts'
import { memoryStore } from './trpc/mock-context.ts'

test('按曲目 id 读写歌词，互不覆盖', () => {
	const store = memoryStore()
	writeTrackLyrics(store, 'bilibili::BV::1::0::10', {
		lrc: 'a',
		source: 'netease',
	})
	writeTrackLyrics(store, 'bilibili::BV::1::10::20', {
		lrc: 'b',
		source: 'netease',
	})
	assert.equal(readTrackLyrics(store, 'bilibili::BV::1::0::10')?.lrc, 'a')
	assert.equal(readTrackLyrics(store, 'bilibili::BV::1::10::20')?.lrc, 'b')
})
```

再在 `packages/main/src/music-meta.test.ts` 已有 `lyricSearchInput` 用例旁加（或本任务新文件 `packages/main/src/index.resolve-lyrics.test.ts` 若抽函数困难则只测 store + `lyricSearchInput` 有窗口时调用方不传 bgm——把「是否请求 BGM」抽成）：

```ts
export function preciseKeywordForTrack(
	track: { clipStartSec?: number; clipEndSec?: number },
	bgmTitle?: string | null,
): string | undefined {
	if (hasClipWindow(track)) return undefined
	return preciseMusicNameFromBgm(bgmTitle)
}
```

放在 `lyric-match.ts`，测试：

```ts
test('有窗口时忽略 BGM', () => {
	assert.equal(
		preciseKeywordForTrack({ clipStartSec: 0, clipEndSec: 10 }, '《跨时代》'),
		undefined,
	)
	assert.equal(preciseKeywordForTrack({}, '《跨时代》'), '跨时代')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/track-lyrics-store.test.ts packages/main/src/lyric-match.test.ts`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

实现 store、`preciseKeywordForTrack`、改 `resolvePlay` 与 `downloads.start`、`store.ts` 类型。`trackIdForOffset` 在缺 `id` 时把 clip 传给 `generateUniqueTrackKey`。

- [ ] **Step 4: Run tests**

Run: `vp test packages/main/src/track-lyrics-store.test.ts packages/main/src/lyric-match.test.ts packages/main/src/lyric-offset.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/track-lyrics-store.ts packages/main/src/track-lyrics-store.test.ts packages/main/src/store.ts packages/main/src/index.ts packages/main/src/lyric-offset.ts packages/main/src/lyric-match.ts packages/main/src/lyric-match.test.ts packages/main/src/trpc/routers/downloads.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 合辑音频按 cid 缓存、歌词按章缓存

EOF
)"
```

---

### Task 9: SQLite 读回歌单时还原 clip

**Files:**

- Modify: `packages/main/src/db/database.ts` — `playlistById`（以及其它把 `unique_key` 映成 `LibraryTrack` 的地方）
- Modify: `packages/main/src/db/database.test.ts`

**Interfaces:**

- Consumes: `parseBilibiliTrackKey`
- Produces: 读出的 `LibraryTrack` 若键是 5 段，带上 `clipStartSec` / `clipEndSec`

抽取：

```ts
function trackFromRow(item: { unique_key: string; title: string; ...}): LibraryTrack {
	const clip = parseBilibiliTrackKey(item.unique_key)
	return {
		id: item.unique_key,
		bvid: item.bvid as string,
		cid: Number(item.cid ?? 0),
		title: item.title,
		artist: item.artist ?? '',
		artwork: item.cover_url ?? '',
		duration: Number(item.duration ?? 0),
		...(clip && clip.clipStartSec != null && clip.clipEndSec != null
			? { clipStartSec: clip.clipStartSec, clipEndSec: clip.clipEndSec }
			: {}),
	}
}
```

所有 `unique_key` → `LibraryTrack` 的 map 都走它（`playlistById`、share pull 读出路径如有重复）。

- [ ] **Step 1: Write the failing test**

Append to `packages/main/src/db/database.test.ts`：

```ts
test('章节 unique_key 读回后带 clip 窗口', () => {
	const db = PlayerDatabase.open(':memory:')
	const created = db.create({ title: '专辑' })
	db.addTracks(created.id, [
		{
			id: 'bilibili::BV1xx::9::0::195',
			bvid: 'BV1xx',
			cid: 9,
			title: '跨时代',
			artist: 'UP',
			artwork: '',
			duration: 195,
			clipStartSec: 0,
			clipEndSec: 195,
		},
	])
	const loaded = db.get(created.id)
	assert.equal(loaded?.tracks[0]?.clipStartSec, 0)
	assert.equal(loaded?.tracks[0]?.clipEndSec, 195)
	assert.equal(loaded?.tracks[0]?.duration, 195)
	db.close()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/db/database.test.ts`

Expected: FAIL（`clipStartSec` undefined）

- [ ] **Step 3: Write minimal implementation**

按 `parseBilibiliTrackKey` 还原。`findOrCreateTrack` 已用 `track.id` 当 `unique_key`，不用改 schema。`is_multi_page` 仍按 `cid ? 1 : 0`。不还原 `videoTitle` / `sourceDuration`（表无这些列）；从歌单再下载时标题可回退章名，文件 id 仍是 `audioCacheKey`。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/db/database.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/db/database.ts packages/main/src/db/database.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 从 unique_key 还原章节播放窗口

EOF
)"
```

---

### Task 10: 渲染进程按窗口播放、同 cid 不换 src

**Files:**

- Modify: `packages/renderer/src/usePlayback.ts`

**Interfaces:**

- Consumes: `hasClipWindow`、`sameAudioStream`（`@bbplayer/core`）；`audioTimeSec`、`uiTimeMs`、`uiDurationMs`、`clipEnded`、`clipStartSecOf`（`./playback.ts`）
- Produces: 对外 `currentTime` / `duration` 为窗口毫秒；`seek` / `seekBy` / 点歌词走 `audioTimeSec`；章末切歌或单曲循环；同 `bvid+cid` 不赋值 `audio.src`

要点（不要整文件重写，只改这些行为）：

1. `playTrack` 在 `setQueue` **之前**记下 `previous = queueRef.current[indexRef.current]`。
2. `keepSrc = Boolean(audio.src) && previous && sameAudioStream(previous, track)`。
3. 始终 `await trpcClient.player.resolve.mutate(track)`。
4. 若 `!keepSrc`：`audio.src = resolved.playUrl`（现有逻辑）。若 `keepSrc`：**不要**改 `audio.src`。
5. 定位：`const applySeek = () => { audio.currentTime = audioTimeSec(seekMs, track) }`。`keepSrc` 或已有 metadata 时立刻 `applySeek`；否则 `loadedmetadata` 后再 `applySeek`。有窗口时即使 `seekMs === 0` 也要 seek 到 `clipStart`（现有 `if (seekMs > 0)` 必须改掉）。
6. `timeupdate`：若 `clipEnded(audio.currentTime, current)`：用 `clipAdvanceRef` 防止连发；单曲循环则 `audio.currentTime = clipStartSecOf(current)`；否则 `skipRef.current(1)`。无窗口才靠 `ended`。有窗口时 `ended` 直接 return。
7. `setCurrentTime(uiTimeMs(audio.currentTime, current))`；`setDuration(uiDurationMs(current, audio.duration))`。`current` 从 `queueRef` 读。
8. `seek(value)`：`audio.currentTime = audioTimeSec(value, queueRef.current[indexRef.current] ?? {})`，并 `setCurrentTime(value)`。
9. `seekBy`：先算窗口 `uiTimeMs`，再 `audioTimeSec(ui + delta, track)`。
10. `seekLyricLine` 仍 `lyricSeekMs` 得到窗口内目标，再交给 `seek`。

- [ ] **Step 1: Write the failing test**

窗口数学已在 Task 3。本任务在 `playback.ts` 增加 `shouldKeepAudioSrc`（Task 3 不要提前写它）：

```ts
export function shouldKeepAudioSrc(
	previous: { bvid: string; cid: number } | undefined,
	next: { bvid: string; cid: number },
	hasSrc: boolean,
): boolean {
	return Boolean(
		hasSrc &&
		previous &&
		previous.bvid === next.bvid &&
		previous.cid === next.cid,
	)
}
```

测试：

```ts
test('同 cid 且已有 src 时保留', () => {
	assert.equal(
		shouldKeepAudioSrc({ bvid: 'BV1', cid: 1 }, { bvid: 'BV1', cid: 1 }, true),
		true,
	)
	assert.equal(
		shouldKeepAudioSrc({ bvid: 'BV1', cid: 1 }, { bvid: 'BV1', cid: 2 }, true),
		false,
	)
	assert.equal(
		shouldKeepAudioSrc(undefined, { bvid: 'BV1', cid: 1 }, true),
		false,
	)
})
```

`usePlayback` 必须调用 `shouldKeepAudioSrc`，不要复制一份布尔表达式。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/playback.test.ts`

Expected: FAIL（`shouldKeepAudioSrc` 未导出）

- [ ] **Step 3: Write minimal implementation**

实现 `shouldKeepAudioSrc` 并按要点改 `usePlayback.ts`。

- [ ] **Step 4: Run tests**

Run: `vp test packages/renderer/src/playback.test.ts`

Expected: PASS

然后在根目录：

Run: `vp check`

Expected: 无新增 error

Run: `pnpm type-check`

Expected: exit 0

Run: `vp test`

Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/usePlayback.ts packages/renderer/src/playback.ts packages/renderer/src/playback.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 合辑切章只 seek 不换音频源

EOF
)"
```

---

## Self-review vs spec

| Spec 条款                                      | Task                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| 曲目 clip 字段、会话 position 窗口时间         | 3、4、10                                        |
| 身份键 `bvid::cid::from::to`、音频键无 from/to | 1、8                                            |
| SQLite 不改表、读回靠键                        | 9                                               |
| 单 P + isSongVideo 或 AI Key 才请求            | 2、7                                            |
| 规范化 / <2 不拆 / 多 P 不拆                   | 2、6、7                                         |
| 章节不用稿件《》、AI drop not_music            | 5、6                                            |
| 有窗口不用 bgm_info                            | 8                                               |
| 进度条/歌词/±5s/章末/同 cid                    | 3、10                                           |
| trackLyrics 与下载列表一条                     | 8                                               |
| 过滤仍稿件级                                   | 7（不改 `filterVideoPayload` 顺序：先过滤再拆） |
| 失败回退                                       | 6、7、8                                         |
