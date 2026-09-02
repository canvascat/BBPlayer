# Library Subroutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把扁平 `/library` 拆成目录四分段 + URL 详情，侧栏在整棵 `/library/*` 下保持选中。

**Architecture:** TanStack file routes 在 `routes/library/` 下用 pathless `_catalog` 包四分段；详情与已下载、稍后再看是 `/library` 的兄弟子路由。详情按 URL params 调现有 tRPC，不再用 `listTitle` / `pages` / `activePlaylistId` 当路由器。关键词搜索结果回到主页。

**Tech Stack:** TanStack Router file routes、现有 tRPC client、Vitest（`vp test`）、shadcn Button / Empty / Input / Tooltip。不改主进程。

## Global Constraints

- Hash History，地址形如 `#/library/favorites/123`
- 不手改 `createFileRoute` 路径字符串以外的 `routeTree.gen.ts` 逻辑；用 Router plugin / `@tanstack/router-generator` 重生
- 不改 tRPC / 主进程库表
- 奖杯 Disabled，tooltip「即将推出」
- 未登录收藏夹/合集/分 p 共用文案「登录 bilibili 账号后才能查看合集」+「登录」→ `/settings`
- `[mp]` 开头收藏夹不出现在收藏夹分段
- 已下载不再作为播放列表封面项
- 关键词搜索不进目录页；BVID → `/library/multipage/$bvid`；收藏夹/合集链接 → 对应详情
- 命令在仓库根目录：`vp test`、`vp check`、`pnpm type-check`
- 用户未要求 commit：本计划执行时不 git commit

对照 spec：`docs/superpowers/specs/2026-09-01-library-subroutes-design.md`

---

## File map

**Create:**

- `packages/renderer/src/library-nav.ts` — `isLibraryPath`、`nonMultipageFavorites`、`multipageFavorite`
- `packages/renderer/src/library-nav.test.ts`
- `packages/renderer/src/components/library-catalog-header.tsx`
- `packages/renderer/src/components/library-login-gate.tsx`
- `packages/renderer/src/components/library-track-list.tsx`
- `packages/renderer/src/routes/library/route.tsx`
- `packages/renderer/src/routes/library/_catalog/route.tsx`
- `packages/renderer/src/routes/library/_catalog/index.tsx`
- `packages/renderer/src/routes/library/_catalog/favorites.tsx`
- `packages/renderer/src/routes/library/_catalog/collections.tsx`
- `packages/renderer/src/routes/library/_catalog/multipage.tsx`
- `packages/renderer/src/routes/library/playlists.$id.tsx`
- `packages/renderer/src/routes/library/favorites.$id.tsx`
- `packages/renderer/src/routes/library/collections.$id.tsx`
- `packages/renderer/src/routes/library/multipage.$bvid.tsx`
- `packages/renderer/src/routes/library/watch-later.tsx`
- `packages/renderer/src/routes/library/downloads.tsx`

**Modify:**

- `packages/renderer/src/router.test.ts` — 子路由匹配
- `packages/renderer/src/App.tsx` — 侧栏 `isLibraryPath`
- `packages/renderer/src/app-context.tsx` — navigate 到详情；去掉列表路由状态
- `packages/renderer/src/routes/index.tsx` — 关键词/UP 主搜索结果
- `packages/renderer/src/routeTree.gen.ts` — 生成，不手写逻辑

**Delete:**

- `packages/renderer/src/routes/library.tsx`

---

### Task 1: 侧栏选中与收藏夹过滤纯函数

**Files:**

- Create: `packages/renderer/src/library-nav.ts`
- Create: `packages/renderer/src/library-nav.test.ts`

**Interfaces:**

- Produces: `isLibraryPath(pathname: string): boolean`、`nonMultipageFavorites<T extends { title: string }>(folders: T[]): T[]`、`multipageFavorite<T extends { title: string }>(folders: T[]): T | undefined`

- [ ] **Step 1: Write the failing test**

```ts
import { assert, test } from 'vitest'

import {
	isLibraryPath,
	multipageFavorite,
	nonMultipageFavorites,
} from './library-nav.ts'

test('侧栏在整棵 /library 子树保持选中', () => {
	assert.equal(isLibraryPath('/'), false)
	assert.equal(isLibraryPath('/settings'), false)
	assert.equal(isLibraryPath('/library'), true)
	assert.equal(isLibraryPath('/library/favorites'), true)
	assert.equal(isLibraryPath('/library/playlists/abc'), true)
	assert.equal(isLibraryPath('/libraryish'), false)
})

test('[mp] 收藏夹只出现在分 p 分段', () => {
	const folders = [
		{ title: '默认收藏夹' },
		{ title: '[mp] 分P' },
		{ title: '现场' },
	]
	assert.deepEqual(
		nonMultipageFavorites(folders).map((item) => item.title),
		['默认收藏夹', '现场'],
	)
	assert.equal(multipageFavorite(folders)?.title, '[mp] 分P')
	assert.equal(multipageFavorite([{ title: '默认收藏夹' }]), undefined)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/library-nav.test.ts`

