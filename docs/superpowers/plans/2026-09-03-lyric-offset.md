# 歌词时间轴偏移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 播放页按曲微调歌词时间轴，边看词边对，偏移持久化且换词仍保留。

**Architecture:** 偏移按曲目 id 存在主进程 `electron-store` 的 `lyricOffsets`，与歌词正文分开。渲染进程用纯函数把播放进度平移成歌词时钟；播放页「更多」打开歌词右侧竖条，步进立刻写回。

**Tech Stack:** Electron `electron-store`、tRPC、React 播放页、AMLL `LyricPlayer`、Vitest（`vp test`）、shadcn Button / DropdownMenu / Separator。

## Global Constraints

- 正数 = 歌词延后；`歌词时钟 = 播放进度 − 偏移毫秒`；`seek = 行时间 + 偏移毫秒`
- 步进 0.5 秒，夹在 ±10 秒；写回 0 时删除该键
- 键与 `resolvePlay` 相同：已有 `track.id` 就用，否则 `generateUniqueTrackKey({ bvid, cid, isMultiPage: true })`
- 不改 LRC / SPL、不改导出歌词、不做全局偏移、竖条不放「重置」
- 上箭头 −0.5s（提前），下箭头 +0.5s（延后），勾只收起竖条
- 切歌、关掉歌词面板、或勾一下都收起竖条
- 命令在仓库根目录：`vp test`、`vp check`、`pnpm type-check`
- 提交格式：`:sparkles: feat(scope): 简体中文` / `:white_check_mark: test: …` / `:memo: docs: …`，走钩子，不 `--no-verify`

对照 spec：`docs/superpowers/specs/2026-09-03-lyric-offset-design.md`

---

## File map

**Create:**

- `packages/renderer/src/lyric-offset.ts` — 步进、夹紧、时钟、seek、文案
- `packages/renderer/src/lyric-offset.test.ts`
- `packages/main/src/lyric-offset.ts` — 读/写 store、曲目 id
- `packages/main/src/lyric-offset.test.ts`
- `packages/renderer/src/LyricOffsetRail.tsx` — 歌词右侧竖条

**Modify:**

- `packages/main/src/store.ts` — `Persisted.lyricOffsets`
- `packages/main/src/trpc/context.ts` — `resolvePlay` 返回 `lyricOffset`
- `packages/main/src/trpc/mock-context.ts` — mock 返回带 `lyricOffset`
- `packages/main/src/trpc/routers/player.ts` — `setLyricOffset`
- `packages/main/src/trpc/routers/player.test.ts` — 写盘 / 夹紧 / 删 0
- `packages/main/src/index.ts` — `resolvePlay` 带上偏移
- `packages/renderer/src/usePlayback.ts` — 加载、应用时钟、持久化
- `packages/renderer/src/NowPlaying.tsx` — 菜单项 + 竖条

---

### Task 1: 渲染进程时钟纯函数

**Files:**

- Create: `packages/renderer/src/lyric-offset.ts`
- Create: `packages/renderer/src/lyric-offset.test.ts`

**Interfaces:**

- Produces:
  - `LYRIC_OFFSET_STEP = 0.5`
  - `LYRIC_OFFSET_MIN = -10`
  - `LYRIC_OFFSET_MAX = 10`
  - `clampLyricOffset(sec: number): number`
  - `stepLyricOffset(sec: number, direction: 1 | -1): number`
  - `lyricClockMs(currentTimeMs: number, offsetSec: number): number`
  - `lyricSeekMs(lineStartMs: number, offsetSec: number): number`
  - `formatLyricOffset(sec: number): string`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { currentLyricText } from './lyric-text.ts'
import {
	clampLyricOffset,
	formatLyricOffset,
	lyricClockMs,
	lyricSeekMs,
	stepLyricOffset,
} from './lyric-offset.ts'

test('步进 0.5 并夹在 ±10', () => {
	assert.equal(stepLyricOffset(0, 1), 0.5)
	assert.equal(stepLyricOffset(0, -1), -0.5)
	assert.equal(stepLyricOffset(10, 1), 10)
	assert.equal(stepLyricOffset(-10, -1), -10)
	assert.equal(clampLyricOffset(10.4), 10)
	assert.equal(clampLyricOffset(-10.4), -10)
})

