import { test, assert } from 'vitest'

import { matchSearchStrategies } from './search.ts'

test('提取 BV 号', async () => {
	const result = await matchSearchStrategies('看看 BV1GJ411x7h7 这首')
	assert.equal(result.type, 'BVID')
	if (result.type === 'BVID') assert.equal(result.bvid, 'BV1GJ411x7h7')
})

test('关键词搜索', async () => {
	const result = await matchSearchStrategies('洛天依')
	assert.equal(result.type, 'SEARCH')
	if (result.type === 'SEARCH') assert.equal(result.query, '洛天依')
})
