import { setCookiesToHeader } from './auth'
import { phoneLoginError } from './phone-form'

const PASSPORT_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/6.66.0'

export async function getPhoneLoginCaptcha() {
	const response = await fetch(
		`https://passport.bilibili.com/x/passport-login/captcha?source=main_web&t=${Date.now()}`,
		{
			headers: {
				'User-Agent': PASSPORT_UA,
				Referer: 'https://www.bilibili.com/',
			},
		},
	)
	const json = (await response.json()) as {
		code: number
		message?: string
		data?: {
			token: string
			geetest?: { gt: string; challenge: string }
		}
	}
	if (json.code !== 0 || !json.data?.token || !json.data.geetest?.gt) {
		throw new Error(phoneLoginError(json, '获取验证码 token 失败'))
	}
	return {
		token: json.data.token,
		gt: json.data.geetest.gt,
		challenge: json.data.geetest.challenge,
	}
}

export async function sendPhoneLoginSms(payload: {
	tel: string
	cid?: string
	token: string
	challenge: string
	validate: string
	seccode: string
}) {
	const body = new URLSearchParams({
		cid: payload.cid ?? '86',
		tel: payload.tel.trim(),
		source: 'main_mini_login',
		token: payload.token,
		challenge: payload.challenge,
		validate: payload.validate,
		seccode: payload.seccode,
	}).toString()
	const response = await fetch(
		'https://passport.bilibili.com/x/passport-login/web/sms/send',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': PASSPORT_UA,
				Referer: 'https://www.bilibili.com/',
				Origin: 'https://www.bilibili.com',
			},
			body,
		},
	)
	const json = (await response.json()) as {
		code: number
		message?: string
		data?: { captcha_key?: string }
	}
	if (json.code !== 0 || !json.data?.captcha_key) {
		throw new Error(phoneLoginError(json, '发送短信验证码失败'))
	}
	return { captchaKey: json.data.captcha_key }
}

export async function loginWithPhoneSms(payload: {
	tel: string
	cid?: string
	code: string
	captchaKey: string
}) {
	const body = new URLSearchParams({
		cid: payload.cid ?? '86',
		tel: payload.tel.trim(),
		code: payload.code.trim(),
		source: 'main_mini_login',
		captcha_key: payload.captchaKey,
		keep: '1',
	}).toString()
	const response = await fetch(
		'https://passport.bilibili.com/x/passport-login/web/login/sms',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': PASSPORT_UA,
				Referer: 'https://www.bilibili.com/',
				Origin: 'https://www.bilibili.com',
			},
			body,
		},
	)
	const json = (await response.json()) as { code: number; message?: string }
	if (json.code !== 0) {
		throw new Error(phoneLoginError(json, '短信验证码登录失败'))
	}
	const setCookies = response.headers.getSetCookie?.() ?? []
	if (!setCookies.length) {
		const combined = response.headers.get('set-cookie')
		if (!combined) throw new Error('登录成功但未获取到 Cookie')
		return setCookiesToHeader([combined])
	}
	return setCookiesToHeader(setCookies)
}
