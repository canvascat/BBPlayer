import { test, assert } from 'vitest'

import { compareSemver, interpretUpdate, notesFromRelease } from './updater.ts'

test('版本比较', () => {
	assert.equal(compareSemver('2.4.3', '0.1.0') > 0, true)
	assert.equal(compareSemver('0.1.0', '0.1.0'), 0)
})

test('缺少远程版本时检查更新失败', () => {
	const result = interpretUpdate('0.1.0')
	assert.equal(result.status, 'error')
	assert.equal(result.message, '检查更新失败')
})

test('已是最新版本', () => {
	const result = interpretUpdate('0.2.0', 'v0.2.0')
	assert.equal(result.status, 'latest')
	assert.equal(result.message, '已是最新版本')
})

test('有更高版本时提示可更新', () => {
	const result = interpretUpdate('0.1.0', '0.2.0', '修复封面')
	assert.equal(result.status, 'available')
	assert.equal(result.message, '发现新版本 0.2.0')
	assert.equal(result.notes, '修复封面')
})

test('GitHub 发行说明数组会拼成文本', () => {
	assert.equal(notesFromRelease([{ note: 'a' }, { note: 'b' }]), 'a\nb')
})
