import { useState } from 'react'

export function PhoneLogin({
	disabled,
	onLoggedIn,
}: {
	disabled?: boolean
	onLoggedIn: () => void
}) {
	const [tel, setTel] = useState('')
	const [code, setCode] = useState('')
	const [captchaKey, setCaptchaKey] = useState('')
	const [message, setMessage] = useState('')
	const [busy, setBusy] = useState(false)

	const sendSms = async () => {
		setBusy(true)
		setMessage('')
		try {
			const result = await window.bbplayer.startPhoneLogin(tel)
			setCaptchaKey(result.captchaKey)
			setMessage('验证码已发送')
		} catch (err) {
			setMessage(err instanceof Error ? err.message : String(err))
		} finally {
			setBusy(false)
		}
	}

	const login = async () => {
		setBusy(true)
		setMessage('')
		try {
			await window.bbplayer.loginWithPhone({
				tel,
				code,
				captchaKey,
			})
			setMessage('登录成功')
			onLoggedIn()
		} catch (err) {
			setMessage(err instanceof Error ? err.message : String(err))
		} finally {
			setBusy(false)
		}
	}

	if (disabled) return null

	return (
		<div className='phone-login'>
			<p className='muted'>或使用手机号登录</p>
			<label className='field'>
				手机号
				<input
					value={tel}
					onChange={(event) => setTel(event.target.value)}
					placeholder='11 位手机号'
					inputMode='numeric'
				/>
			</label>
			<div className='chips'>
				<button
					className='chip'
					type='button'
					disabled={busy}
					onClick={() => void sendSms()}
				>
					{busy ? '处理中…' : '获取验证码'}
				</button>
			</div>
			<label className='field'>
				短信验证码
				<input
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder='短信验证码'
					inputMode='numeric'
				/>
			</label>
			<button
				className='chip'
				type='button'
				disabled={busy || !captchaKey}
				onClick={() => void login()}
			>
				登录
			</button>
			{message && <p className='muted'>{message}</p>}
		</div>
	)
}
