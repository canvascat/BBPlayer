export interface LyricPayload {
	lrc: string
	tlyric?: string
	romalrc?: string
	source: 'netease' | 'qqmusic' | 'kugou'
}

export function cleanKeyword(keyword: string) {
	const priority = /《(.+?)》|「(.+?)」/.exec(keyword)
	if (priority?.[1] || priority?.[2])
		return priority[1] || priority[2] || keyword
	const replaced = keyword.replace(/【.*?】|“.*?”/g, '').trim()
	return replaced || keyword
}

export function decodeHtml(input: string) {
	return input
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
			String.fromCharCode(Number.parseInt(code, 16)),
		)
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
}

export function pickByDuration<T extends { duration: number }>(
	songs: T[],
	durationSec: number,
) {
	if (!songs.length) return undefined
	const close = songs
		.slice(0, 5)
		.find((song) => Math.abs(song.duration - durationSec) <= 3)
	return close ?? songs[0]
}

const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function fromNetease(keyword: string): Promise<LyricPayload | null> {
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
		source: 'netease',
	}
}

async function fromQq(
	keyword: string,
	durationSec: number,
): Promise<LyricPayload | null> {
	const body = {
		comm: { ct: '19', cv: '1859', uin: '0' },
		req: {
			method: 'DoSearchForQQMusicDesktop',
			module: 'music.search.SearchCgiService',
			param: {
				grp: 1,
				num_per_page: 10,
				page_num: 1,
				query: keyword,
				search_type: 0,
			},
		},
	}
	const search = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
		method: 'POST',
		body: JSON.stringify(body),
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
			Accept: 'application/json',
			'Content-Type': 'application/json;charset=utf-8',
			Referer: 'https://y.qq.com/',
		},
	})
	const json = (await search.json()) as {
		req?: {
			data?: {
				body?: {
					song?: { list?: Array<{ mid: string; interval: number }> }
				}
			}
		}
	}
	const list = json.req?.data?.body?.song?.list ?? []
	const match = pickByDuration(
		list.map((song) => ({ duration: song.interval, mid: song.mid })),
		durationSec,
	)
	if (!match?.mid) return null
	const lyricRes = await fetch(
		`https://i.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${match.mid}&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8&nobase64=1`,
		{ headers: { Referer: 'https://y.qq.com/' } },
	)
	const lyricJson = (await lyricRes.json()) as {
		lyric?: string
		trans?: string
	}
	if (!lyricJson.lyric) return null
	return {
		lrc: decodeHtml(lyricJson.lyric),
		tlyric: lyricJson.trans ? decodeHtml(lyricJson.trans) : undefined,
		source: 'qqmusic',
	}
}

async function fromKugou(
	keyword: string,
	durationSec: number,
): Promise<LyricPayload | null> {
	const params = new URLSearchParams({
		api_ver: '1',
		area_code: '1',
		correct: '1',
		pagesize: '10',
		plat: '2',
		tag: '1',
		sver: '5',
		showtype: '10',
		page: '1',
		keyword,
		version: '8990',
	})
	const search = await fetch(
		`http://mobilecdn.kugou.com/api/v3/search/song?${params.toString()}`,
		{
			headers: {
				'User-Agent': 'IPhone-8990-searchSong',
				'UNI-UserAgent': 'iOS11.4-Phone8990-1009-0-WiFi',
			},
		},
	)
	const json = (await search.json()) as {
		status?: number
		data?: {
			info?: Array<{ hash: string; duration: number }>
		}
	}
	if (json.status !== 1) return null
	const match = pickByDuration(
		(json.data?.info ?? []).map((song) => ({
			duration: song.duration,
			hash: song.hash,
		})),
		durationSec,
	)
	if (!match?.hash) return null
	const lyricSearch = await fetch(
		`http://krcs.kugou.com/search?${new URLSearchParams({
			keyword: '%20-%20',
			ver: '1',
			hash: match.hash,
			client: 'mobi',
			man: 'yes',
		}).toString()}`,
	)
	const candidates = (await lyricSearch.json()) as {
		candidates?: Array<{ accesskey: string; id: string }>
	}
	const candidate = candidates.candidates?.[0]
	if (!candidate) return null
	const download = await fetch(
		`http://lyrics.kugou.com/download?${new URLSearchParams({
			charset: 'utf8',
			accesskey: candidate.accesskey,
			id: candidate.id,
			client: 'mobi',
			fmt: 'lrc',
			ver: '1',
		}).toString()}`,
	)
	const payload = (await download.json()) as { content?: string }
	if (!payload.content) return null
	return {
		lrc: Buffer.from(payload.content, 'base64').toString('utf8'),
		source: 'kugou',
	}
}

export async function fetchMatchedLyrics(
	title: string,
	artist?: string,
	durationSec = 0,
) {
	const keyword = [cleanKeyword(title), artist].filter(Boolean).join(' ')
	try {
		const netease = await fromNetease(keyword)
		if (netease?.lrc) return netease
	} catch {
		// 继续尝试其他源
	}
	try {
		const qq = await fromQq(keyword, durationSec)
		if (qq?.lrc) return qq
	} catch {
		// 继续尝试酷狗
	}
	try {
		return await fromKugou(keyword, durationSec)
	} catch {
		return null
	}
}