Expected: FAIL，模块不存在

- [ ] **Step 3: Write minimal implementation**

```ts
export function isLibraryPath(pathname: string) {
	return pathname === '/library' || pathname.startsWith('/library/')
}

export function nonMultipageFavorites<T extends { title: string }>(
	folders: T[],
) {
	return folders.filter((folder) => !folder.title.startsWith('[mp]'))
}

export function multipageFavorite<T extends { title: string }>(folders: T[]) {
	return folders.find((folder) => folder.title.startsWith('[mp]'))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test packages/renderer/src/library-nav.test.ts`

Expected: PASS

---

### Task 2: 路由匹配测试与空壳文件

**Files:**

- Modify: `packages/renderer/src/router.test.ts`
- Create: 全部 `routes/library/**` 空壳（Outlet / 占位标题）
- Delete: `packages/renderer/src/routes/library.tsx`
- Generate: `packages/renderer/src/routeTree.gen.ts`

**Interfaces:**

- Consumes: 无
- Produces: 可 `router.load()` 的 route IDs：`/library`、`/library/_catalog/`、`/library/favorites`、`/library/collections`、`/library/multipage`、`/library/playlists/$id`、`/library/downloads`、`/library/watch-later`；未知 `/library/nope` 走 `/$`

- [ ] **Step 1: Write the failing tests**（在现有 `主页、音乐库…` 测试之后追加）

```ts
test('音乐库目录与详情子路由可匹配', async () => {
	const catalog = [
		['/library', '/library/_catalog/'],
		['/library/favorites', '/library/favorites'],
		['/library/collections', '/library/collections'],
		['/library/multipage', '/library/multipage'],
	] as const
	for (const [pathname, routeId] of catalog) {
		const router = await loadAt(pathname)
		assert.equal(router.state.location.pathname, pathname)
		assert.ok(
			router.state.matches.some((match) => match.routeId === '/library'),
		)
		assert.ok(
			router.state.matches.some((match) => match.routeId === routeId),
			`expected ${routeId} in ${router.state.matches.map((m) => m.routeId).join(',')}`,
		)
	}

	const detail = await loadAt('/library/playlists/abc')
	assert.ok(
		detail.state.matches.some(
			(match) => match.routeId === '/library/playlists/$id',
		),
	)
	assert.ok(
		!detail.state.matches.some((match) =>
			match.routeId.startsWith('/library/_catalog'),
		),
	)

	for (const [pathname, routeId] of [
		['/library/downloads', '/library/downloads'],
		['/library/watch-later', '/library/watch-later'],
	] as const) {
		const router = await loadAt(pathname)
		assert.ok(router.state.matches.some((match) => match.routeId === routeId))
	}
})

test('未知音乐库路径进入 404', async () => {
	const router = await loadAt('/library/nope')
	assert.ok(router.state.matches.some((match) => match.routeId === '/$'))
})
```

