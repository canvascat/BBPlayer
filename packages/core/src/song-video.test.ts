import { assert, test } from 'vitest'

import { isSongVideo } from './song-video.ts'

test('音乐分区算歌曲', () => {
	assert.equal(isSongVideo({ tid: 31, title: '随便' }), true)
	assert.equal(isSongVideo({ tid: 3, title: '随便' }), true)
})

test('非音乐分区但标题含翻唱或 Cover 算歌曲', () => {
	assert.equal(isSongVideo({ tid: 17, title: '【翻唱】夜に駆ける' }), true)
	assert.equal(isSongVideo({ tid: 17, title: 'Foo Cover Bar' }), true)
})

test('MV 要单词边界，不能靠子串', () => {
	assert.equal(isSongVideo({ title: '【MV】天ノ弱' }), true)
	assert.equal(isSongVideo({ title: '[MV] 歌' }), true)
	assert.equal(isSongVideo({ title: 'Official MV' }), true)
	assert.equal(isSongVideo({ title: 'mvplayer 评测' }), false)
})

test('去 HTML 后再匹配', () => {
	assert.equal(isSongVideo({ title: '<em>翻唱</em> 测试' }), true)
})

test('无 tid 且标题不中则不是歌曲', () => {
	assert.equal(isSongVideo({ title: '手机开箱' }), false)
	assert.equal(isSongVideo({ tid: 17, title: '手机开箱' }), false)
})

test('宽泛词「原创」「音乐」「歌曲」不算', () => {
	assert.equal(isSongVideo({ title: '原创动画' }), false)
	assert.equal(isSongVideo({ title: '音乐游戏实况' }), false)
	assert.equal(isSongVideo({ title: '歌曲推荐盘点但是生活区' }), false)
})
