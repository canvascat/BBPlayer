# 稿件曲名 / 歌手解析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 拉稿件详情时解析出歌名和歌手，Now Playing 与歌词搜索用解析结果，播放过程不再等模型。

**Architecture:** `bili.video` 在 view 返回后走规则 → 可选 OpenAI 兼容一次调用 → 按曲写入 `electron-store` 的 `musicMeta`。`title` / `artist` 仍是稿件标题和 UP；展示和歌词用 `musicTitle` / `musicArtist`。`resolvePlay` 不调模型，仅在有 B 站 BGM 时覆盖歌词关键词。

**Tech Stack:** Electron `electron-store`、tRPC、智谱 OpenAI 兼容 `chat/completions`、Vitest（`vp test`）、现有 settings Field / Input。

## Global Constraints

- 未配置 `musicAiApiKey` 时行为与现在完全一致
- 不覆盖曲目身份：`title` / `artist` 仍是稿件标题和 UP
- 一篇稿件最多一次模型请求；全局同时最多 2 个模型请求
- 歌词搜索只用歌名，不拼 `musicArtist`
- `resolvePlay` 不调用模型；有 `bgm_info.music_title` 时用它做 `preciseKeyword`
- 模型失败静默回退，`bili.video` 仍返回稿件字段
- 不改 SQLite schema、不改歌单分享、不在搜索/收藏视频列表上预解析
- 命令在仓库根目录：`vp test`、`vp check`、`pnpm type-check`
- 提交格式：`:sparkles: feat(scope): 简体中文`，走钩子，不 `--no-verify`

对照 spec：`docs/superpowers/specs/2026-09-04-ai-music-metadata-design.md`

---

## File map

**Create:**

- `packages/core/src/music-display.ts` — `displayTitle` / `displayArtist`
- `packages/core/src/music-display.test.ts`
- `packages/main/src/music-meta.ts` — 规则、JSON 校验、合并、哈希、歌词关键词、整篇填充
- `packages/main/src/music-meta.test.ts`
- `packages/main/src/music-meta-store.ts` — `musicMeta` 读写与叠到曲目上
- `packages/main/src/music-meta-store.test.ts`
- `packages/main/src/music-ai.ts` — OpenAI 兼容调用、超时、并发 2
- `packages/main/src/music-ai.test.ts`

**Modify:**

- `packages/core/src/index.ts` — 导出 display
- `packages/main/src/store.ts` — 设置项与 `musicMeta`
- `packages/main/src/index.ts` — store 默认值、`resolvePlay` 歌词关键词
- `packages/main/src/bili.ts` — view 类型声明 `desc`
- `packages/main/src/trpc/context.ts` — `ResolveTrack.musicTitle`
- `packages/main/src/trpc/routers/settings.ts` — 读写三项设置
- `packages/main/src/trpc/routers/settings.test.ts`
- `packages/main/src/trpc/routers/bili.ts` — `bili.video` 填充 music 字段
- `packages/main/src/trpc/routers/library.ts` — 读出歌单时叠缓存；zod 可选字段
- `packages/main/src/trpc/routers/session.ts` — 读出会话时叠缓存；zod 可选字段
- `packages/main/src/trpc/routers/downloads.ts` — list 叠缓存；zod 可选字段
- `packages/main/src/trpc/routers/player.ts` — resolve 输入允许 `musicTitle`
- `packages/main/src/db/types.ts` — `LibraryTrack` 可选 music 字段
- `packages/main/src/export-audio.ts` — 导出文件名用 display
- `packages/renderer/src/playback.ts` — `TrackItem` 可选 music 字段
- `packages/renderer/src/NowPlaying.tsx`、`routes/index.tsx`、`App.tsx`、`components/library-track-list.tsx`、`routes/library/downloads.tsx`、`usePlayback.ts`、`app-context.tsx`、`routes/settings.tsx` — 展示与设置

---

### Task 1: 展示回退纯函数

**Files:**

