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

export function generateUniqueTrackKey(input: {
	bvid: string
	cid?: number
	isMultiPage?: boolean
}): string {
	if (input.isMultiPage && input.cid) {
		return `bilibili::${input.bvid}::${input.cid}`
	}
	return `bilibili::${input.bvid}`
}
