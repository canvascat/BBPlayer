# 原仓库歌词匹配方式（对照笔记）

日期：2026-09-01  
范围：整理 [bbplayer-app/BBPlayer](https://github.com/bbplayer-app/BBPlayer) `dev` 分支的自动 / 手动歌词匹配，并对照当前桌面端实现。  
桌面端已于 2026-09-01 按本文自动匹配规则对齐（关键词、B 站 `bgm_info`、默认网易云、weapi/eapi + YRC、`auto` 竞速）。手动搜索 / `manualSkip` / 独立歌词文件缓存仍未做。

源码快照（`dev`，2026-09-01 读取）：

| 职责                     | 路径                                                       |
| ------------------------ | ---------------------------------------------------------- |
| 编排、缓存、B 站精确歌名 | `apps/mobile/src/lib/services/lyricService.ts`             |
| 网易云搜索 / 歌词 / YRC  | `apps/mobile/src/lib/api/netease/api.ts`                   |
| QQ 音乐                  | `apps/mobile/src/lib/api/qqmusic/api.ts`                   |
| 酷狗                     | `apps/mobile/src/lib/api/kugou/api.ts`                     |
| 手动搜索并发             | `apps/mobile/src/hooks/queries/lyrics/index.ts`            |
| 歌词源设置               | `apps/mobile/src/app/settings/lyrics.tsx`                  |
| 默认设置                 | `apps/mobile/src/hooks/stores/useAppStore.ts`              |
| 曲目时长单位             | `apps/mobile/src/types/core/media.ts`（`duration` **秒**） |
| 缓存结构                 | `apps/mobile/src/types/player/lyrics.ts`                   |
| B 站播放器信息           | `GET /x/player/wbi/v2`（`getWebPlayerInfo`）               |

当前桌面端对照入口：

- 抓取：`packages/main/src/lyrics-fetch.ts` 的 `fetchMatchedLyrics`
- 播放解析：`packages/main/src/index.ts` 的 `resolvePlay`
- SPL 合并：`packages/core` 的 `parseAndMergeLyrics` / `parseYrc`（后者桌面抓取未调用）

---

## 1. 自动匹配总流程

播放时走 `lyricService.smartFetchLyrics(track)`：

```
smartFetchLyrics(track)
        │
        ▼
  读 lyrics/{uniqueKey 的 :: → --}.json
        │
        ├─ 文件存在且 lrc 是 string → 直接用缓存
        ├─ 文件存在且 manualSkip === true → 不再联网
        └─ 缓存未命中 / 非法
                │
                ▼
          离线？ → LyricNotFoundError
                │ 在线
                ▼
          track.source === 'bilibili'？
                ├─ 是：GET /x/player/wbi/v2 → bgm_info.music_title
                │        抽出《…》或整段 music_title 作为 preciseKeyword
                │        （失败则 preciseKeyword = undefined，回退清洗标题）
                └─ 否：preciseKeyword = undefined
                │
                ▼
          getBestMatchedLyrics(track, preciseKeyword, lyricSource)
                │
                ▼
          写成 LyricFileData 落盘
```

要点：

- 缓存键是曲目 `uniqueKey`，不是搜索词。
- `manualSkip` 为 true 时自动匹配永久跳过，直到用户手动搜索或编辑歌词（保存时会把 `manualSkip` 置回 false）。
- 成功后调用 `parseAndMergeLyrics` 再推给悬浮窗 / 状态栏；时间戳从 SPL 毫秒换成秒。

---

## 2. 搜索关键词

### 2.1 清洗规则 `cleanKeyword(title)`

与桌面端 `cleanKeyword` 相同：

1. 优先取 `《…》` 或 `「…」` 内的内容。
2. 否则删掉 `【…】` 和 `“…”`，trim；删空则退回原标题。

**自动匹配的搜索串只是歌名，不拼 artist。**

```
keyword = preciseKeyword ?? cleanKeyword(track.title)
```

桌面端当前是 `[cleanKeyword(title), artist].filter(Boolean).join(' ')`，这是对原仓库最大的关键词差异之一。

### 2.2 B 站精确歌名

仅 `source === 'bilibili'` 且有 `bvid` + `cid` 时：

1. WBI 签名请求 `/x/player/wbi/v2`（`getWebPlayerInfo`）。
2. 读 `bgm_info.music_title`。没有 `bgm_info` 则放弃精确名。
3. 若 `music_title` 含 `《…》`，只用括号内；否则用整段 `music_title`。
4. 该字符串作为 `preciseKeyword` **覆盖**清洗后的视频标题。

桌面端没有这条路径；搜索词始终来自分 P / 视频标题。

---

## 3. 歌词源设置

类型：`'auto' | 'netease' | 'qqmusic' | 'kugou'`。

Store 默认值是 **`'netease'`**（不是 auto）。`smartFetchLyrics` 里写的 `?? 'auto'` 只在字段缺失时生效。

设置页文案：

- 单源：只打这一家。
- 「自动 (选择最先返回的数据源)」：三源并行，`Promise.any` 先成功的胜出，并 abort 其余请求。
- Toast 明确说：**自动不考虑匹配度，不保证最好。**

`getBestMatchedLyrics` 的 provider 选择：

| `lyricSource`         | 实际发起的源           |
| --------------------- | ---------------------- |
| `netease`（默认）     | 仅网易云               |
| `qqmusic` / `kugou`   | 仅对应源               |
| `auto` 或 `undefined` | 网易云 + QQ + 酷狗并行 |

单源失败即整次自动匹配失败，不会悄悄换下一家。只有 `auto` 才会跨源竞速。

---

## 4. 时长怎么用

`Track.duration` 单位是 **秒**。编排层传给各源：

```
durationMs = track.duration * 1000
```

各源内部再 `Math.round(durationMs / 1000)` 变回秒，和搜索结果的秒级 duration 比。

| 源        | 时长规则                                                                                     |
| --------- | -------------------------------------------------------------------------------------------- |
| 网易云    | **完全不用**。参数名叫 `_targetDurationMs`，注释写过 duration 打分但已废弃：「相信网易云」。 |
| QQ / 酷狗 | 搜索 10 条；在前 5 条里找 `\|duration − target\| ≤ 3` 秒；没有则用第 1 条。                  |

桌面端 QQ / 酷狗的 `pickByDuration` 与原仓库这条规则一致。网易云桌面端同样不看时长，但搜索只取 1 条、接口也不同。

---

## 5. 网易云

### 搜索

- 加密：`weapi`
- 接口：`POST /api/cloudsearch/pc`（非公开 `/api/search/get/web`）
- 自动匹配：`limit: 10`
- 手动搜索：`limit: 20`
- 结果映射：`duration = song.dt / 1000`（`dt` 是毫秒）
- **选用第 1 条**，不扫后续结果、不比时长

### 歌词

- 加密：`eapi`
- 接口：`POST /api/song/lyric/v1`
- 参数包含 `lv/tv/rv/kv/yv = -1`（**要 YRC**），以及 `os: ios`、`ver: 1`
- Cookie 伪装 iOS 客户端（`os/appver/osver/deviceId`）

### 解析 `parseLyrics`

```
若 yrc.lyric 存在：
  lrc     ← yrc
  tlyric  ← ytlrc
  romalrc ← yromalrc
否则：
  lrc     ← lrc
  tlyric  ← tlyric
  romalrc ← romalrc

三条都再跑 parseYrc()（即使看起来已经是 LRC）
```

`parseYrc` 现已在本仓库 `packages/core/src/splash/converter/netease.ts`：把网易云逐字 YRC 转成 SPL。这是原仓库「逐字歌词主要来自网易云」的来源。

桌面端差异：

- 公开 `GET /api/search/get/web?limit=1`
- 公开 `GET /api/song/lyric?lv/tv/rv=-1`，**没有 `yv=-1`，不拉 yrc**
- 不调用 `parseYrc`

因此即便搜到同一首歌，桌面端也拿不到原仓库那条逐字轨。

---

## 6. QQ 音乐

与桌面端几乎同一套 HTTP：

1. `POST https://u.y.qq.com/cgi-bin/musicu.fcg`，`DoSearchForQQMusicDesktop`，每页 10 条（手动 20）。
2. 前 5 条 ±3 秒时长，否则第一条。
3. `GET https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=…&nobase64=1`
4. `lyric` / `trans` 用 `he.decode` 解 HTML 实体（桌面是自写 `decodeHtml`）。
5. 没有罗马音轨。

---

## 7. 酷狗

与桌面端同一条链路：

1. `GET http://mobilecdn.kugou.com/api/v3/search/song`，iPhone UA，10 条（手动 20）。
2. 同样前 5 条 ±3 秒。
3. `GET http://krcs.kugou.com/search?hash=…` 取 `candidates[0]`。
4. `GET http://lyrics.kugou.com/download?fmt=lrc`，内容 Base64。
5. 原仓库用 CryptoJS 解码；桌面用 `Buffer.from(..., 'base64')`。
6. 只要主 LRC，无翻译 / 罗马音。

---

## 8. 并行竞速（仅 `auto`）

`getBestMatchedLyrics` 对每个启用的源包一层 `AbortController`：

- 某个源 `ResultAsync` **成功**（拿到 `LyricProviderResponseData`）后 abort 其它源。
- 全部失败则 `Promise.any` 变成 `AggregateError` → `LyricNotFoundError`。

「成功」是接口链路没抛错，**不是**「歌词非空」或「时长更近」。网易云 `parseLyrics` 在空字符串上也会 `okAsync`。设置页已经提示 auto 不保证最好。

桌面端是**串行**：网易云 → QQ → 酷狗；前一家返回了 `lrc` 就停。这既不是默认网易云单源，也不是 auto 竞速。

---

## 9. 手动搜索

与自动匹配独立，不受 `lyricSource` 限制。

- 用户改关键词回车。
- 三源并行 `search(..., 20)`，结果按到达顺序 **追加** 进同一个列表。
- 点某一行再按 `source` 调对应 `getLyrics` + `parseLyrics` 并写入同一 `uniqueKey` 缓存。

桌面端目前没有手动搜索歌词。

---

## 10. 缓存与展示（原仓库）

`LyricFileData` 核心字段：

- `lrc` / `tlyric` / `romalrc`：一律视为 **SPL**
- `manualSkip`
- `misc.userOffset`（秒，给 overlay）
- `errorMessage`：离线或搜不到时给 UI 直接展示

展示前 `parseAndMergeLyrics`：

- 主轨 `parseSpl(lrc)`
- 翻译 / 罗马音时间戳与主轨重合率 ≥ **20%** 才合并，否则丢弃副轨

本仓库 core 已有同一套合并逻辑。桌面端再 `splLinesToAmll` 交给 AMLL。

原仓库还有：跳过歌词、预加载下一首、旧格式迁移、offset 校准。这些不属于「匹配」，此处不展开。

---

## 11. 与当前桌面端对照

| 项            | 原仓库                                   | 当前桌面端                        |
| ------------- | ---------------------------------------- | --------------------------------- |
| 关键词        | 歌名；B 站优先 `bgm_info.music_title`    | 已对齐                            |
| B 站精确歌名  | `/x/player/wbi/v2`                       | 已对齐                            |
| 默认源        | 仅网易云                                 | 已对齐（设置可改）                |
| auto          | `Promise.any` 先到先得                   | 已对齐                            |
| 网易云搜索    | weapi `cloudsearch`，limit 10，取第 1 条 | 已对齐                            |
| 网易云歌词    | eapi `lyric/v1` + `yv=-1`                | 已对齐                            |
| YRC → SPL     | 始终 `parseYrc`                          | 已对齐                            |
| QQ / 酷狗匹配 | 前 5 条 ±3 秒                            | 相同                              |
| 时长单位      | 曲目秒 → 各源毫秒 → 再比秒               | 已对齐                            |
| 空歌词        | 可能被当成源成功（尤其 auto）            | 无 `lrc` 不视为成功，其它源可继续 |
| 缓存          | 独立 `lyrics/*.json` + `manualSkip`      | 仍绑在下载记录上                  |
| 手动搜索      | 三源 limit 20                            | 无                                |
| 歌词源设置    | 有                                       | 已对齐                            |

共享且可直接复用的部分：

- `cleanKeyword` 规则
- QQ / 酷狗 HTTP 与 ±3 秒挑选
- `parseAndMergeLyrics`、`parseYrc`、`splLinesToAmll`

---

## 12. 仍未对齐的部分

自动匹配规则已落地。尚未做：

- 手动搜索歌词
- `manualSkip` 与独立 `lyrics/*.json` 缓存
- 歌词偏移校准 UI