- Create: `packages/core/src/music-display.ts`
- Create: `packages/core/src/music-display.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces:
  - `displayTitle(track: { title: string; musicTitle?: string | null }): string`
  - `displayArtist(track: { artist: string; musicArtist?: string | null }): string`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { displayArtist, displayTitle } from './music-display.ts'

test('有解析结果用解析结果', () => {
	assert.equal(
		displayTitle({ title: '【翻唱】起风了', musicTitle: '起风了' }),
		'起风了',
	)
	assert.equal(
		displayArtist({ artist: '某UP', musicArtist: '买辣椒也用券' }),
		'买辣椒也用券',
	)
})

test('没有解析结果回退稿件字段', () => {
	assert.equal(displayTitle({ title: '稿件' }), '稿件')
	assert.equal(displayArtist({ artist: 'UP' }), 'UP')
})

test('空字符串不当解析结果', () => {
	assert.equal(displayTitle({ title: '稿件', musicTitle: '' }), '稿件')
	assert.equal(displayArtist({ artist: 'UP', musicArtist: '  ' }), 'UP')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/core/src/music-display.test.ts`

Expected: FAIL，找不到模块或导出。

- [ ] **Step 3: Write minimal implementation**

```ts
function present(value?: string | null) {
	const text = value?.trim()
	return text ? text : undefined
}

export function displayTitle(track: {
	title: string
	musicTitle?: string | null
}) {
	return present(track.musicTitle) ?? track.title
}

export function displayArtist(track: {
	artist: string
	musicArtist?: string | null
}) {
	return present(track.musicArtist) ?? track.artist
}
```

在 `packages/core/src/index.ts` 增加：`export * from './music-display'`

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/core/src/music-display.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/music-display.ts packages/core/src/music-display.test.ts packages/core/src/index.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(core): 曲目展示优先用解析出的歌名和歌手

