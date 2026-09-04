# 稿件曲名 / 歌手解析

日期：2026-09-04  
范围：`packages/main` 稿件详情、OpenAI 兼容调用、缓存与歌词关键词；`packages/renderer` 设置页与曲目展示。不改音轨抓取、SPL/AMLL 解析。

## 目标

B 站稿件的 `title` / `owner` 是视频标题和 UP，不是歌名和歌手。在拉稿件详情时解析出 `musicTitle` / `musicArtist`，用于 Now Playing 展示和歌词搜索。播放过程不再等模型。

成功标准：

- 未配置 API Key 时，行为与现在完全一致
- 点播一条（已经会等 `bili.video`）时，进队列的曲目已带解析结果；Now Playing 不先闪稿件标题
- `resolvePlay` 不调用模型；有 `bgm_info.music_title` 时覆盖歌词用的歌名
- 歌词搜索只用歌名，不拼歌手
- `vp check`、`vp test`、`pnpm type-check` 通过

## 非目标

- 不把评论、分区、弹幕送给模型
- 不接 Ollama / 本地模型（设置已是 OpenAI 兼容，以后只换 Base URL）
- 不覆盖曲目身份：`title` / `artist` 仍是稿件标题和 UP
- 不在搜索 / 收藏夹 / 合集 / 稍后再看的视频列表上预解析
- 不做手动搜歌词、不改歌词源竞速
- 不改 SQLite schema、不改歌单分享协议

## 时机

解析发生在 `bili.video`（`GET /x/web-interface/view`）内，返回前写好每 P 的 `musicTitle` / `musicArtist`。

同一请求启用现在没读的简介 `desc`（截断到约 2000 字再参与规则和模型）。不另打接口。

`resolvePlay` 只负责：读队列上已有的 `musicTitle`、再用 `bgm_info` 覆盖歌词关键词、拉歌词。不调 GLM。

点击搜索或收藏里的一条，本来就要等 `bili.video`。多出来的是仍缺歌名或歌手且已配 Key 时一次 GLM（约 200–500ms），卡在开播前，不卡在播放中。

## 流水线

对一篇稿件的每一 P：

1. 播放器 BGM 不在此步（见「播放时覆盖」）
2. 规则：分 P `part` 或稿件标题里的 `《…》` / `「…」`；简介里的 `原唱` / `翻唱` / `曲：` / `歌名：` 一类标签
3. 任一分 P 仍缺高把握歌名或歌手，且 store 里有非空 API Key → **整篇稿件一次** GLM，输入所有分 P 的 `part`，不要一 P 打一次
4. 合并：该 P 规则已有歌名则保留，只用 AI 补 `confidence === "high"` 的歌手；规则没有歌名时才采用 AI 的 title/artist（须 `confidence === "high"` 且 `kind !== "not_music"`）
5. 模型非 JSON、index 对不上、字段为 null → 该 P 当没解析
6. 写入缓存后随 `pages[]` 返回

全局同时最多 **2** 个 GLM 请求（收藏夹「同步到本地」会 `Promise.all(bili.video)`）。缓存命中的不占名额。

## 缓存

存在主进程 `electron-store` 的 `musicMeta`：

- 键：与播放 id 相同（`bilibili::{bvid}` 或 `bilibili::{bvid}::{cid}`）
- 值：`{ musicTitle?: string, musicArtist?: string, sourceHash: string }`
- `sourceHash`：稿件标题 + 简介 + 各 `part` 的短哈希；对不上则作废重解析

读出歌单、会话队列、下载记录里的 `TrackItem` 时，主进程按 id 叠上缓存字段，避免本地歌单播已解析过的曲又变回视频标题。

不把解析结果写成 SQLite 的 `title` / `artist`。

## 设置

设置页「曲目解析」三项，空 Key 即关闭：

| 项       | store 键         | 默认                                    |
| -------- | ---------------- | --------------------------------------- |
| Base URL | `musicAiBaseUrl` | `https://open.bigmodel.cn/api/paas/v4/` |
| API Key  | `musicAiApiKey`  | `''`                                    |
| 模型     | `musicAiModel`   | `glm-4-flash`                           |

与 Cookie 一样只存本地。请求里的 Bearer 只在主进程组装，不打进日志。`settings.get` 回显这三项，方便改模型名（例如换成 `glm-4.5-flash`）。

调用：按 OpenAI SDK 习惯，`baseURL` 为 `https://open.bigmodel.cn/api/paas/v4/`（保留末尾 `/`），请求 `chat/completions`。用户改 Base URL 时原样使用，不再二次猜测路径。`temperature: 0`。支持则 `response_format: { type: "json_object" }`。若模型默认开启 thinking，请求里关掉。超时 **8 秒**。

## 模型协议

System：从 B 站投稿信息抽取歌曲名和歌手；禁止编造；UP 名不等于歌手，除非标题或简介明确写了原唱/演唱者。只输出 JSON。

User 字段：稿件标题、简介、UP 名、`pages: [{ index, part }]`（`index` 从 1 计）。

期望：

```json
{
	"tracks": [
		{
			"index": 1,
			"title": "起风了",
			"artist": "买辣椒也用券",
			"confidence": "high",
			"kind": "cover"
		}
	]
}
```

- `kind`：`original` | `cover` | `medley` | `not_music`
- `title` / `artist` 抽不出则为 `null`，`confidence` 为 `low`
- 规则只抽出歌名、歌手仍空：界面歌名用规则，歌手仍显示 UP，除非 AI 给出 high 的 artist

超时、非 JSON、4xx、余额不足、网络错误：静默回退，**`bili.video` 仍返回稿件字段**，不把错误抛给点播。

## 播放时覆盖

`resolvePlay` 仍请求 `/x/player/wbi/v2`。若有 `bgm_info.music_title`：

- 歌词关键词用它（可再走现有 `preciseMusicNameFromBgm`）
- 不在此时等 AI；不把 BGM 名写回稿件 `title`

歌词：`fetchMatchedLyrics({ title: 歌词用歌名, preciseKeyword: BGM 或 musicTitle, … })`。不把 `musicArtist` 拼进搜索词。

## 展示

纯函数（放在 renderer 与 `TrackItem` 同层，或 main/renderer 共享的小函数）：

- `displayTitle(track) = musicTitle ?? title`
- `displayArtist(track) = musicArtist ?? artist`

使用解析结果（没有则回退）：

- Now Playing、首页当前曲、播放队列
- 分 P / 本地歌单的 `LibraryTrackList`
- 菜单栏、托盘 tooltip、系统媒体信息（`liveState` / `usePlayback` 上报 display 字段）
- 下载列表过滤（原稿件名和解析名都能命中）
- 导出文件名

继续显示 B 站信息：

- 搜索、收藏夹、合集、稍后再看的视频列表（尚未走 `bili.video`）
- 分 P 页大标题仍是稿件名；列表里每一首用 display

`TrackItem` / `LibraryTrack` 增加可选 `musicTitle`、`musicArtist`。队列身份仍用原来的 `id` / `bvid` / `cid`。

## 测试

不拿真实 Key 打网。GLM 用假 `fetch`。

- 规则：书名号、简介标签、删空回退
- JSON：合法 tracks、confidence 低丢弃、index 错位丢弃、`not_music` 丢弃
- `sourceHash` 变化时缓存作废
- 无 Key / 超时 / 非 JSON 时 `bili.video` 仍返回 pages，且无 music 字段
- `displayTitle` / `displayArtist` 回退
- 歌词关键词：有 BGM 用 BGM；否则用 `musicTitle`；不拼 artist
- 并发：同时多篇 `bili.video` 时 GLM 调用数不超过 2
