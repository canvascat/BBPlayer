import { tmpdir } from 'node:os'

import { test, assert } from 'vitest'

import { exportSummary, safeExportName, uniquePath } from './export-audio.ts'

test('导出文件名去掉非法字符', () => {
	assert.equal(safeExportName('A/B', '歌:名'), 'A_B - 歌_名')
})

test('重名时在文件名后加序号', () => {
	const path = uniquePath(tmpdir(), `bbplayer-export-${Date.now()}`, '.m4a')
	assert.match(path, /bbplayer-export-\d+\.m4a$/)
})

test('导出结果文案', () => {
	assert.equal(exportSummary(0, []), '没有可导出的歌曲')
	assert.equal(exportSummary(3, []), '导出完成，3 个成功')
	assert.equal(exportSummary(2, ['x']), '导出完成，2 个成功，1 个失败')
})
