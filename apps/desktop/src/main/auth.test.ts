import { test, assert } from 'vitest'

import { formatDuration, qrStatusText, setCookiesToHeader } from './auth.ts'

test('扫码状态文案与 Android 对齐', () => {
	assert.equal(qrStatusText(86101), '等待扫码')
	assert.equal(qrStatusText(86090), '已扫码，等待确认')
	assert.equal(qrStatusText(86038), '二维码已过期')
	assert.equal(qrStatusText(0), '登录成功')
})

test('Set-Cookie 会合并成请求头', () => {
	const header = setCookiesToHeader([
		'SESSDATA=abc; Path=/; HttpOnly',
		'bili_jct=token; Path=/',
		'SESSDATA=newer; Path=/',
	])
	assert.equal(header, 'SESSDATA=newer; bili_jct=token')
})

test('时长格式化', () => {
	assert.equal(formatDuration(125), '2:05')
})
