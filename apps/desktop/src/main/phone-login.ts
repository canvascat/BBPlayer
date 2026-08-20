import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { BrowserWindow, ipcMain, app } from 'electron'

import { setCookiesToHeader } from './auth'
import { phoneLoginError } from './phone-form'

export { phoneFormModel } from './phone-form'

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

function buildGeetestHtml(gt: string, challenge: string) {
	const gtJson = JSON.stringify(gt)
	const challengeJson = JSON.stringify(challenge)
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .card {
      background: #fff; border-radius: 8px; padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12); width: 90%; max-width: 340px;
    }
    h3 { text-align: center; margin-bottom: 16px; font-size: 16px; color: #333; }
    .err { color: #d32f2f; text-align: center; margin-top: 10px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h3>请完成安全验证</h3>
    <div id="captcha"></div>
    <div class="err" id="err-msg"></div>
  </div>
  <script src="https://static.geetest.com/static/js/gt.0.4.9.js"></script>
  <script>
    initGeetest({
      gt: ${gtJson},
      challenge: ${challengeJson},
      offline: false,
      new_captcha: true,
      product: 'popup',
      width: '100%',
      https: true
    }, function(captchaObj) {
      captchaObj.appendTo('#captcha');
      captchaObj.onSuccess(function() {
        var r = captchaObj.getValidate();
        if (window.bbplayer && window.bbplayer.completeGeetest) {
          window.bbplayer.completeGeetest({
            validate: r.geetest_validate,
            seccode: r.geetest_seccode,
            challenge: r.geetest_challenge
          });
        }
      });
      captchaObj.onError(function() {
        document.getElementById('err-msg').textContent = '验证出错，请关闭后重试';
      });
    });
  </script>
</body>
</html>`
}

export function openGeetestWindow(options: {
	gt: string
	challenge: string
	preload: string
	parent?: Electron.BrowserWindow | null
}) {
	return new Promise<{
		validate: string
		seccode: string
		challenge: string
	}>((resolve, reject) => {
		const win = new BrowserWindow({
			width: 420,
			height: 520,
			parent: options.parent ?? undefined,
			modal: Boolean(options.parent),
			title: '安全验证',
			resizable: false,
			minimizable: false,
			webPreferences: {
				preload: options.preload,
				sandbox: false,
				contextIsolation: true,
			},
		})
		const htmlPath = join(app.getPath('temp'), 'bbplayer-geetest.html')
		writeFileSync(
			htmlPath,
			buildGeetestHtml(options.gt, options.challenge),
			'utf8',
		)
		let settled = false
		const finish = (
			error: Error | null,
			result?: { validate: string; seccode: string; challenge: string },
		) => {
			if (settled) return
			settled = true
			ipcMain.removeListener('geetest:done', onDone)
			if (!win.isDestroyed()) win.close()
			if (error) reject(error)
			else if (result) resolve(result)
			else reject(new Error('已取消安全验证'))
		}
		const onDone = (
			_event: Electron.IpcMainEvent,
			payload: { validate?: string; seccode?: string; challenge?: string },
		) => {
			if (!payload?.validate || !payload.seccode || !payload.challenge) return
			finish(null, {
				validate: payload.validate,
				seccode: payload.seccode,
				challenge: payload.challenge,
			})
		}
		ipcMain.on('geetest:done', onDone)
		win.on('closed', () => {
			finish(new Error('已取消安全验证'))
		})
		void win.loadFile(htmlPath)
	})
}
