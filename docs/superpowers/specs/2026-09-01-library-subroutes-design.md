# 音乐库分级与子路由

日期：2026-09-01  
范围：`packages/renderer` 客户端路由与音乐库页面拆分；不改主进程协议，不新做共享/导入

## 目标

把现在叠在 `/library` 上的「目录 + 当前打开的列表」拆成原仓库同构的两级：

1. **目录**：四个分段（播放列表 / 收藏夹 / 合集 / 分 p）
2. **详情**：点进某一份清单后换页，URL 带 id，后退回到对应分段

成功标准：

- 侧栏「音乐库」在整棵 `/library/*` 下保持选中
- 刷新 `#/library/favorites/<id>` 仍打开同一收藏夹，不丢回封面墙
- 系统后退从详情回到该分段，而不是主页
- 目录页不再同时渲染「封面墙 + 当前曲目列表」
- `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 搜索结果页、UP 主页、排行榜（奖杯）
- 外部歌单导入、订阅共享、动态合并（加号菜单可占位，不接通）
- 共享成员、同步到 B 站、拖拽排序等详情页完整 PRD 能力
- 改 tRPC / 主进程库表

搜索仍从主页发起。BVID 可落入 `/library/multipage/$bvid`；关键词结果本期不占用音乐库目录。

## 对照原仓库

原仓库 Expo Router：

| 层     | 路径                                                                                           | 壳                          |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------- |
| 目录   | `(tabs)/library/[tab]`                                                                         | 标题 + 下载/奖杯 + 四个页签 |
| 详情   | `playlist/local/[id]`、`remote/favorite/[id]`、`collection/[id]`、`multipage/[bvid]`、`toview` | 独立栈，无页签              |
| 已下载 | `/downloaded`                                                                                  | 独立页                      |

桌面端侧栏要在详情里仍高亮「音乐库」，所以详情挂在 `/library/...` 下，而不是平行的 `/playlist/...`。

## 路由树

Hash History，实际地址形如 `#/library/favorites/123`。

```
/library                          布局：只提供 Outlet
  ├─ _catalog（pathless）         目录壳：标题「音乐库」+ 下载 + 奖杯(禁用) + 四个分段 + Outlet
  │    ├─ /library                播放列表（默认）
  │    ├─ /library/favorites      收藏夹
  │    ├─ /library/collections    合集
  │    └─ /library/multipage      分 p
  ├─ /library/playlists/$id       本地歌单详情
  ├─ /library/favorites/$id       收藏夹详情
  ├─ /library/collections/$id     合集详情
  ├─ /library/multipage/$bvid     分 P 列表
  ├─ /library/watch-later         稍后再看
  └─ /library/downloads           已下载
```

没有 `/library/playlists` 列表页：列表就是 `/library`，详情才是 `/library/playlists/$id`。

文件（插件生成 `createFileRoute` 路径，不手改 `routeTree.gen.ts`）：

```
packages/renderer/src/routes/library/route.tsx
packages/renderer/src/routes/library/_catalog/route.tsx
packages/renderer/src/routes/library/_catalog/index.tsx
packages/renderer/src/routes/library/_catalog/favorites.tsx
packages/renderer/src/routes/library/_catalog/collections.tsx
packages/renderer/src/routes/library/_catalog/multipage.tsx
packages/renderer/src/routes/library/playlists.$id.tsx
packages/renderer/src/routes/library/favorites.$id.tsx
packages/renderer/src/routes/library/collections.$id.tsx
packages/renderer/src/routes/library/multipage.$bvid.tsx
packages/renderer/src/routes/library/watch-later.tsx
packages/renderer/src/routes/library/downloads.tsx
```

删掉现有扁平的 `routes/library.tsx`。

## 壳

**目录壳**（仅 `_catalog` 匹配时）：

```
音乐库                              [下载] [奖杯]
播放列表  收藏夹  合集  分 p
────────────────────────────────
分段自己的标题 / 计数 / 搜索 / 加号
封面网格或空态
```

- 分段是 `Link`，当前分段用 `secondary`（或等价选中态）
- 「下载」→ `/library/downloads`（详情壳）
- 「奖杯」禁用，tooltip「即将推出」
- 未登录时收藏夹 / 合集 / 分 p 仍可点进该分段，内容区是登录引导，不拉远程列表

**详情壳**（`_catalog` 不匹配）：

```
[← 返回]     面包屑或仅返回
封面  标题
      n 首歌曲 · 作者或同步信息
      [播放全部]  [同步到本地]（仅在线源）
曲目列表
```

返回用相对导航：`Link from={Route.fullPath} to=".."`。  
`/library/playlists/$id` 的 `..` 是 `/library`；`/library/favorites/$id` 的 `..` 是 `/library/favorites`。

侧栏：`Link to="/library"`，选中条件改为路径以 `/library` 开头，不再 `pathname === '/library'`。

## 各分段内容

### 播放列表 `/library`

- 计数：「{n} 个播放列表」
- 搜索：「搜索播放列表」（本地过滤标题）
- 已登录时网格第一项虚拟「稍后再看」，点进 `/library/watch-later`
- 其后本地歌单封面，点进 `/library/playlists/$id`
- 空：「没有播放列表」
- 创建：保留现有标题输入 +「创建播放列表」；成功后 `navigate` 到新歌单详情
- 右键删除仍留在目录，不进详情

已下载不再作为播放列表里的封面项（与 PRD 右上角入口对齐）。

