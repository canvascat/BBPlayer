import assert from 'node:assert/strict'
import { test } from 'node:test'

import { phoneFormModel, phoneLoginError } from './phone-form.ts'

test('手机号校验与 Android 对齐', () => {
	assert.equal(phoneFormModel.tel.validate(''), '请输入手机号')
	assert.equal(phoneFormModel.tel.validate('123'), '手机号格式不正确')
	assert.equal(phoneFormModel.tel.validate('13800138000'), '')
	assert.equal(phoneFormModel.smsCode.validate('12'), '验证码格式不正确')
	assert.equal(phoneFormModel.smsCode.validate('123456'), '')
})

test('图形验证过期文案与 Android 对齐', () => {
	assert.equal(
		phoneLoginError({ code: 86211 }, 'x'),
		'图形验证已过期，请重新获取验证码',
	)
	assert.equal(
		phoneLoginError({ code: -105 }, 'x'),
		'图形验证已过期，请重新获取验证码',
	)
})
