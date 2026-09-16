const XOR_CODE = 23442827791579n
const MASK_CODE = 2251799813685247n
const MAX_AID = 2251799813685248n
const BASE = 58n
const MAGIC_STR = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'

export function bv2av(bvid: string): number {
	const bvidArr = Array.from(bvid)
	;[bvidArr[3], bvidArr[9]] = [bvidArr[9], bvidArr[3]]
	;[bvidArr[4], bvidArr[7]] = [bvidArr[7], bvidArr[4]]
	bvidArr.splice(0, 3)
	const tmp = bvidArr.reduce(
		(pre, bvidChar) => pre * BASE + BigInt(MAGIC_STR.indexOf(bvidChar)),
		0n,
	)
	return Number((tmp & MASK_CODE) ^ XOR_CODE)
}

export function av2bv(avid: number | bigint): string {
	let tempNum = (BigInt(avid) | MAX_AID) ^ XOR_CODE
	const resultArray = Array.from('BV1000000000')
	for (let i = 11; i >= 3; i--) {
		resultArray[i] = MAGIC_STR[Number(tempNum % BASE)]
		tempNum /= BASE
	}
	;[resultArray[3], resultArray[9]] = [resultArray[9], resultArray[3]]
	;[resultArray[4], resultArray[7]] = [resultArray[7], resultArray[4]]
	return resultArray.join('')
}

export function hasClipWindow(input: {
	clipStartSec?: number
	clipEndSec?: number
}): boolean {
	return (
		Number.isFinite(input.clipStartSec) && Number.isFinite(input.clipEndSec)
	)
}

export function generateUniqueTrackKey(input: {
	bvid: string
	cid?: number
	isMultiPage?: boolean
	clipStartSec?: number
	clipEndSec?: number
}): string {
	if (hasClipWindow(input) && input.cid) {
		return `bilibili::${input.bvid}::${input.cid}::${Math.round(input.clipStartSec!)}::${Math.round(input.clipEndSec!)}`
	}
	if (input.isMultiPage && input.cid) {
		return `bilibili::${input.bvid}::${input.cid}`
	}
	return `bilibili::${input.bvid}`
}

export function parseBilibiliTrackKey(id: string): {
	bvid: string
	cid?: number
	clipStartSec?: number
	clipEndSec?: number
} | null {
	const parts = id.split('::')
	if (parts[0] !== 'bilibili' || !parts[1]) return null
	if (parts.length === 2) return { bvid: parts[1] }
	if (parts.length === 3) {
		const cid = Number(parts[2])
		if (!Number.isFinite(cid)) return null
		return { bvid: parts[1], cid }
	}
	if (parts.length === 5) {
		const cid = Number(parts[2])
		const clipStartSec = Number(parts[3])
		const clipEndSec = Number(parts[4])
		if (![cid, clipStartSec, clipEndSec].every(Number.isFinite)) return null
		return { bvid: parts[1], cid, clipStartSec, clipEndSec }
	}
	return null
}

export function audioCacheKey(input: {
	bvid: string
	cid?: number
	isMultiPage?: boolean
	clipStartSec?: number
	clipEndSec?: number
}): string {
	if (hasClipWindow(input)) {
		return generateUniqueTrackKey({
			bvid: input.bvid,
			cid: input.cid,
			isMultiPage: true,
		})
	}
	return generateUniqueTrackKey({
		bvid: input.bvid,
		cid: input.cid,
		isMultiPage: input.isMultiPage,
	})
}

export function sameAudioStream(
	a: { bvid: string; cid: number },
	b: { bvid: string; cid: number },
): boolean {
	return a.bvid === b.bvid && a.cid === b.cid
}