EOF
)"
```

---

### Task 2: 规则、JSON 合并与哈希

**Files:**

- Create: `packages/main/src/music-meta.ts`
- Create: `packages/main/src/music-meta.test.ts`

**Interfaces:**

- Consumes: 无
- Produces:
  - `DESC_LIMIT = 2000`
  - `truncateDesc(desc: string | undefined): string`
  - `extractBracketTitle(text: string): string | undefined`
  - `extractFromDescription(desc: string): { title?: string; artist?: string }`
  - `ruleGuess(input: { part: string; videoTitle: string; desc: string }): { title?: string; artist?: string }`
  - `musicSourceHash(input: { title: string; desc: string; parts: string[] }): string`
  - `type MusicAiTrack = { index: number; title: string | null; artist: string | null; confidence: 'high' | 'low'; kind: 'original' | 'cover' | 'medley' | 'not_music' }`
  - `parseMusicAiPayload(raw: string): MusicAiTrack[] | null`
  - `mergePageMeta(rule: { title?: string; artist?: string }, ai: MusicAiTrack | undefined): { musicTitle?: string; musicArtist?: string }`
  - `lyricSearchInput(track: { title: string; musicTitle?: string }, bgmTitle?: string | null): { title: string; preciseKeyword?: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import {
	extractBracketTitle,
	extractFromDescription,
	lyricSearchInput,
	mergePageMeta,
	musicSourceHash,
	parseMusicAiPayload,
	ruleGuess,
	truncateDesc,
} from './music-meta.ts'

test('书名号优先于标题其余部分', () => {
	assert.equal(extractBracketTitle('【翻唱】《起风了》live'), '起风了')
	assert.equal(extractBracketTitle('「夜に駆ける」'), '夜に駆ける')
	assert.equal(extractBracketTitle('没有括号'), undefined)
})

test('简介标签抽出歌名和原唱', () => {
	assert.deepEqual(extractFromDescription('歌名：起风了\n原唱：买辣椒也用券'), {
		title: '起风了',
		artist: '买辣椒也用券',
	})
})

test('规则：分 P 书名号优先，否则稿件标题，简介补歌手', () => {
	const guessed = ruleGuess({
		part: 'P1 《晴天》',
		videoTitle: '【高音质】乱七八糟',
		desc: '原唱：周杰伦',
	})
	assert.equal(guessed.title, '晴天')
	assert.equal(guessed.artist, '周杰伦')
})

test('简介截断到 2000 字', () => {
	assert.equal(truncateDesc('a'.repeat(2001)).length, 2000)
	assert.equal(truncateDesc(undefined), '')
})

test('sourceHash 随标题或分 P 变化', () => {
	const a = musicSourceHash({ title: 'A', desc: '', parts: ['p1'] })
	const b = musicSourceHash({ title: 'B', desc: '', parts: ['p1'] })
	assert.notEqual(a, b)
	assert.equal(a.length, 16)
})

test('JSON 低置信度和 not_music 在合并时丢弃', () => {
	assert.deepEqual(
		parseMusicAiPayload(
			JSON.stringify({
				tracks: [
					{
						index: 1,
						title: 'x',
						artist: 'y',
						confidence: 'low',
						kind: 'cover',
					},
				],
			}),
		),
		[
			{
				index: 1,
				title: 'x',
				artist: 'y',
				confidence: 'low',
				kind: 'cover',
			},
		],
	)
	assert.equal(parseMusicAiPayload('not json'), null)
	assert.equal(parseMusicAiPayload('{"tracks":[]}'), null)
	assert.deepEqual(
		mergePageMeta(
			{ title: '规则歌' },
			{
				index: 1,
				title: 'AI歌',
				artist: 'AI人',
				confidence: 'high',
				kind: 'cover',
			},
		),
		{ musicTitle: '规则歌', musicArtist: 'AI人' },
	)
	assert.deepEqual(
		mergePageMeta(
			{},
			{
				index: 1,
				title: 'AI歌',
				artist: 'AI人',
				confidence: 'high',
				kind: 'not_music',
			},
		),
		{},
	)
	assert.deepEqual(
		mergePageMeta(
			{},
			{
				index: 1,
				title: 'AI歌',
				artist: null,
				confidence: 'low',
				kind: 'cover',
			},
		),
		{},
	)
})

test('歌词关键词：BGM 优先，否则 musicTitle，不拼歌手', () => {
	assert.deepEqual(
		lyricSearchInput(
			{ title: '视频', musicTitle: '解析名' },
			'BGM《挂曲》- 某人',
		),
		{ title: '视频', preciseKeyword: '挂曲' },
	)
	assert.deepEqual(lyricSearchInput({ title: '视频', musicTitle: '解析名' }), {
		title: '视频',
		preciseKeyword: '解析名',
	})
	assert.deepEqual(lyricSearchInput({ title: '视频' }), { title: '视频' })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/music-meta.test.ts`

Expected: FAIL，找不到模块。

- [ ] **Step 3: Write minimal implementation**

`lyricSearchInput` 里调用已有 `preciseMusicNameFromBgm`（`./lyric-match.ts`）。`parseMusicAiPayload`：`tracks` 必须是非空数组，每项 `index` 为正整数；非法整包返回 `null`。`mergePageMeta`：规则 title 始终保留；规则无 title 时仅当 `confidence === 'high'` 且 `kind !== 'not_music'` 且 title 非空才用 AI title；artist 仅当 AI `confidence === 'high'` 且 `kind !== 'not_music'` 且 artist 非空时写入。`musicSourceHash` 用 `node:crypto` 的 sha256，取 hex 前 16 位。`extractFromDescription` 匹配 `(?:歌名|曲名|曲)\\s*[：:]\\s*(.+)` 与 `(?:原唱|翻唱)\\s*[：:]\\s*(.+)`，值取到行尾并 trim。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/music-meta.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/music-meta.ts packages/main/src/music-meta.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 用规则和 JSON 合并稿件歌名歌手

EOF
)"
```

---

### Task 3: musicMeta 缓存

**Files:**

- Create: `packages/main/src/music-meta-store.ts`
- Create: `packages/main/src/music-meta-store.test.ts`

**Interfaces:**

- Consumes: `TrpcStore`（`packages/main/src/trpc/context.ts`）
- Produces:
  - `type MusicMetaEntry = { musicTitle?: string; musicArtist?: string; sourceHash: string }`
  - `readMusicMeta(store, trackId: string): MusicMetaEntry | undefined`
  - `writeMusicMeta(store, trackId: string, entry: MusicMetaEntry): void`
  - `overlayMusicMeta<T extends { id: string }>(store, tracks: T[]): Array<T & { musicTitle?: string; musicArtist?: string }>`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { memoryStore } from './trpc/mock-context.ts'
import {
	overlayMusicMeta,
	readMusicMeta,
	writeMusicMeta,
} from './music-meta-store.ts'

test('写入后可读，overlay 按 id 叠字段且不改 title', () => {
	const store = memoryStore()
	writeMusicMeta(store, 'bilibili::BV1', {
		musicTitle: '起风了',
		musicArtist: '买辣椒也用券',
		sourceHash: 'abc',
	})
	assert.deepEqual(readMusicMeta(store, 'bilibili::BV1'), {
		musicTitle: '起风了',
		musicArtist: '买辣椒也用券',
		sourceHash: 'abc',
	})
	const tracks = overlayMusicMeta(store, [
		{ id: 'bilibili::BV1', title: '视频标题', artist: 'UP' },
		{ id: 'other', title: '另一首', artist: 'B' },
	])
	assert.equal(tracks[0]?.title, '视频标题')
	assert.equal(tracks[0]?.musicTitle, '起风了')
	assert.equal(tracks[1]?.musicTitle, undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/music-meta-store.test.ts`

Expected: FAIL，找不到模块。

- [ ] **Step 3: Write minimal implementation**

`store.get('musicMeta')` 可能是 `undefined`。`writeMusicMeta` 浅拷贝整个 map 再 `set`。`overlayMusicMeta` 只在缓存有非空 `musicTitle` / `musicArtist` 时写到返回对象上。

同时改 `packages/main/src/store.ts`：

- `Persisted.musicMeta`（和 `lyricOffsets` 一样）
- `Settings` 预留 `musicAiBaseUrl` / `musicAiApiKey` / `musicAiModel`（Task 6 接 tRPC 与默认值）

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/music-meta-store.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/music-meta-store.ts packages/main/src/music-meta-store.test.ts packages/main/src/store.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 按曲缓存解析出的歌名和歌手

EOF
)"
```

---

### Task 4: OpenAI 兼容调用与并发

**Files:**

- Create: `packages/main/src/music-ai.ts`
- Create: `packages/main/src/music-ai.test.ts`

**Interfaces:**

- Consumes: `parseMusicAiPayload`、`MusicAiTrack`（Task 2）
- Produces:
  - `MUSIC_AI_TIMEOUT_MS = 8000`
  - `MUSIC_AI_CONCURRENCY = 2`
  - `type MusicAiInput = { title: string; desc: string; ownerName: string; pages: Array<{ index: number; part: string }> }`
  - `type MusicAiConfig = { baseUrl: string; apiKey: string; model: string }`
  - `completeMusicAi(input: MusicAiInput, config: MusicAiConfig, fetchImpl?: typeof fetch): Promise<MusicAiTrack[] | null>`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import { completeMusicAi } from './music-ai.ts'

const input = {
	title: '【翻唱】起风了',
	desc: '原唱买辣椒也用券',
	ownerName: 'UP',
	pages: [{ index: 1, part: '起风了' }],
}

test('成功时解析 tracks，并关掉 thinking、带 json_object', async () => {
	let body: Record<string, unknown> | undefined
	let url = ''
	const tracks = await completeMusicAi(
		input,
		{
			baseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
			apiKey: 'sk-test',
			model: 'glm-4-flash',
		},
		async (requestUrl, init) => {
			url = String(requestUrl)
			body = JSON.parse(String(init?.body))
			assert.equal(
				(init?.headers as Record<string, string>)?.Authorization,
				'Bearer sk-test',
			)
			return new Response(
				JSON.stringify({
					choices: [
						{
							message: {
								content: JSON.stringify({
									tracks: [
										{
											index: 1,
											title: '起风了',
											artist: '买辣椒也用券',
											confidence: 'high',
											kind: 'cover',
										},
									],
								}),
							},
						},
					],
				}),
				{ status: 200 },
			)
		},
	)
	assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions')
	assert.equal(body?.model, 'glm-4-flash')
	assert.equal(body?.temperature, 0)
	assert.deepEqual(body?.response_format, { type: 'json_object' })
	assert.deepEqual(body?.thinking, { type: 'disabled' })
	assert.equal(tracks?.[0]?.title, '起风了')
})

test('4xx 或非 JSON 返回 null', async () => {
	assert.equal(
		await completeMusicAi(
			input,
			{
				baseUrl: 'https://example.com/v4/',
				apiKey: 'k',
				model: 'm',
			},
			async () => new Response('nope', { status: 401 }),
		),
		null,
	)
})

test('同时最多两个请求', async () => {
	let current = 0
	let max = 0
	const fetchImpl: typeof fetch = async () => {
		current += 1
		max = Math.max(max, current)
		await new Promise((resolve) => setTimeout(resolve, 30))
		current -= 1
		return new Response(
			JSON.stringify({
				choices: [
					{
						message: {
							content:
								'{"tracks":[{"index":1,"title":"a","artist":"b","confidence":"high","kind":"cover"}]}',
						},
					},
				],
			}),
			{ status: 200 },
		)
	}
	await Promise.all([
		completeMusicAi(
			input,
			{ baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' },
			fetchImpl,
		),
		completeMusicAi(
			input,
			{ baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' },
			fetchImpl,
		),
		completeMusicAi(
			input,
			{ baseUrl: 'https://x/v4/', apiKey: 'k', model: 'm' },
			fetchImpl,
		),
	])
	assert.equal(max, 2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/music-ai.test.ts`

Expected: FAIL，找不到模块。

- [ ] **Step 3: Write minimal implementation**

用 `new URL('chat/completions', config.baseUrl)` 拼 URL（调用方保证 `baseUrl` 带末尾 `/`）。`AbortSignal.timeout(8000)`。模块级信号量：`active >= 2` 时排队。system 文案按 spec：抽取歌曲名和歌手、禁止编造、UP 不等于歌手、只输出 JSON。user 内容为 JSON 字符串，字段 `title`、`desc`、`ownerName`、`pages`。`choices[0].message.content` 交给 `parseMusicAiPayload`。任何抛错或非 2xx 返回 `null`。不要 `console.log` API Key。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/music-ai.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/music-ai.ts packages/main/src/music-ai.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 用 OpenAI 兼容接口抽取稿件歌名

EOF
)"
```

---

### Task 5: 整篇稿件填充

**Files:**

- Modify: `packages/main/src/music-meta.ts`
- Modify: `packages/main/src/music-meta.test.ts`

**Interfaces:**

- Consumes: Task 2–4 的导出；`completeMusicAi`
- Produces:
  - `type MusicPageInput = { id: string; part: string }`
  - `fillMusicFields(input: { bvid: string; title: string; desc?: string; ownerName: string; pages: MusicPageInput[]; isMultiPage: boolean }, deps: { store: Pick<TrpcStore, 'get' | 'set'>; complete?: typeof completeMusicAi }): Promise<Array<{ id: string; musicTitle?: string; musicArtist?: string }>>`

缓存命中条件：每个 page 的 `readMusicMeta(id)?.sourceHash === hash`。全部命中则不调 `complete`。任一分 P 规则缺 title 或 artist，且 `store.get('musicAiApiKey')?.trim()` 非空，才调一次 `complete`。`isMultiPage` 只用于调用方生成 id，本函数直接用传入的 `id`。

默认配置：

- `musicAiBaseUrl` 缺省 `https://open.bigmodel.cn/api/paas/v4/`
- `musicAiModel` 缺省 `glm-4-flash`

- [ ] **Step 1: Write the failing test**

在 `music-meta.test.ts` 追加：

```ts
test('缓存命中且 hash 相同不打模型', async () => {
	const store = memoryStore({
		musicAiApiKey: 'sk',
		musicMeta: {
			'bilibili::BV1': {
				musicTitle: '缓存歌',
				sourceHash: musicSourceHash({
					title: '稿',
					desc: '',
					parts: ['p'],
				}),
			},
		},
	})
	let called = 0
	const result = await fillMusicFields(
		{
			bvid: 'BV1',
			title: '稿',
			pages: [{ id: 'bilibili::BV1', part: 'p' }],
			ownerName: 'UP',
			isMultiPage: false,
		},
		{
			store,
			complete: async () => {
				called += 1
				return []
			},
		},
	)
	assert.equal(called, 0)
	assert.equal(result[0]?.musicTitle, '缓存歌')
})
```

再追加：无 Key 时即使用规则缺歌手也不调用 `complete`；有 Key 且缺字段时调用一次，并把结果 `writeMusicMeta`。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/music-meta.test.ts`

Expected: FAIL，`fillMusicFields` 未导出。

- [ ] **Step 3: Write minimal implementation**

`fillMusicFields` 写在 `music-meta.ts`。对每个 page：`ruleGuess({ part: page.part, videoTitle: input.title, desc: truncateDesc(input.desc) })`。hash 用稿件 title + 截断 desc + 所有 part。命中缓存则返回缓存。否则合并规则与（可选）一次 AI（按 `index` 从 1 对齐 `pages` 下标 + 1）。写回 `writeMusicMeta`。AI 失败当 `undefined`，只保留规则。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/music-meta.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/music-meta.ts packages/main/src/music-meta.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 按稿件填充并复用歌名缓存

EOF
)"
```

---

### Task 6: 设置项

**Files:**

- Modify: `packages/main/src/store.ts`
- Modify: `packages/main/src/index.ts`（`Store` defaults）
- Modify: `packages/main/src/trpc/routers/settings.ts`
- Modify: `packages/main/src/trpc/routers/settings.test.ts`

**Interfaces:**

- Produces store 键与默认值：
  - `musicAiBaseUrl: string` 默认 `https://open.bigmodel.cn/api/paas/v4/`
  - `musicAiApiKey: string` 默认 `''`
  - `musicAiModel: string` 默认 `glm-4-flash`

- [ ] **Step 1: Write the failing test**

在 `settings.test.ts` 追加：

```ts
test('settings.get 默认曲目解析为空 Key 和智谱 Flash', async () => {
	const caller = settingsRouter.createCaller(
		mockTrpcContext({ store: memoryStore() }),
	)
	const result = await caller.get()
	assert.equal(result.musicAiApiKey, '')
	assert.equal(result.musicAiModel, 'glm-4-flash')
	assert.equal(result.musicAiBaseUrl, 'https://open.bigmodel.cn/api/paas/v4/')
})

test('settings.set 写入曲目解析三项', async () => {
	const store = memoryStore()
	const caller = settingsRouter.createCaller(mockTrpcContext({ store }))
	await caller.set({
		musicAiApiKey: 'sk-1',
		musicAiModel: 'glm-4.5-flash',
		musicAiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4/',
	})
	assert.equal(store.get('musicAiApiKey'), 'sk-1')
	assert.equal((await caller.get()).musicAiModel, 'glm-4.5-flash')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/settings.test.ts`

Expected: FAIL，没有这些字段。

- [ ] **Step 3: Write minimal implementation**

`Settings` 增加三键。`settingsPatchSchema` 三键均为 `z.string().optional()`。`readSettings` 给默认值。`set` 里字符串原样写入（允许把 Key 设回 `''`）。`packages/main/src/index.ts` 的 `defaults` 同步这三项。

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/main/src/trpc/routers/settings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/store.ts packages/main/src/index.ts packages/main/src/trpc/routers/settings.ts packages/main/src/trpc/routers/settings.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 设置里保存曲目解析 API

EOF
)"
```

---

### Task 7: 接到稿件、队列和歌词

**Files:**

- Modify: `packages/main/src/bili.ts` — `getVideoDetails` 的 data 类型增加 `desc?: string`
- Modify: `packages/main/src/trpc/routers/bili.ts`
- Modify: `packages/main/src/trpc/routers/library.ts`
- Modify: `packages/main/src/trpc/routers/session.ts`
- Modify: `packages/main/src/trpc/routers/downloads.ts`
- Modify: `packages/main/src/trpc/routers/player.ts`
- Modify: `packages/main/src/trpc/context.ts` — `ResolveTrack.musicTitle?: string`
- Modify: `packages/main/src/db/types.ts` — `LibraryTrack.musicTitle?` / `musicArtist?`
- Modify: `packages/main/src/index.ts` — `resolvePlay` 用 `lyricSearchInput`
- Modify: `packages/main/src/export-audio.ts` — `displayTitle` / `displayArtist`
- Modify: `packages/renderer/src/playback.ts` — `TrackItem` 同样两个可选字段

**Interfaces:**

- Consumes: `fillMusicFields`、`overlayMusicMeta`、`lyricSearchInput`、`displayTitle`、`displayArtist`
- `libraryTrackSchema` / session / downloads / player resolve 的 zod 增加 `musicTitle: z.string().optional()`、`musicArtist: z.string().optional()`

- [ ] **Step 1: Write the failing test**

在 `packages/main/src/trpc/routers/library.test.ts` 追加：

```ts
test('library.get 叠上 musicMeta 缓存', async () => {
	const playerDb = {
		...mockTrpcContext().playerDb,
		get: () => playlist,
	}
	const caller = libraryRouter.createCaller(
		mockTrpcContext({
			store: memoryStore({
				musicMeta: {
					s: {
						musicTitle: '夜に駆ける',
						musicArtist: 'YOASOBI',
						sourceHash: 'x',
					},
				},
			}),
			playerDb,
		}),
	)
	const result = await caller.get({ id: '1' })
	const song = result?.tracks.find((item) => item.id === 's')
	assert.equal(song?.title, '【翻唱】夜')
	assert.equal(song?.musicTitle, '夜に駆ける')
	assert.equal(song?.musicArtist, 'YOASOBI')
})
```

`resolvePlay` 改为：

```ts
const search = lyricSearchInput(
	{ title: track.title, musicTitle: track.musicTitle },
	preciseKeyword,
)
const raw = await fetchMatchedLyrics({
	title: search.title,
	durationSec: track.duration ?? 0,
	source: parseLyricSource(store.get('lyricSource')),
	preciseKeyword: search.preciseKeyword,
})
```

注意：现有 `preciseKeyword` 来自 `getPreciseMusicNameOnBilibiliVideo`（已是清洗后的 BGM 名）。把它作为 `lyricSearchInput` 的第二参 `bgmTitle`。有 BGM 时 `lyricSearchInput` 必须用 BGM，不能用 `musicTitle`。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/main/src/trpc/routers/library.test.ts`

Expected: FAIL，返回的 track 没有 `musicTitle`。

- [ ] **Step 3: Write minimal implementation**

`bili.video`：在 map 出 `pages`（含 `id` / `title` / `artist`）之后：

```ts
const filled = await fillMusicFields(
	{
		bvid: input.bvid,
		title: details.title,
		desc: details.desc,
		ownerName: details.owner.name,
		pages: pages.map((page, index) => ({
			id: page.id,
			part: details.pages[index]?.part || page.title,
		})),
		isMultiPage: details.pages.length > 1,
	},
	{ store: ctx.store },
)
const filledMap = new Map(filled.map((item) => [item.id, item]))
const withMusic = pages.map((page) => ({
	...page,
	...filledMap.get(page.id),
}))
```

`filterVideoPayload` 得到空 pages 时不要调用 `fillMusicFields`。

`library.get`、`session.get`、`downloads.list` 在返回前 `overlayMusicMeta(ctx.store, tracks)`。

`export-audio.ts`：`safeExportName(displayArtist(track), displayTitle(track))`，从 `@bbplayer/core` 导入。

- [ ] **Step 4: Run tests**

Run: `vp test packages/main/src/trpc/routers/library.test.ts packages/main/src/music-meta.test.ts packages/main/src/export-audio.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/main/src/bili.ts packages/main/src/trpc/routers/bili.ts packages/main/src/trpc/routers/library.ts packages/main/src/trpc/routers/session.ts packages/main/src/trpc/routers/downloads.ts packages/main/src/trpc/routers/player.ts packages/main/src/trpc/context.ts packages/main/src/db/types.ts packages/main/src/index.ts packages/main/src/export-audio.ts packages/renderer/src/playback.ts packages/main/src/trpc/routers/library.test.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(main): 拉稿件时写入歌名并供歌词搜索使用

EOF
)"
```

---

### Task 8: 设置页与界面展示

**Files:**

- Modify: `packages/renderer/src/app-context.tsx`
- Modify: `packages/renderer/src/routes/settings.tsx`
- Modify: `packages/renderer/src/NowPlaying.tsx`
- Modify: `packages/renderer/src/routes/index.tsx`
- Modify: `packages/renderer/src/App.tsx`
- Modify: `packages/renderer/src/components/library-track-list.tsx`
- Modify: `packages/renderer/src/routes/library/downloads.tsx`
- Modify: `packages/renderer/src/usePlayback.ts`

**Interfaces:**

- Consumes: `displayTitle`、`displayArtist`（`@bbplayer/core`）
- 设置：`musicAiBaseUrl` / `musicAiApiKey` / `musicAiModel`，空 Key 即关闭（主进程已处理）

- [ ] **Step 1: Write the failing test**

下载列表过滤改用 display 字段的话，在 `packages/renderer/src/routes/library/downloads.tsx` 抽一个纯函数到 `packages/renderer/src/music-track-text.ts`（若不愿新文件，就在 `playback.ts` 旁加 `trackMatchesQuery`）：

```ts
export function trackMatchesQuery(
	track: {
		title: string
		artist: string
		musicTitle?: string
		musicArtist?: string
	},
	q: string,
) {
	const hay = [track.title, track.artist, track.musicTitle, track.musicArtist]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()
	return hay.includes(q)
}
```

测试文件 `packages/renderer/src/music-track-text.test.ts`：搜「起风了」能命中 `musicTitle`，搜 UP 仍能命中 `artist`。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/music-track-text.test.ts`

Expected: FAIL，找不到模块。

- [ ] **Step 3: Write minimal implementation**

所有列出的 UI 用 `displayTitle(track)` / `displayArtist(track)` 替换直接读 `title` / `artist`。**不要**改搜索/收藏的 `SearchHit`（仍是稿件标题 + UP）。分 P 页大标题仍是 `video.title`。

`usePlayback` 的 `player.reportState` 传 display 字段。

设置页在歌词源 Field 下方增加「曲目解析」：三个 `Input`（Base URL、API Key `type="password"`、模型），`FieldDescription` 写：未填 Key 时不请求模型；默认智谱 GLM-4-Flash。变更经 `settings.set` 写入。`app-context` 从 `settings.get` 读出并提供 setter。

- [ ] **Step 4: Run tests and check**

Run: `vp test packages/renderer/src/music-track-text.test.ts && vp check && pnpm type-check`

Expected: PASS，无新的 lint / 类型错误。

- [ ] **Step 5: Commit**

```bash
git add packages/renderer/src/music-track-text.ts packages/renderer/src/music-track-text.test.ts packages/renderer/src/app-context.tsx packages/renderer/src/routes/settings.tsx packages/renderer/src/NowPlaying.tsx packages/renderer/src/routes/index.tsx packages/renderer/src/App.tsx packages/renderer/src/components/library-track-list.tsx packages/renderer/src/routes/library/downloads.tsx packages/renderer/src/usePlayback.ts
git commit -m "$(cat <<'EOF'
:sparkles: feat(renderer): 播放界面展示解析歌名并配置模型

EOF
)"
```

---

## Self-review

- 展示回退、规则/JSON、缓存、OpenAI 调用、整篇填充、设置、bili.video/叠加/歌词、UI：均有对应 Task
- 无 TBD；并发 2、8s 超时、BGM 覆盖、空 Key 关闭、不预解析列表、不改 SQLite 均写入任务
- 名称统一：`musicTitle` / `musicArtist` / `fillMusicFields` / `lyricSearchInput` / `completeMusicAi`
