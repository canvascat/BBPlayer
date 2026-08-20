import { av2bv } from './bilibili-id.ts'

export const BV_REGEX = /(?<![A-Za-z0-9])(bv[0-9A-Za-z]{10})(?![A-Za-z0-9])/i
export const AV_REGEX = /(?<![A-Za-z0-9])av(\d+)(?![A-Za-z0-9])/i
const SPACE_REGEX = /^\/space\/(\d+)(?:\/|$)/i

export type SearchStrategy =
	| { type: 'BVID'; bvid: string }
	| { type: 'FAVORITE'; id: string }
	| { type: 'COLLECTION'; id: string }
	| { type: 'SEARCH'; query: string }
	| { type: 'INVALID_URL_NO_CTYPE' }
	| { type: 'B23_RESOLVE_ERROR'; query: string; errorMessage: string }
	| { type: 'B23_NO_BVID_ERROR'; query: string; resolvedUrl: string }
	| { type: 'AV_PARSE_ERROR'; query: string }
	| { type: 'UPLOADER'; mid: string }

export interface SearchDeps {
	resolveB23?: (url: string) => Promise<string>
}

const cleanUrl = (s: string) => s.replace(/[),.;!?，。！？）]+$/, '')
const ensureProtocol = (s: string) =>
	/^https?:\/\//i.test(s) ? s : 'https://' + s
const removeBilibiliShareTrashContents = (s: string) => {
	const i = s.search(/https?:\/\//i)
	return i >= 0 ? s.slice(i) : s
}

function parseUrlToStrategy(urlObj: URL): SearchStrategy | null {
	const ctype = urlObj.searchParams.get('ctype')
	const fid = urlObj.searchParams.get('fid')
	if (ctype && fid) {
		if (ctype === '21') return { type: 'COLLECTION', id: fid }
		if (ctype === '11') return { type: 'FAVORITE', id: fid }
	} else if (fid && !ctype) {
		return { type: 'FAVORITE', id: fid }
	}

	if (urlObj.hostname === 'space.bilibili.com') {
		const sliced = urlObj.pathname.split('/')
		sliced.shift()
		const mid = sliced.shift()
		if (mid) {
			if (sliced.includes('lists')) {
				const collectionId = sliced.pop()
				if (!collectionId) return { type: 'UPLOADER', mid }
				return { type: 'COLLECTION', id: collectionId }
			}
			return { type: 'UPLOADER', mid }
		}
	}

	const spaceMatch = SPACE_REGEX.exec(urlObj.pathname || '')
	if (spaceMatch?.[1]) return { type: 'UPLOADER', mid: spaceMatch[1] }

	const bvidInUrl = BV_REGEX.exec(urlObj.href)?.[1]
	if (bvidInUrl) return { type: 'BVID', bvid: 'BV' + bvidInUrl.slice(2) }

	const mAV = AV_REGEX.exec(urlObj.href)
	if (mAV) {
		const avid = Number(mAV[1])
		if (Number.isFinite(avid) && avid > 0) {
			return { type: 'BVID', bvid: av2bv(avid) }
		}
		return { type: 'AV_PARSE_ERROR', query: urlObj.href }
	}
	return null
}

export async function matchSearchStrategies(
	raw: string,
	deps: SearchDeps = {},
): Promise<SearchStrategy> {
	const query = raw.trim()
	if (!query) return { type: 'SEARCH', query: '' }

	try {
		const url = new URL(
			ensureProtocol(cleanUrl(removeBilibiliShareTrashContents(query))),
		)
		if (/(^|\.)b23\.tv$/i.test(url.hostname)) {
			if (!deps.resolveB23) {
				return {
					type: 'B23_RESOLVE_ERROR',
					query,
					errorMessage: '未提供短链解析能力',
				}
			}
			try {
				const resolved = await deps.resolveB23(url.toString())
				try {
					const parsed = parseUrlToStrategy(new URL(resolved))
					if (parsed) return parsed
				} catch {
					// continue
				}
				const bvid = BV_REGEX.exec(resolved)?.[1]
				if (bvid) return { type: 'BVID', bvid: 'BV' + bvid.slice(2) }
				return { type: 'B23_NO_BVID_ERROR', query, resolvedUrl: resolved }
			} catch (error) {
				return {
					type: 'B23_RESOLVE_ERROR',
					query,
					errorMessage: error instanceof Error ? error.message : String(error),
				}
			}
		}
		const fromUrl = parseUrlToStrategy(url)
		if (fromUrl) return fromUrl
	} catch {
		// not a url
	}

	const mBV = BV_REGEX.exec(query)
	if (mBV?.[1]) return { type: 'BVID', bvid: 'BV' + mBV[1].slice(2) }

	const mAV = AV_REGEX.exec(query)
	if (mAV) {
		const avid = Number(mAV[1])
		if (Number.isFinite(avid) && avid > 0) {
			return { type: 'BVID', bvid: av2bv(avid) }
		}
		return { type: 'AV_PARSE_ERROR', query }
	}

	return { type: 'SEARCH', query }
}

export function describeSearchFailure(strategy: SearchStrategy): string | null {
	switch (strategy.type) {
		case 'INVALID_URL_NO_CTYPE':
			return '链接中未找到 ctype 参数，你确定复制全了吗？'
		case 'B23_RESOLVE_ERROR':
			return '解析 b23.tv 短链接失败'
		case 'B23_NO_BVID_ERROR':
			return '未能从短链解析出已识别内容（BV/作者/收藏等）'
		case 'AV_PARSE_ERROR':
			return '解析 avid 失败'
		default:
			return null
	}
}