### 收藏夹 `/library/favorites`

- 已登录：列出收藏夹；标题以 `[mp]` 开头的不出现
- 点进 `/library/favorites/$id`
- 未登录：文案「登录 bilibili 账号后才能查看合集」+「登录」（跳转设置页；三个需登录分段共用这段引导）
- 空：「没有收藏夹」

### 合集 `/library/collections`

- 已登录：合集封面网格 → `/library/collections/$id`
- 未登录：同上登录引导
- 空态按现有远程列表为空处理

### 分 p `/library/multipage`

- 列出 `[mp]` 收藏夹里的视频（不是夹本身）
- 点进 `/library/multipage/$bvid`
- 找不到 `[mp]` 夹：「未找到分 P 视频收藏夹，请先创建一个收藏夹，并以 [mp] 开头」
- 未登录：登录引导

本期若主进程还没有「只返回 [mp] 视频」的专用接口，分 p 分段可以先做空态 + 上述文案，不发明假数据。详情 `/library/multipage/$bvid` 可复用现有 `bili.video`。

## 详情页数据

不再用 `app-context` 的 `listTitle` / `hits` / `pages` / `activePlaylistId` 当路由器。

| 路由              | 数据                                                      |
| ----------------- | --------------------------------------------------------- |
| `playlists/$id`   | `library.get({ id })`，没有则 `notFound()`                |
| `favorites/$id`   | `bili.favorite({ id })`                                   |
| `collections/$id` | `bili.collection({ id })`                                 |
| `multipage/$bvid` | `bili.video({ bvid })`                                    |
| `watch-later`     | `bili.watchLater()`                                       |
| `downloads`       | 现有 downloads 列表；搜索「搜索已下载歌曲」；导出按钮保留 |

目录上的 `playlists` / `favorites` / `collections` 仍可从 context 的缓存读，或各分段自己 query；详情必须按 URL params 拉，保证刷新。

`openPlaylist` / `openFavorite` / `openCollection` / `openWatchLater` / `openDownloads` 改为 `navigate({ to, params })`。创建歌单成功同样进详情。

曲目点播放仍 `navigate({ to: '/player' })` + 现有 `startPlay`。

## 组件边界

从现有 `library.tsx` 拆出可测、可复用的块，路由文件只负责壳和数据：

- `LibraryCatalogHeader`：标题、下载、奖杯、分段
- 封面网格沿用 `CoverFace` / `CoverMeta`
- 曲目行从现有列表抽出，目录页不再引用

`app-context` 继续持有账号、本地歌单摘要、播放器、远程库摘要；删掉「当前打开哪张列表」相关状态。

## 已知交互

- 从主页搜收藏夹/合集链接：仍走现有 match，成功后 `navigate` 到对应详情，而不是 `showRemoteVideos` 再进 `/library`
- 从主页搜 BVID：进 `/library/multipage/$bvid`
- 关键词搜索：留在主页或维持现有 hits 展示于主页，不写进目录页
- 播放页、设置页不变

## 测试

`packages/renderer/src/router.test.ts` 增补：

- `/library` 匹配目录 index
- `/library/favorites`、`/library/collections`、`/library/multipage` 匹配对应分段
- `/library/playlists/abc` 匹配详情，且 match 里没有 `_catalog` 分段条路由也可接受（断言详情 routeId 存在即可）
- `/library/downloads`、`/library/watch-later` 可匹配
- 未知 `/library/nope` 走 404 splat

另测：侧栏选中逻辑对 `/library/playlists/abc` 为真。

## Figma 设计稿

文件页：**BBPlayer**（community kit「shadcn/ui components with variables & Tailwind classes」）。桌面窗 1024×640，侧栏「音乐库」在整棵子树保持选中。灰字 `#/library/...` 是路由标注，实现时不要画进 UI。

主按钮用 kit 里的 shadcn 黑 Default，不要改成产品粉。

| 窗                     | 节点         | 路由                              |
| ---------------------- | ------------ | --------------------------------- |
| Library / 播放列表     | `4009:11377` | `#/library`                       |
| Library / 收藏夹       | `4063:2693`  | `#/library/favorites`             |
| Library / 收藏夹未登录 | `4063:3348`  | `#/library/favorites`             |
| Library / 合集         | `4063:6518`  | `#/library/collections`           |
| Library / 分 p         | `4063:4000`  | `#/library/multipage`             |
| Library / 本地歌单     | `4063:4641`  | `#/library/playlists/pl_local_01` |
| Library / 收藏夹详情   | `4063:5271`  | `#/library/favorites/114514`      |
| Library / 合集详情     | `4063:7821`  | `#/library/collections/ss_01`     |
| Library / 稍后再看     | `4063:7191`  | `#/library/watch-later`           |
| Library / 已下载       | `4063:5904`  | `#/library/downloads`             |

原型：分段互跳、封面进详情、「下载」进已下载、「← 返回」回对应目录、未登录「登录」进 Settings、主页侧栏「音乐库」进播放列表。奖杯 Disabled，无热区。

## 验收

1. 点音乐库看到四个分段，默认播放列表，没有底下那一长串「当前打开的歌」
2. 点本地歌单进入详情，URL 含 id；后退回到播放列表
3. 点收藏夹进入详情，后退回到收藏夹分段
4. 未登录点收藏夹分段看到登录引导
5. 右上角下载进入已下载页，无分段条；后退回目录
6. 刷新详情 URL 仍是该列表