若生成后 index 的 routeId 不是 `/library/_catalog/`，按 `routeTree.gen.ts` 实际 id 改断言，不要手改生成器输出。

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test packages/renderer/src/router.test.ts`

Expected: FAIL（仍只有扁平 `/library`）

- [ ] **Step 3: 建目录路由空壳并重生 route tree**

每个文件 `createFileRoute` 路径必须与文件位置一致。布局只渲染 `<Outlet />`。叶子渲染一个 `h1` 占位即可。

用 `@tanstack/router-generator` 的 `Generator` 或 Vite plugin 重生 `routeTree.gen.ts`。核对 diff 里的 parent / path，不要手补 children 图。

- [ ] **Step 4: Run tests**

Run: `vp test packages/renderer/src/router.test.ts packages/renderer/src/library-nav.test.ts`

Expected: PASS

---

### Task 3: 目录壳与四分段

**Files:**

- Create: `packages/renderer/src/components/library-catalog-header.tsx`
- Create: `packages/renderer/src/components/library-login-gate.tsx`
- Modify: `_catalog/route.tsx` 与四个分段文件

**Interfaces:**

- Consumes: `isLibraryPath` 不在此任务；`nonMultipageFavorites` / `multipageFavorite`；`useApp()` 的 `account` / `playlists` / `favorites` / `collections` / `watchLaterCount` / `createTitle` / `createLocalPlaylist` / `deletePlaylist`
- Produces: `LibraryCatalogHeader`、`LibraryLoginGate`

目录壳：

```
音乐库                    [下载 Link→/library/downloads] [奖杯 disabled tooltip 即将推出]
播放列表 收藏夹 合集 分 p   （Link，当前段 variant=secondary，其余 ghost，size=sm）
<Outlet />
```

分段内容按 spec：搜索过滤、封面 `CoverFace`/`CoverMeta`、`coverGridClass`。播放列表创建成功 `navigate({ to: '/library/playlists/$id', params: { id } })`。

未登录三分段渲染 `LibraryLoginGate`（Empty + 登录 Link `/settings`）。

分 p：未登录 → gate；已登录无 `[mp]` 夹 → Empty「未找到分 P 视频收藏夹，请先创建一个收藏夹，并以 [mp] 开头」；有夹则 `bili.favorite` 拉视频，封面点进 `/library/multipage/$bvid`。

- [ ] **Step 1–4:** 实现目录 UI；`vp test packages/renderer/src/router.test.ts` 仍 PASS

---

### Task 4: 详情页、曲目行、已下载

**Files:**

- Create: `packages/renderer/src/components/library-track-list.tsx`
- Modify: `playlists.$id.tsx`、`favorites.$id.tsx`、`collections.$id.tsx`、`multipage.$bvid.tsx`、`watch-later.tsx`、`downloads.tsx`

**Interfaces:**

- Consumes: `trpcClient.library.get` / `bili.favorite` / `bili.collection` / `bili.watchLater` / `bili.video`；`useApp().startPlay` / `downloads` / `exportCached` / `downloadTasks`
- Produces: `LibraryTrackList`（曲目行 + 右键菜单，从旧 `library.tsx` 抽出）；`playlistId?: string` 时显示「从列表中移除」

返回：`Link from={Route.fullPath} to='..'`。无分段条。

- 本地歌单：`library.get`，没有 `notFound()`
- 收藏夹/合集/稍后再看：视频行；点击 `bili.video` 后 `startPlay(pages, 0)`；「播放全部」播第一首视频的分 P（不新造假数据）
- 分 P 详情：`bili.video` 的 `pages` 当曲目
- 已下载：搜索「搜索已下载歌曲」+「导出」；列表来自 `downloads`，不经过 `listTitle`

- [ ] **Step 1–4:** 实现详情；路由测试仍 PASS

---

### Task 5: app-context 导航与主页搜索

**Files:**

- Modify: `packages/renderer/src/app-context.tsx`
- Modify: `packages/renderer/src/routes/index.tsx`
- Modify: `packages/renderer/src/App.tsx`

**Interfaces:**

- `openPlaylist(id)` → `navigate({ to: '/library/playlists/$id', params: { id } })`（不再 setListTitle）
- `openFavorite` / `openCollection` 同理走详情 path
- `openWatchLater` → `/library/watch-later`
- `openDownloads` → `/library/downloads`
- `submitSearch`：BVID → `/library/multipage/$bvid`；FAVORITE/COLLECTION → 详情；SEARCH/UPLODER → `setHits` 且 `navigate({ to: '/' })`
- 删除 `listTitle`、`activePlaylistId`、`pages`（播放队列仍在 `usePlayback`）、`visiblePages`；`hits` 留给主页
- 下载订阅不再写 `pages`
- `App.tsx`：`variant={isLibraryPath(pathname) ? 'secondary' : 'ghost'}`
- 主页：`hits.length > 0` 时封面墙，点击进 `/library/multipage/$bvid`

- [ ] **Step 1–4:** 改导航；`vp test packages/renderer/src/router.test.ts packages/renderer/src/library-nav.test.ts`

---

### Task 6: 全量校验

- [ ] `vp test`
- [ ] `vp check`
- [ ] `pnpm type-check`

Expected: 全部通过。若 `createFileRoute` 路径与生成器不一致，改文件名/路径后重生，不要手补 `routeTree.gen.ts`。

---

## Spec coverage

| Spec                           | Task |
| ------------------------------ | ---- |
| 四分段目录壳、奖杯禁用         | 3    |
| 详情无分段条、相对返回、URL id | 4    |
| 侧栏前缀选中                   | 1, 5 |
| 刷新详情靠 URL                 | 4, 5 |
| 未登录引导                     | 3    |
| 已下载独立页                   | 4    |
| `[mp]` 过滤与分 p 空态         | 1, 3 |
| 搜索分流                       | 5    |
| router.test 增补               | 2    |
| 不改 tRPC                      | 全程 |
