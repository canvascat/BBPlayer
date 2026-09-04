import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { BrowserWindow, app } from 'electron'

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
        fetch('app://localhost/trpc/auth.completeGeetest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            json: {
              validate: r.geetest_validate,
              seccode: r.geetest_seccode,
              challenge: r.geetest_challenge
            }
          })
        });
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
	waitForDone: () => Promise<{
		validate: string
		seccode: string
		challenge: string
	}>
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
			if (!win.isDestroyed()) win.close()
			if (error) reject(error)
			else if (result) resolve(result)
			else reject(new Error('已取消安全验证'))
		}
		void options.waitForDone().then(
			(result) => finish(null, result),
			(error: unknown) =>
				finish(error instanceof Error ? error : new Error(String(error))),
		)
		win.on('closed', () => {
			finish(new Error('已取消安全验证'))
		})
		void win.loadFile(htmlPath)
	})
}
