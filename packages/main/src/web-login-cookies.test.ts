import { test, assert } from 'vitest'

import {
	electronCookiesToHeader,
	isAllowedLoginPopupUrl,
	isCompleteBiliLoginCookies,
} from './web-login-cookies.ts'

test('三个核心 Cookie 齐全才算登录完成', () => {
	assert.equal(isCompleteBiliLoginCookies([]), false)
	assert.equal(
		isCompleteBiliLoginCookies([{ name: 'SESSDATA', value: 'a' }]),
		false,
	)
	assert.equal(
		isCompleteBiliLoginCookies([
			{ name: 'SESSDATA', value: 'a' },
			{ name: 'bili_jct', value: 'b' },
			{ name: 'DedeUserID', value: '' },
		]),
		false,
	)
	assert.equal(
		isCompleteBiliLoginCookies([
			{ name: 'SESSDATA', value: 'a' },
			{ name: 'bili_jct', value: 'b' },
			{ name: 'DedeUserID', value: '1' },
		]),
		true,
	)
})

test('只把 bili 域 Cookie 拼成请求头，同名后者覆盖', () => {
	const header = electronCookiesToHeader([
		{ name: 'SESSDATA', value: 'old', domain: '.bilibili.com' },
		{ name: 'tracker', value: 'x', domain: '.example.com' },
		{ name: 'SESSDATA', value: 'new', domain: '.bilibili.com' },
		{ name: 'bili_jct', value: 'csrf', domain: 'bilibili.com' },
		{ name: 'buvid3', value: 'dev' },
	])
	assert.equal(header, 'SESSDATA=new; bili_jct=csrf; buvid3=dev')
})

test('仅允许 B 站与微信 QQ 微博登录弹窗', () => {
	assert.equal(
		isAllowedLoginPopupUrl('https://passport.bilibili.com/login'),
		true,
	)
	assert.equal(
		isAllowedLoginPopupUrl('https://open.weixin.qq.com/connect'),
		true,
	)
	assert.equal(isAllowedLoginPopupUrl('https://graph.qq.com/oauth2.0'), true)
	assert.equal(isAllowedLoginPopupUrl('https://api.weibo.com/oauth2'), true)
	assert.equal(isAllowedLoginPopupUrl('https://evil.example/phish'), false)
	assert.equal(isAllowedLoginPopupUrl('not a url'), false)
})
