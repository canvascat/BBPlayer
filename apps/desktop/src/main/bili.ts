import { createHash } from 'node:crypto'

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
	const assigned = { ...params, wts: String(currTime) }
	const query = Object.keys(assigned)
		.sort()
		.map((key) => {
			const value = assigned[key].replace(chrFilter, '')
			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
		})
		.join('&')
	const wbiSign = createHash('md5').update(query + mixinKey).digest('hex')
	return `${query}&w_rid=${wbiSign}`
}

let cached:
	| { imgKey: string; subKey: string; timestamp: number }
	| null = null

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
		subKey: subUrl.slice(subUrl.lastIndexOf('/') + 1, subUrl.lastIndexOf('.')),
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
					.map(
						([k, v]) =>
							`${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
					)
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
	const json = (await res.json()) as { code: number; message: string; data: any }
	if (json.code !== 0) {
		const error = new Error(json.message || `Bilibili API 错误 ${json.code}`)
		;(error as Error & { code?: number }).code = json.code
		throw error
	}
	return json
}

export async function resolveB23(url: string) {
	const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } })
	return res.url
}

export async function getVideoDetails(bvid: string, cookie: string) {
	const json = await biliFetch('/x/web-interface/view', cookie, { bvid })
	return json.data as {
		bvid: string
		title: string
		pic: string
		duration: number
		owner: { name: string; mid: number; face: string }
		cid: number
		pages: { part: string; duration: number; cid: number; page: number }[]
	}
}

export async function searchVideos(keyword: string, cookie: string) {
	const json = await biliFetch(
		'/x/web-interface/wbi/search/type',
		cookie,
		{ keyword, search_type: 'video', page: '1' },
		true,
	)
	return (json.data?.result ?? []) as {
		bvid: string
		title: string
		pic: string
		author: string
		duration: string
	}[]
}

export async function getAudioStream(bvid: string, cid: number, cookie: string) {
	const json = await biliFetch(
		'/x/player/wbi/playurl',
		cookie,
		{
			bvid,
			cid: String(cid),
			fnval: '4048',
			fnver: '0',
			fourk: '1',
		},
		true,
	)
	const dash = json.data?.dash
	const durl = json.data?.durl
	if (dash?.audio?.[0]?.baseUrl) {
		return { url: dash.audio[0].baseUrl as string, type: 'dash' as const }
	}
	if (durl?.[0]?.url) {
		return { url: durl[0].url as string, type: 'mp4' as const }
	}
	throw new Error('无法获取音频流，可能需要大会员或该歌曲已下架')
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
