import { createHash } from 'node:crypto'

import { bv2av } from '@bbplayer/core'

import { coverUrl } from './bili-image.ts'
import { preciseMusicNameFromBgm } from './lyric-match.ts'

export { coverUrl } from './bili-image.ts'

const mixinKeyEncTab = [
	46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
	33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
	26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
	20, 34, 44, 52,
]

const getMixinKey = (orig: string) =>
	mixinKeyEncTab
		.map((n) => orig[n])
		.join('')
		.slice(0, 32)

function encWbi(
	params: Record<string, string>,
	imgKey: string,
	subKey: string,
) {
	const mixinKey = getMixinKey(imgKey + subKey)
	const currTime = Math.round(Date.now() / 1000)
	const chrFilter = /[!'()*]/g
	const assigned: Record<string, string> = {
		...params,
		wts: String(currTime),
	}
	const query = Object.keys(assigned)
		.sort()
		.map((key) => {
			const value = assigned[key].replace(chrFilter, '')
			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
		})
		.join('&')
	const wbiSign = createHash('md5')
		.update(query + mixinKey)
		.digest('hex')
	return `${query}&w_rid=${wbiSign}`
}

let cached: { imgKey: string; subKey: string; timestamp: number } | null = null

export function clearWbiCache() {
	cached = null
}

async function getWbiKeys(cookie: string) {
	if (cached && Date.now() - cached.timestamp < 12 * 60 * 60 * 1000) {
		return cached
	}
	const res = await biliFetch('/x/web-interface/nav', cookie)
	const imgUrl = res.data?.wbi_img?.img_url as string
	const subUrl = res.data?.wbi_img?.sub_url as string
	if (!imgUrl || !subUrl) throw new Error('获取 WBI 密钥失败')
	cached = {
		imgKey: imgUrl.slice(imgUrl.lastIndexOf('/') + 1, imgUrl.lastIndexOf('.')),
		subKey: subUrl.slice(subUrl.lastIndexOf('/') + 1),
		timestamp: Date.now(),
	}
	return cached
}

const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export async function biliFetch(
	endpoint: string,
	cookie = '',
	params?: Record<string, string>,
	sign = false,
) {
	let query = ''
	if (params) {
		if (sign) {
			const keys = await getWbiKeys(cookie)
			query = '?' + encWbi(params, keys.imgKey, keys.subKey)
		} else {
			query =
				'?' +
				Object.entries(params)
					.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
					.join('&')
		}
	}
	const res = await fetch(`https://api.bilibili.com${endpoint}${query}`, {
		headers: {
			Cookie: cookie,
			'User-Agent': UA,
			Referer: 'https://www.bilibili.com/',
			Origin: 'https://www.bilibili.com',
		},
	})
	const json = (await res.json()) as {
		code: number
		message: string
		data: any
	}
	// nav 在未登录时 code 为 -101，但仍会返回 wbi_img
	if (endpoint === '/x/web-interface/nav') {
		return json
	}
	if (json.code !== 0) {
		const error = new Error(json.message || `Bilibili API 错误 ${json.code}`)
		;(error as Error & { code?: number }).code = json.code
		throw error
	}
	return json
}

export async function resolveB23(url: string) {
	const res = await fetch(url, {
		redirect: 'follow',
		headers: { 'User-Agent': UA },
	})
	return res.url
}

export async function getVideoDetails(bvid: string, cookie: string) {
	const json = await biliFetch('/x/web-interface/view', cookie, { bvid })
	const data = json.data as {
		bvid: string
		title: string
		pic: string
		duration: number
		owner: { name: string; mid: number; face: string }
		cid: number
		tid: number
		pages: { part: string; duration: number; cid: number; page: number }[]
	}
	return {
		...data,
		pic: coverUrl(data.pic),
		owner: { ...data.owner, face: coverUrl(data.owner.face) },
		tid: videoTid(data),
	}
}

export async function searchVideos(keyword: string, cookie: string) {
	const json = await biliFetch(
		'/x/web-interface/wbi/search/type',
		cookie,
		{ keyword, search_type: 'video', page: '1' },
		true,
	)
	return (
		(json.data?.result ?? []) as Array<{
			bvid: string
			title: string
			pic: string
			author: string
			duration: string
			typeid?: unknown
		}>
	).map((item) => ({
		...item,
		pic: coverUrl(item.pic),
		tid: videoTid(item),
	}))
}

export async function getAudioStream(
	bvid: string,
	cid: number,
	cookie: string,
) {
	const json = await biliFetch(
		'/x/player/wbi/playurl',
		cookie,
		{
			bvid,
			cid: String(cid),
			fnval: '4048',
			fnver: '0',
			fourk: '1',
			qlt: '30280',
			voice_balance: '1',
		},
		true,
	)
	const dash = json.data?.dash
	const durl = json.data?.durl
	const audioUrl =
		(dash?.dolby?.audio?.[0]?.baseUrl as string | undefined) ||
		(dash?.flac?.audio?.baseUrl as string | undefined) ||
		(dash?.audio?.[0]?.baseUrl as string | undefined) ||
		(dash?.audio?.[0]?.base_url as string | undefined)
	if (audioUrl) {
		return { url: audioUrl, type: 'dash' as const }
	}
	if (durl?.[0]?.url) {
		return { url: durl[0].url as string, type: 'mp4' as const }
	}
	throw new Error('无法获取音频流，可能需要大会员或该歌曲已下架')
}

export async function getPreciseMusicNameOnBilibiliVideo(
	bvid: string,
	cid: number,
	cookie: string,
) {
	try {
		const json = await biliFetch(
			'/x/player/wbi/v2',
			cookie,
			{ bvid, cid: String(cid) },
			true,
		)
		const title = (
			json.data as { bgm_info?: { music_title?: string } } | undefined
		)?.bgm_info?.music_title
		return preciseMusicNameFromBgm(title)
	} catch {
		return undefined
	}
}

export async function fetchNeteaseLyrics(title: string, artist?: string) {
	const keyword = [title, artist].filter(Boolean).join(' ')
	const search = await fetch(
		`https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=1`,
		{ headers: { Referer: 'https://music.163.com/', 'User-Agent': UA } },
	)
	const searchJson = (await search.json()) as {
		result?: { songs?: { id: number }[] }
	}
	const id = searchJson.result?.songs?.[0]?.id
	if (!id) return null
	const lyricRes = await fetch(
		`https://music.163.com/api/song/lyric?id=${id}&lv=-1&tv=-1&rv=-1`,
		{ headers: { Referer: 'https://music.163.com/', 'User-Agent': UA } },
	)
	const lyricJson = (await lyricRes.json()) as {
		lrc?: { lyric?: string }
		tlyric?: { lyric?: string }
		romalrc?: { lyric?: string }
	}
	if (!lyricJson.lrc?.lyric) return null
	return {
		lrc: lyricJson.lrc.lyric,
		tlyric: lyricJson.tlyric?.lyric,
		romalrc: lyricJson.romalrc?.lyric,
	}
}

export interface BiliAccount {
	mid: number
	name: string
	face: string
}

export interface RemoteFolder {
	kind: 'favorite' | 'collection' | 'toview'
	id: string
	title: string
	coverUrl: string
	itemCount: number
}

export function videoTid(item: {
	tid?: unknown
	typeid?: unknown
}): number | undefined {
	const n = Number(item.tid ?? item.typeid)
	if (!Number.isFinite(n) || n <= 0) return undefined
	return n
}

export interface RemoteVideo {
	bvid: string
	title: string
	pic: string
	author: string
	duration: string
	tid?: number
}

export async function getAccount(cookie: string): Promise<BiliAccount | null> {
	if (!cookie.trim()) return null
	const json = await biliFetch('/x/web-interface/nav', cookie)
	if (!json.data?.isLogin) return null
	return {
		mid: Number(json.data.mid),
		name: String(json.data.uname ?? json.data.name ?? ''),
		face: coverUrl(json.data.face),
	}
}

export async function getFavoriteFolders(
	cookie: string,
	mid: number,
): Promise<RemoteFolder[]> {
	const json = await biliFetch('/x/v3/fav/folder/created/list-all', cookie, {
		up_mid: String(mid),
	})
	return (
		(json.data?.list ?? []) as Array<{
			id: number
			title: string
			media_count: number
			cover?: string
		}>
	).map((item) => ({
		kind: 'favorite' as const,
		id: String(item.id),
		title: item.title,
		coverUrl: coverUrl(item.cover),
		itemCount: item.media_count ?? 0,
	}))
}

export async function getFavoriteVideos(
	cookie: string,
	favoriteId: string,
): Promise<{ title: string; videos: RemoteVideo[] }> {
	const videos: RemoteVideo[] = []
	let title = '收藏夹'
	for (let pn = 1; pn <= 50; pn++) {
		const json = await biliFetch('/x/v3/fav/resource/list', cookie, {
			media_id: favoriteId,
			pn: String(pn),
			ps: '40',
		})
		if (json.data?.info?.title) title = json.data.info.title
		const medias = (json.data?.medias ?? []) as Array<{
			bvid: string
			title: string
			cover: string
			duration: number
			type: number
			attr: number
			tid?: unknown
			upper?: { name: string }
		}>
		for (const item of medias) {
			if (item.type !== 2 || item.attr === 1 || item.attr === 9) continue
			videos.push({
				bvid: item.bvid,
				title: item.title,
				pic: coverUrl(item.cover),
				author: item.upper?.name ?? '',
				duration: formatClock(item.duration),
				tid: videoTid(item),
			})
		}
		if (!json.data?.has_more) break
	}
	return { title, videos }
}

export async function getCollections(
	cookie: string,
	mid: number,
): Promise<RemoteFolder[]> {
	const folders: RemoteFolder[] = []
	for (let pn = 1; pn <= 20; pn++) {
		const json = await biliFetch('/x/v3/fav/folder/collected/list', cookie, {
			pn: String(pn),
			ps: '20',
			up_mid: String(mid),
			platform: 'web',
		})
		const list = (json.data?.list ?? []) as Array<{
			id: number
			title: string
			cover: string
			media_count: number
			state: number
			attr: number
		}>
		for (const item of list) {
			if (item.state === 1) continue
			folders.push({
				kind: 'collection',
				id: String(item.id),
				title: item.title,
				coverUrl: coverUrl(item.cover),
				itemCount: item.media_count ?? 0,
			})
		}
		if (!json.data?.has_more) break
	}
	return folders
}

export async function getCollectionVideos(
	cookie: string,
	collectionId: string,
): Promise<{ title: string; videos: RemoteVideo[] }> {
	const json = await biliFetch('/x/space/fav/season/list', cookie, {
		season_id: collectionId,
		ps: '100',
		pn: '1',
	})
	const title = (json.data?.info?.title as string) || '合集'
	const medias = (json.data?.medias ?? []) as Array<{
		bvid: string
		title: string
		cover: string
		duration: number
		tid?: unknown
		upper?: { name: string }
	}>
	return {
		title,
		videos: medias.map((item) => ({
			bvid: item.bvid,
			title: item.title,
			pic: coverUrl(item.cover),
			author: item.upper?.name ?? '',
			duration: formatClock(item.duration),
			tid: videoTid(item),
		})),
	}
}

export async function getWatchLater(
	cookie: string,
): Promise<{ title: string; videos: RemoteVideo[]; itemCount: number }> {
	const json = await biliFetch('/x/v2/history/toview', cookie)
	const list = (json.data?.list ?? []) as Array<{
		bvid: string
		title: string
		pic: string
		duration: number
		tid?: unknown
		owner?: { name: string }
	}>
	return {
		title: '稍后再看',
		itemCount: json.data?.count ?? list.length,
		videos: list.map((item) => ({
			bvid: item.bvid,
			title: item.title,
			pic: coverUrl(item.pic),
			author: item.owner?.name ?? '',
			duration: formatClock(item.duration),
			tid: videoTid(item),
		})),
	}
}

export async function getUploaderVideos(
	cookie: string,
	mid: string,
): Promise<{ title: string; videos: RemoteVideo[] }> {
	const json = await biliFetch(
		'/x/space/wbi/arc/search',
		cookie,
		{ mid, pn: '1', ps: '30', keyword: '' },
		true,
	)
	const list = (json.data?.list?.vlist ?? []) as Array<{
		bvid: string
		title: string
		pic: string
		author: string
		length: string
		typeid?: unknown
	}>
	return {
		title: `UP ${mid}`,
		videos: list.map((item) => ({
			bvid: item.bvid,
			title: item.title,
			pic: coverUrl(item.pic),
			author: item.author,
			duration: item.length,
			tid: videoTid(item),
		})),
	}
}

function formatClock(seconds: number) {
	if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
	const total = Math.floor(seconds)
	const m = Math.floor(total / 60)
	const s = total % 60
	return `${m}:${String(s).padStart(2, '0')}`
}

export function csrfFromCookie(cookie: string) {
	const match = /(?:^|;\s*)bili_jct=([^;]+)/.exec(cookie)
	return match?.[1] ?? ''
}

export async function biliPost(
	endpoint: string,
	cookie: string,
	body: Record<string, string>,
) {
	const csrf = csrfFromCookie(cookie)
	const res = await fetch(`https://api.bilibili.com${endpoint}`, {
		method: 'POST',
		headers: {
			Cookie: cookie,
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': UA,
			Referer: 'https://www.bilibili.com/',
			Origin: 'https://www.bilibili.com',
		},
		body: new URLSearchParams({ ...body, csrf }).toString(),
	})
	const json = (await res.json()) as {
		code: number
		message: string
		data: unknown
	}
	if (json.code !== 0) {
		throw new Error(json.message || `Bilibili API 错误 ${json.code}`)
	}
	return json
}

export interface CommentItem {
	rpid: number
	mid: number
	like: number
	action: number
	ctime: number
	rcount: number
	uname: string
	avatar: string
	message: string
	replies: CommentItem[]
}

export interface CommentsPage {
	replies: CommentItem[]
	next: number
	isEnd: boolean
	allCount: number
}

function mapComment(raw: any): CommentItem {
	return {
		rpid: Number(raw?.rpid ?? 0),
		mid: Number(raw?.mid ?? 0),
		like: Number(raw?.like ?? 0),
		action: Number(raw?.action ?? 0),
		ctime: Number(raw?.ctime ?? 0),
		rcount: Number(raw?.rcount ?? 0),
		uname: String(raw?.member?.uname ?? ''),
		avatar: coverUrl(raw?.member?.avatar),
		message: String(raw?.content?.message ?? ''),
		replies: Array.isArray(raw?.replies) ? raw.replies.map(mapComment) : [],
	}
}

export async function getComments(
	cookie: string,
	bvid: string,
	next = 0,
	mode = 3,
): Promise<CommentsPage> {
	const json = await biliFetch('/x/v2/reply/main', cookie, {
		oid: String(bv2av(bvid)),
		type: '1',
		mode: String(mode),
		next: String(next),
		plat: '1',
	})
	const replies = Array.isArray(json.data?.replies)
		? (json.data.replies as unknown[]).map(mapComment)
		: []
	const top = json.data?.top?.upper
	if (top && next === 0) {
		replies.unshift(mapComment(top))
	}
	return {
		replies,
		next: Number(json.data?.cursor?.next ?? 0),
		isEnd: Boolean(json.data?.cursor?.is_end),
		allCount: Number(json.data?.cursor?.all_count ?? replies.length),
	}
}

export async function getReplyComments(
	cookie: string,
	bvid: string,
	rpid: number,
	pn = 1,
): Promise<CommentItem[]> {
	const json = await biliFetch('/x/v2/reply/reply', cookie, {
		oid: String(bv2av(bvid)),
		type: '1',
		root: String(rpid),
		pn: String(pn),
		ps: '20',
	})
	return Array.isArray(json.data?.replies)
		? (json.data.replies as unknown[]).map(mapComment)
		: []
}

export async function likeComment(
	cookie: string,
	bvid: string,
	rpid: number,
	action: 0 | 1,
) {
	if (!csrfFromCookie(cookie)) throw new Error('请先登录后再点赞')
	await biliPost('/x/v2/reply/action', cookie, {
		oid: String(bv2av(bvid)),
		type: '1',
		rpid: String(rpid),
		action: String(action),
	})
	return true
}

export interface GarbSearchItem {
	itemId: number
	name: string
	coverUrl: string
}

export async function searchGarbSkins(
	cookie: string,
	keyword: string,
	page = 1,
): Promise<{ list: GarbSearchItem[]; total: number }> {
	const json = await biliFetch('/x/garb/v2/mall/home/search', cookie, {
		key_word: keyword,
		pn: String(page),
		ps: '12',
	})
	const list = (
		(json.data?.list ?? []) as Array<{
			item_id: number
			name: string
			properties?: { image_cover?: string; image_cover_long?: string }
		}>
	).map((item) => ({
		itemId: item.item_id,
		name: item.name,
		coverUrl: coverUrl(
			item.properties?.image_cover_long || item.properties?.image_cover,
		),
	}))
	return { list, total: Number(json.data?.total ?? list.length) }
}

export async function fetchImageDataUrl(url: string) {
	const res = await fetch(url, {
		headers: {
			'User-Agent': UA,
			Referer: 'https://www.bilibili.com/',
		},
	})
	if (!res.ok) throw new Error('无法加载装扮封面')
	const mime = res.headers.get('content-type') || 'image/jpeg'
	const buf = Buffer.from(await res.arrayBuffer())
	return `data:${mime};base64,${buf.toString('base64')}`
}
