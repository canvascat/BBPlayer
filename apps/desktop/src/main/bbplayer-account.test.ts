import { test, assert } from 'vitest'

import { mapAuthError, validateCredentials } from './bbplayer-account.ts'

test('账号校验与 Android 对齐', () => {
	assert.equal(
		validateCredentials('', '12345678'),
		'用户名不能为空，密码至少 8 位',
	)
	assert.equal(
		validateCredentials('abc', '123'),
		'用户名不能为空，密码至少 8 位',
	)
	assert.equal(validateCredentials('abc', '12345678'), '')
})

test('登录错误码映射到中文', () => {
	assert.equal(
		mapAuthError(409, { error: 'username_already_exists' }, 'x'),
		'用户名已被占用',
	)
	assert.equal(
		mapAuthError(401, { error: 'invalid_credentials' }, 'x'),
		'用户名或密码错误',
	)
	assert.equal(mapAuthError(401, {}, 'x'), '请先登录 BBPlayer 账号')
	assert.equal(
		mapAuthError(404, { error: 'Playlist not found' }, 'x'),
		'共享歌单不存在或已删除',
	)
})
