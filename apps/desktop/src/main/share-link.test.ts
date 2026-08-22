import { test, assert } from 'vitest'

import { parseShareLink, subscribeUrl } from './share-link.ts'

test('能从分享链接和裸 UUID 解析 shareId', () => {
	const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
	assert.deepEqual(parseShareLink(id), { shareId: id, inviteCode: undefined })
	assert.deepEqual(
		parseShareLink(
			`https://bbplayer.roitium.com/share/playlist?shareId=${id}&inviteCode=abc`,
		),
		{ shareId: id, inviteCode: 'abc' },
	)
	assert.deepEqual(parseShareLink(`bbplayer://share/playlist?shareId=${id}`), {
		shareId: id,
		inviteCode: undefined,
	})
	assert.deepEqual(parseShareLink('not-a-share'), {
		shareId: undefined,
		inviteCode: undefined,
	})
})

test('协作链接会带上邀请码', () => {
	assert.equal(
		subscribeUrl('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'xyz'),
		'https://bbplayer.roitium.com/share/playlist?shareId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&inviteCode=xyz',
	)
})
