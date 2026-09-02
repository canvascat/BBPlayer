import { assert, test } from 'vitest'

import {
	isLibraryPath,
	multipageFavorite,
	nonMultipageFavorites,
} from './library-nav.ts'

test('侧栏在整棵 /library 子树保持选中', () => {
	assert.equal(isLibraryPath('/'), false)
	assert.equal(isLibraryPath('/settings'), false)
	assert.equal(isLibraryPath('/library'), true)
	assert.equal(isLibraryPath('/library/favorites'), true)
	assert.equal(isLibraryPath('/library/playlists/abc'), true)
	assert.equal(isLibraryPath('/libraryish'), false)
})

test('[mp] 收藏夹只出现在分 p 分段', () => {
	const folders = [
		{ title: '默认收藏夹' },
		{ title: '[mp] 分P' },
		{ title: '现场' },
	]
	assert.deepEqual(
		nonMultipageFavorites(folders).map((item) => item.title),
		['默认收藏夹', '现场'],
	)
	assert.equal(multipageFavorite(folders)?.title, '[mp] 分P')
	assert.equal(multipageFavorite([{ title: '默认收藏夹' }]), undefined)
})
