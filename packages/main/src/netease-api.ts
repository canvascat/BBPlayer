import { eapi, eapiResDecrypt, weapi } from './netease-crypto.ts'

export function neteaseRequestUrl(uri: string, crypto: 'weapi' | 'eapi') {
	const path = uri.startsWith('/api/') ? uri.slice(5) : uri.replace(/^\//, '')
	if (crypto === 'eapi') {
		return `https://interface3.music.163.com/eapi/${path}`
	}
	return `https://music.163.com/weapi/${path}`
}

const IPHONE_UA = 'NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)'

const EAPI_HEADER = {
	osver: '16.3',
	deviceId: '265B59C3-C5DE-4876-8A33-FD52CD5C2960',
	os: 'ios',
	appver: '8.7.01',
	__csrf: '',
}

type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>

async function neteasePost<T>(
	uri: string,
	data: Record<string, unknown>,
	crypto: 'weapi' | 'eapi',
	signal?: AbortSignal,
	fetchImpl: FetchLike = fetch,
): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/x-www-form-urlencoded',
		Referer: 'https://music.163.com',
		'User-Agent': IPHONE_UA,
	}
	let body: Record<string, string>
	if (crypto === 'weapi') {
		body = weapi({ ...data, csrf_token: '' })
	} else {
		body = eapi(uri, { ...data, header: EAPI_HEADER, e_r: true })
		headers.Cookie = Object.entries(EAPI_HEADER)
			.map(([key, value]) => `${key}=${value}`)
			.join('; ')
	}
	const res = await fetchImpl(neteaseRequestUrl(uri, crypto), {
		method: 'POST',
		headers,
		body: new URLSearchParams(body).toString(),
		signal,
	})
	if (!res.ok) throw new Error(`网易云请求失败 ${res.status}`)
	if (crypto === 'weapi') return (await res.json()) as T
	const buf = Buffer.from(await res.arrayBuffer())
	const decrypted = eapiResDecrypt(buf.toString('hex').toUpperCase())
	if (decrypted) return decrypted as T
	return JSON.parse(buf.toString('utf8')) as T
}

export async function neteaseSearchSongs(
	keyword: string,
	limit = 10,
	signal?: AbortSignal,
	fetchImpl: FetchLike = fetch,
) {
	const json = await neteasePost<{
		result?: { songs?: Array<{ id: number }> }
	}>(
		'/api/cloudsearch/pc',
		{ type: 1, limit, offset: 0, s: keyword },
		'weapi',
		signal,
		fetchImpl,
	)
	return json.result?.songs ?? []
}

export async function neteaseFetchLyrics(
	id: number,
	signal?: AbortSignal,
	fetchImpl: FetchLike = fetch,
) {
	return neteasePost<{
		lrc?: { lyric?: string }
		tlyric?: { lyric?: string }
		romalrc?: { lyric?: string }
		yrc?: { lyric?: string }
		ytlrc?: { lyric?: string }
		yromalrc?: { lyric?: string }
	}>(
		'/api/song/lyric/v1',
		{
			id,
			lv: -1,
			tv: -1,
			rv: -1,
			kv: -1,
			yv: -1,
			os: 'ios',
			ver: 1,
		},
		'eapi',
		signal,
		fetchImpl,
	)
}
