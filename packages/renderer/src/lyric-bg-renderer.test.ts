import { test, assert } from 'vitest'

import {
	lyricBgRendererLabel,
	parseLyricBgRenderer,
} from './lyric-bg-renderer.ts'

test('未设置或未知值时使用流体网格渲染器', () => {
	assert.equal(parseLyricBgRenderer(null), 'mesh')
	assert.equal(parseLyricBgRenderer(undefined), 'mesh')
	assert.equal(parseLyricBgRenderer(''), 'mesh')
	assert.equal(parseLyricBgRenderer('css-bg'), 'mesh')
})

test('可切换到 Pixi 渲染器', () => {
	assert.equal(parseLyricBgRenderer('pixi'), 'pixi')
})

test('渲染器名称对应 AMLL 两种实现', () => {
	assert.equal(lyricBgRendererLabel('mesh'), '流体网格')
	assert.equal(lyricBgRendererLabel('pixi'), 'Pixi')
})
