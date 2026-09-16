# B 站视频章节拆成多首歌

日期：2026-09-07  
范围：`packages/core` 身份键与章节规范化；`packages/main` 稿件详情、歌词/音频缓存、`player.resolve`；`packages/renderer` 播放窗口与连播。不改 SQLite schema，不新增设置项。

## 目标

单 P 合辑（例如 [BV147tJ66EZV](https://www.bilibili.com/video/BV147tJ66EZV/)）带 B 站章节时，按章拆成多条可播曲目：队列里像分 P，切歌是同一音频上的 seek，每章单独匹配歌词。

成功标准：

- 打开该稿件后，`pages[]` 是各章（「跨时代」「说了再见」…），不是一条 45 分钟曲目
- 播某一章时进度条、歌词、单曲循环都只对应该章时长
- 同 `cid` 连播不换 `audio.src`
- 整段音频只缓存一份；歌词和偏移按章
- 有窗口的曲目不用整片 `bgm_info` 覆盖歌名
- 未拆章的稿件与旧队列行为不变
- `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 进度条章节刻度、独立章节浏览 UI
- 搜索 / 收藏夹 / 合集 / 稍后再看列表预拆成多首
- 多分 P 稿件再按章拆
- 一章一份音频文件
- 新设置开关、SQLite、歌单分享协议
- 用评论/弹幕辅助分章

## 曲目模型

一章 = 一条 `TrackItem` / `LibraryTrack`，与分 P 一样进 `pages[]`、队列、本地歌单。比现在多两个可选字段：

| 字段           | 含义                                    |
| -------------- | --------------------------------------- |
| `clipStartSec` | `view_points.from`（秒，含 0）          |
| `clipEndSec`   | `view_points.to`（秒）                  |
| `duration`     | `clipEndSec - clipStartSec`（本章时长） |
| `title`        | 章节名（`content`）                     |
| `tid`          | 稿件 `tid`                              |
| `artist`       | UP 名                                   |
| `artwork`      | 稿件封面                                |

「有窗口」= `clipStartSec` 与 `clipEndSec` 都是有限数字（起点可以是 0）。缺任一字段 = 现在的整段播放。

`session` / `library` / `player.resolve` / 下载入队用的 Zod 曲目对象都加上这两个可选数字。下载**文件记录**仍按音频键，不按章拆条。SQLite 不新增列：写入歌单时 `unique_key` 用章节键，`duration` 用章节时长；读回时从键还原 `clipStartSec` / `clipEndSec`。

会话 `positionMs` 存**窗口内**进度（与对外 `currentTime` 一致）。恢复时 `playTrack` 把 `seekMs` 当作窗口时间：有窗口则 `audio.currentTime = clipStartSec + seekMs/1000`。

## 身份键

扩展 `generateUniqueTrackKey`，并提供从键还原 clip 的纯函数（歌单从 SQLite 读回时没有 clip 列，只能靠键）：

| 曲目     | 键                                      |
| -------- | --------------------------------------- |
| 普通单 P | `bilibili::{bvid}`                      |
| 分 P     | `bilibili::{bvid}::{cid}`               |
| 章节     | `bilibili::{bvid}::{cid}::{from}::{to}` |

`from` / `to` 为 `Math.round` 后的秒。第一章可以是 `…::0::{to}`。有窗口时必须带 `cid`，即使稿件只有一 P。

旧键不变。歌词偏移、`musicMeta`、歌单、队列都用曲目 `id`。分享协议字段不改；`unique_key` 可以是更长的章节键，旧端会当普通 cid 整段播。

音频缓存键不含 `from` / `to`：

- 章节 / 分 P：`bilibili::{bvid}::{cid}`
- 无窗口单 P：仍 `bilibili::{bvid}`

## 何时拆章

发生在 `bili.video`，返回前写好 `pages[]`。搜索等列表不预拉章节。直接打开 BV 已进 `/library/multipage/$bvid`，拆完会自然变成曲目列表。收藏夹「播放」走 `video.pages`，会播各章。

读 `view_points` 的条件（同时满足）：

1. `details.pages.length === 1`
2. `isSongVideo({ tid, title })` 为真，**或** store 里有非空 `musicAiApiKey`

否则当普通一首，不请求播放器接口。

数据来自 `GET /x/player/wbi/v2`（`bvid` + `cid`）的 `view_points[]`：`content`、`from`、`to`。`bili.video` 为拆章请求这一次；有窗口的 `resolvePlay` 不再请求 v2。无窗口曲目仍在播放时请求 v2 取 BGM。拆章失败不得让 `bili.video` 抛错。不做成会话级 v2 缓存。

规范化（纯函数，放 `packages/core`）：

1. 按 `from` 升序
2. 缺 `to`：用下一章 `from`；最后一章用稿件 `duration`
3. `from >= to`，或 `content` 缺失 / trim 后为空的丢掉
4. 有效章少于 2 → 不拆

多分 P：忽略章节。

## 歌名与 AI

拆出的章当作 `fillMusicFields` 的 `pages`，`part` = 章节名，`id` = 章节键。`isMultiPage` 视为 true（多条曲目）。

章节曲目**禁止**用稿件标题里的 `《…》` / `「…」` 当歌名（否则《跨时代》会写到每一章）。规则只从**章名**和简介标签猜；章名无书名号时，用现有 `cleanKeyword(章名)` 作为 `musicTitle` 候选。

有 AI 时仍整篇一次请求，输入各章 `part`。system 可注明这些是视频章节。合并规则与现在相同，并多一步：

- `kind === "not_music"` 且 `confidence === "high"` → 该章不进入 `pages[]`（片头、口播、花絮）
- 丢掉后有效章少于 2 → 整篇不拆，退回单曲

没 AI：能拆就全拆，不猜哪章不是歌。

AI 超时 / 非 JSON / 4xx：静默；若规范化后仍 ≥2 章则按章名全拆。不把错误抛给点播。

有窗口的曲目在 `resolvePlay` **不读、不采用** 整片 `bgm_info.music_title`（通常是第一首或当前 BGM）。无窗口曲目保持现在的 BGM 覆盖。

## 播放窗口

`<audio>` 仍是整段文件。`usePlayback` 对外的 `currentTime` / `duration` 是窗口时间，Now Playing、底栏、系统媒体信息不用知道 clip。

| 动作           | 行为                                                               |
| -------------- | ------------------------------------------------------------------ |
| 开播           | `audio.currentTime = clipStartSec`（无窗口则 0）                   |
| 界面进度       | `now = audioTime - clipStart`，总长 `clipEnd - clipStart`          |
| 拖进度 / ±5 秒 | 加回起点，夹在 `[clipStart, clipEnd]`                              |
| 点歌词         | `clipStart + 行时间 + 偏移`（LRC 从 0，时钟用窗口内 `now`）        |
| `timeupdate`   | `audioTime >= clipEnd`：单曲循环则回到 `clipStart`，否则 `skip(1)` |
| `ended`        | 只处理**无窗口**曲目；有窗口只靠 `clipEnd`                         |

同 `bvid+cid` 切到下一章：不换 `audio.src`（即使 `resolve` 返回了新 URL），只 seek 到新窗口并换歌词。仍调用 `player.resolve` 取歌词。`bvid`/`cid` 变了才换源。

无 clip 字段的旧队列：整条链路与现在相同。

## 缓存与歌词

**音频：** 入队、命中、文件名用音频键。播合辑任一章都共用一份 m4a。下载列表一条：`id` 为音频键，`title` 用稿件标题（不是章名），时长整段。删除该条即删整份文件。

**歌词 / 偏移：** 键为曲目 `id`（含 `from` 与 `to`）。歌词不写进专辑那条 `CachedTrack`。`electron-store` 增加 `trackLyrics: Record<string, LyricPayload>`；旧的无窗口记录仍可从 `CachedTrack.lyrics` 回退。

`player.resolve` 仍一次返回 `playUrl + lyrics`。渲染进程同 cid 连播只用新歌词。

有窗口时匹配：

- 关键词：`musicTitle` → 否则清洗后的章节名（`lyricSearchInput`，不拼歌手）
- `durationSec`：章节时长，给 QQ/酷狗 ±3 秒挑选
- 不请求 / 不使用 `bgm_info`

匹配失败仍播放，状态「暂无匹配歌词」。

手动点下载时若入参是章节曲目，文件仍按音频键入队，不得按章 id 再下一份。

## 过滤非歌曲

「过滤非歌曲」仍只在稿件级用 `tid` + 稿件标题判定（现有 `filterVideoPayload`）。过门之后再拆章。章曲目带上稿件 `tid`，列表过滤不会误伤「说了再见」这种没有歌曲关键词的章名。

## 失败回退

- 播放器接口失败、超时、无 `view_points`、规范化后 <2 章 → 单曲
- AI 丢掉后 <2 章 → 不拆
- 某章歌词失败 → 照常播
- 旧队列无 clip → 整段播

不新增设置。不改 SQLite。

## 测试

不打真实 B 站或歌词源。

- 身份键：有/无窗口；`from === 0`；从键还原 clip；旧单 P / 分 P 键不变
- 规范化：排序、补 `to`、丢弃非法章、不足 2 章不拆、多 P 不拆
- 章节歌名：不用稿件书名号；`cleanKeyword(章名)` 可作候选
- AI：`not_music` + high 丢掉；丢掉后 <2 不拆；失败则按章名全拆
- 窗口：界面时间映射、seek/歌词/±5s 夹紧、章末循环 vs 切歌
- 缓存键：音频只有 `bvid+cid`，歌词/偏移用章节键
- 有窗口时 `lyricSearchInput` / resolve 不用 BGM
- 会话 / 歌单 schema 接受 clip 字段；无 clip 的旧数据仍合法；SQLite 读回靠键还原窗口