test('正数让歌词时钟落后于播放进度', () => {
	assert.equal(lyricClockMs(11_000, 1), 10_000)
	assert.equal(lyricClockMs(10_000, -0.5), 10_500)
	assert.equal(lyricSeekMs(10_000, 1), 11_000)
	assert.equal(lyricSeekMs(10_000, -0.5), 9500)
})

test('偏移文案带符号和一位小数', () => {
	assert.equal(formatLyricOffset(0), '0.0s')
	assert.equal(formatLyricOffset(1), '+1.0s')
	assert.equal(formatLyricOffset(-0.5), '-0.5s')
})

test('菜单栏当前句与滚动共用歌词时钟', () => {
	const lines = [
		{ startTime: 0, words: [{ word: '前' }] },
		{ startTime: 10_000, words: [{ word: '中' }] },
	]
	assert.equal(currentLyricText(lines, lyricClockMs(10_500, 1)), '前')
	assert.equal(currentLyricText(lines, lyricClockMs(11_000, 1)), '中')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/lyric-offset.test.ts`

Expected: FAIL，模块不存在

- [ ] **Step 3: Write minimal implementation**

```ts
export const LYRIC_OFFSET_STEP = 0.5
export const LYRIC_OFFSET_MIN = -10
export const LYRIC_OFFSET_MAX = 10

export function clampLyricOffset(sec: number) {
	if (!Number.isFinite(sec)) return 0
	const snapped = Math.round(sec / LYRIC_OFFSET_STEP) * LYRIC_OFFSET_STEP
	const clamped = Math.min(
		LYRIC_OFFSET_MAX,
		Math.max(LYRIC_OFFSET_MIN, snapped),
	)
	return Number(clamped.toFixed(1))
}

export function stepLyricOffset(sec: number, direction: 1 | -1) {
	return clampLyricOffset(sec + direction * LYRIC_OFFSET_STEP)
}

export function lyricClockMs(currentTimeMs: number, offsetSec: number) {
	return currentTimeMs - offsetSec * 1000
}

export function lyricSeekMs(lineStartMs: number, offsetSec: number) {
	return lineStartMs + offsetSec * 1000
}

export function formatLyricOffset(sec: number) {
	const value = clampLyricOffset(sec)
	if (value === 0) return '0.0s'
	const sign = value > 0 ? '+' : ''
	return `${sign}${value.toFixed(1)}s`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/renderer/src/lyric-offset.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/lyric-offset.ts packages/renderer/src/lyric-offset.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 歌词偏移时钟与步进纯函数

EOF
)"
```

---

### Task 2: 主进程按曲持久化

**Files:**

- Create: `packages/main/src/lyric-offset.ts`
- Create: `packages/main/src/lyric-offset.test.ts`
- Modify: `packages/main/src/store.ts`
- Modify: `packages/main/src/trpc/context.ts`
- Modify: `packages/main/src/trpc/mock-context.ts`
- Modify: `packages/main/src/trpc/routers/player.ts`
- Modify: `packages/main/src/trpc/routers/player.test.ts`
- Modify: `packages/main/src/index.ts`（`resolvePlay` 返回值）

**Interfaces:**

- Consumes: `generateUniqueTrackKey` from `@bbplayer/core`；夹紧规则与 Task 1 相同（±10、0.5）
- Produces:
  - `trackIdForOffset(track: { id?: string; bvid: string; cid: number }): string`
  - `readLyricOffset(store: Pick<TrpcStore, 'get'>, trackId: string): number`
  - `writeLyricOffset(store: Pick<TrpcStore, 'get' | 'set'>, trackId: string, offsetSec: number): number`
  - `player.setLyricOffset` input `{ trackId: string, offsetSec: number }`，返回夹紧后的秒
  - `resolvePlay` 增加 `lyricOffset: number`

- [ ] **Step 1: Write the failing persist tests**

`packages/main/src/lyric-offset.test.ts`：

```ts
import { generateUniqueTrackKey } from '@bbplayer/core'
import { assert, test } from 'vitest'

import { memoryStore } from './trpc/mock-context.ts'
import {
	readLyricOffset,
	trackIdForOffset,
	writeLyricOffset,
} from './lyric-offset.ts'

test('缺 id 时与 resolvePlay 同一套键', () => {
	assert.equal(
		trackIdForOffset({ bvid: 'BV1xx', cid: 9 }),
		generateUniqueTrackKey({
			bvid: 'BV1xx',
			cid: 9,
			isMultiPage: true,
		}),
	)
	assert.equal(
		trackIdForOffset({ id: 'bilibili::BV1aa', bvid: 'BV1xx', cid: 9 }),
		'bilibili::BV1aa',
	)
})

test('写偏移、夹紧、回 0 删键，换词不影响', () => {
	const store = memoryStore()
	assert.equal(readLyricOffset(store, 't1'), 0)
	assert.equal(writeLyricOffset(store, 't1', 1), 1)
	assert.equal(readLyricOffset(store, 't1'), 1)
	assert.equal(writeLyricOffset(store, 't1', 10.4), 10)
	assert.equal(writeLyricOffset(store, 't1', 0), 0)
	assert.equal(store.get('lyricOffsets')?.t1, undefined)
	assert.equal(writeLyricOffset(store, 't1', -0.5), -0.5)
	assert.equal(readLyricOffset(store, 't1'), -0.5)
})
```

在 `packages/main/src/trpc/routers/player.test.ts` 追加：

```ts
test('player.setLyricOffset 按曲写入并在 0 时删除', async () => {
	const store = memoryStore()
	const caller = playerRouter.createCaller(mockTrpcContext({ store }))
	assert.equal(
		await caller.setLyricOffset({ trackId: 't1', offsetSec: 1.5 }),
		1.5,
	)
	assert.equal(store.get('lyricOffsets')?.t1, 1.5)
	assert.equal(await caller.setLyricOffset({ trackId: 't1', offsetSec: 0 }), 0)
	assert.equal(store.get('lyricOffsets')?.t1, undefined)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test packages/main/src/lyric-offset.test.ts packages/main/src/trpc/routers/player.test.ts`

Expected: FAIL，`lyricOffsets` / `setLyricOffset` 不存在

- [ ] **Step 3: Persist helpers + store 类型**

`packages/main/src/store.ts` 的 `Persisted` 增加：

```ts
lyricOffsets?: Record<string, number>
```

`packages/main/src/lyric-offset.ts`：

```ts
import { generateUniqueTrackKey } from '@bbplayer/core'

import type { TrpcStore } from './trpc/context'

const STEP = 0.5
const MIN = -10
const MAX = 10

function clamp(sec: number) {
	if (!Number.isFinite(sec)) return 0
	const snapped = Math.round(sec / STEP) * STEP
	const clamped = Math.min(MAX, Math.max(MIN, snapped))
	return Number(clamped.toFixed(1))
}

export function trackIdForOffset(track: {
	id?: string
	bvid: string
	cid: number
}) {
	if (track.id) return track.id
	return generateUniqueTrackKey({
		bvid: track.bvid,
		cid: track.cid,
		isMultiPage: true,
	})
}

export function readLyricOffset(
	store: Pick<TrpcStore, 'get'>,
	trackId: string,
) {
	return clamp(store.get('lyricOffsets')?.[trackId] ?? 0)
}

export function writeLyricOffset(
	store: Pick<TrpcStore, 'get' | 'set'>,
	trackId: string,
	offsetSec: number,
) {
	const next = clamp(offsetSec)
	const map = { ...(store.get('lyricOffsets') ?? {}) }
	if (next === 0) delete map[trackId]
	else map[trackId] = next
	store.set('lyricOffsets', map)
	return next
}
```

- [ ] **Step 4: tRPC 与 resolvePlay**

`player.ts` 增加 mutation（放在 `resolve` 旁）：

```ts
setLyricOffset: publicProcedure
	.input(
		z.object({
			trackId: z.string().min(1),
			offsetSec: z.number(),
		}),
	)
	.mutation(({ ctx, input }) =>
		writeLyricOffset(ctx.store, input.trackId, input.offsetSec),
	),
```

`context.ts` 的 `resolvePlay` 返回值增加 `lyricOffset?: number`。

`mock-context.ts`：

```ts
resolvePlay: async () => ({ playUrl: '', lyrics: [], lyricOffset: 0 }),
```

`packages/main/src/index.ts` 的 `resolvePlay`：已有 `id` 计算保持不变；在 `return { playUrl, lyrics, cached, lyricSource }` 改为：

```ts
return {
	playUrl,
	lyrics,
	cached: Boolean(cached),
	lyricSource,
	lyricOffset: readLyricOffset(store, id),
}
```

顶部增加 `import { readLyricOffset, trackIdForOffset } from './lyric-offset'`。把现有 `id` 赋值改成 `const id = trackIdForOffset(track)`，避免两套键。

- [ ] **Step 5: Run tests to verify they pass**

Run: `vp test packages/main/src/lyric-offset.test.ts packages/main/src/trpc/routers/player.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/main/src/lyric-offset.ts packages/main/src/lyric-offset.test.ts packages/main/src/store.ts packages/main/src/trpc/context.ts packages/main/src/trpc/mock-context.ts packages/main/src/trpc/routers/player.ts packages/main/src/trpc/routers/player.test.ts packages/main/src/index.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 按曲保存歌词时间轴偏移

EOF
)"
```

---

### Task 3: 播放钩子接上时钟与写盘

**Files:**

- Modify: `packages/renderer/src/usePlayback.ts`

**Interfaces:**

- Consumes: `lyricClockMs`、`lyricSeekMs`、`stepLyricOffset`；`player.resolve` 的 `lyricOffset`；`player.setLyricOffset`
- Produces: `usePlayback` 增加 `lyricOffsetSec: number`、`lyricClockMs: number`、`stepLyricOffsetBy(direction: 1 | -1): void`、`seekLyricLine(lineStartMs: number): void`

- [ ] **Step 1: 在 `usePlayback` 接入偏移**

增加状态，切歌先清零再读 resolve，避免把上一首的偏移套到新词上：

```ts
const [lyricOffsetSec, setLyricOffsetSec] = useState(0)
```

`playTrack` 在 `setLyrics` 之前：`setLyricOffsetSec(0)`。`resolve` 成功后：

```ts
setLyricOffsetSec(resolved.lyricOffset ?? 0)
```

用 Task 1 的时钟算当前句（替换原来的 `currentLyricText(lyrics, currentTime)`）：

```ts
const lyricTimeMs = lyricClockMs(currentTime, lyricOffsetSec)
const lyricLine = currentLyricText(lyrics, lyricTimeMs)
```

增加：

```ts
const persistLyricOffset = useCallback(async (next: number) => {
	setLyricOffsetSec(next)
	const track = queueRef.current[indexRef.current]
	if (!track?.id) return
	try {
		const saved = await trpcClient.player.setLyricOffset.mutate({
			trackId: track.id,
			offsetSec: next,
		})
		setLyricOffsetSec(saved)
	} catch {
		// 本地偏移继续生效，下次再按再写
	}
}, [])

const stepLyricOffsetBy = useCallback(
	(direction: 1 | -1) => {
		void persistLyricOffset(stepLyricOffset(lyricOffsetSec, direction))
	},
	[lyricOffsetSec, persistLyricOffset],
)

const seekLyricLine = useCallback(
	(lineStartMs: number) => {
		seek(lyricSeekMs(lineStartMs, lyricOffsetSec))
	},
	[lyricOffsetSec, seek],
)
```

return 增加 `lyricOffsetSec`、`lyricClockMs: lyricTimeMs`、`stepLyricOffsetBy`、`seekLyricLine`。

- [ ] **Step 2: Run renderer offset tests still pass**

Run: `vp test packages/renderer/src/lyric-offset.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/renderer/src/usePlayback.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 播放时钟套上按曲歌词偏移

EOF
)"
```

---

### Task 4: 更多菜单与歌词右侧竖条

**Files:**

- Create: `packages/renderer/src/LyricOffsetRail.tsx`
- Modify: `packages/renderer/src/NowPlaying.tsx`

**Interfaces:**

- Consumes: `formatLyricOffset`、`stepLyricOffset`、`LYRIC_OFFSET_MIN` / `MAX`；`player.lyricOffsetSec`、`player.stepLyricOffsetBy`、`player.lyricClockMs`、`player.seekLyricLine`
- Produces: 菜单项「时间轴偏移」；竖条上 / 值 / 下 / 勾

- [ ] **Step 1: 竖条组件**

```tsx
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import {
	formatLyricOffset,
	LYRIC_OFFSET_MAX,
	LYRIC_OFFSET_MIN,
} from './lyric-offset'

export function LyricOffsetRail({
	offsetSec,
	onStep,
	onDone,
}: {
	offsetSec: number
	onStep: (direction: 1 | -1) => void
	onDone: () => void
}) {
	return (
		<div
			className='bg-popover text-popover-foreground absolute top-1/2 right-[22px] z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-3xl p-2 shadow-md ring-1 ring-foreground/10'
			data-lyric-offset-rail
		>
			<Button
				type='button'
				variant='ghost'
				size='icon'
				aria-label='歌词提前 0.5 秒'
				disabled={offsetSec <= LYRIC_OFFSET_MIN}
				onClick={() => onStep(-1)}
			>
				<ChevronUpIcon />
			</Button>
			<span className='text-foreground min-w-10 text-center text-xs font-medium tabular-nums'>
				{formatLyricOffset(offsetSec)}
			</span>
			<Button
				type='button'
				variant='ghost'
				size='icon'
				aria-label='歌词延后 0.5 秒'
				disabled={offsetSec >= LYRIC_OFFSET_MAX}
				onClick={() => onStep(1)}
			>
				<ChevronDownIcon />
			</Button>
			<Separator className='my-1 w-5' />
			<Button
				type='button'
				variant='ghost'
				size='icon'
				aria-label='完成偏移调整'
				onClick={onDone}
			>
				<CheckIcon />
			</Button>
		</div>
	)
}
```

- [ ] **Step 2: 接到 NowPlaying**

`NowPlaying.tsx`：

- 增加 `import { CheckIcon, ChevronDownIcon, ChevronUpIcon }` 不需要（竖条已自带图标）。现有 `ChevronDownIcon` 是顶栏关闭，保留。
- `import { LyricOffsetRail } from './LyricOffsetRail'`
- 在组件内：

```tsx
const [offsetOpen, setOffsetOpen] = useState(false)
const canAdjustOffset = lyricsOpen && player.lyrics.length > 0

useEffect(() => {
	setOffsetOpen(false)
}, [track.id])

useEffect(() => {
	if (!lyricsOpen) setOffsetOpen(false)
}, [lyricsOpen])
```

「倍速」项后面插入：

```tsx
<DropdownMenuItem
	disabled={!canAdjustOffset}
	onClick={() => setOffsetOpen(true)}
>
	时间轴偏移
</DropdownMenuItem>
```

`LyricPlayer`：

```tsx
currentTime={Math.round(player.lyricClockMs)}
onLyricLineClick={(event) => {
	const line = player.lyrics[event.lineIndex]
	if (line) player.seekLyricLine(line.startTime)
}}
```

在 `data-player-page` 的 `section` 里、右下角 dock **之前**（dock 仍 `bottom-[22px]`）：

```tsx
{
	offsetOpen && canAdjustOffset ? (
		<LyricOffsetRail
			offsetSec={player.lyricOffsetSec}
			onStep={player.stepLyricOffsetBy}
			onDone={() => setOffsetOpen(false)}
		/>
	) : null
}
```

- [ ] **Step 3: Typecheck and format**

Run: `pnpm type-check`

Expected: PASS（`resolve` 结果含 `lyricOffset`，`usePlayback` 新字段对上）

Run: `vp check`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/renderer/src/LyricOffsetRail.tsx packages/renderer/src/NowPlaying.tsx
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 播放页从更多打开歌词右侧偏移条

EOF
)"
```

---

### Task 5: 全量校验

- [ ] `vp test`
- [ ] `vp check`
- [ ] `pnpm type-check`

Expected: 全部通过。桌面端用 `pnpm desktop` 手动：有歌词时打开「时间轴偏移」，上下箭头歌词立刻错位/对齐，勾收起；切歌后再打开应为 0 或该曲已存值；关歌词面板竖条消失。

---

## Spec coverage

| Spec                           | Task               |
| ------------------------------ | ------------------ |
| 时钟公式与正负含义             | 1, 3               |
| 步进 0.5、±10、文案            | 1, 4               |
| 按曲 store、换词仍在、0 删键   | 2                  |
| resolve 带偏移、setLyricOffset | 2, 3               |
| 写盘失败保留本地               | 3                  |
| 更多菜单入口、禁用条件         | 4                  |
| 右侧竖条、勾收起               | 4                  |
| 切歌 / 关歌词面板收起          | 4                  |
| 点行 seek 含偏移               | 3, 4               |
| 菜单栏当前句同一时钟           | 1, 3               |
| 不改 LRC / 导出                | 全程（只平移时钟） |
