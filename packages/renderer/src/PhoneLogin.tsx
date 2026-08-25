import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import { trpc } from './trpc'

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
			const result = await trpc.auth.phoneStart.mutate({ tel })
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
			await trpc.auth.phoneLogin.mutate({
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
		<div className='flex flex-col gap-3'>
			<p className='text-muted-foreground'>或使用手机号登录</p>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor='phone-login-tel'>手机号</FieldLabel>
					<Input
						id='phone-login-tel'
						value={tel}
						onChange={(event) => setTel(event.target.value)}
						placeholder='11 位手机号'
						inputMode='numeric'
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor='phone-login-code'>短信验证码</FieldLabel>
					<div className='flex gap-2'>
						<Input
							id='phone-login-code'
							value={code}
							onChange={(event) => setCode(event.target.value)}
							placeholder='短信验证码'
							inputMode='numeric'
						/>
						<Button
							type='button'
							variant='outline'
							disabled={busy}
							onClick={() => void sendSms()}
						>
							{busy ? '处理中…' : '获取验证码'}
						</Button>
					</div>
				</Field>
			</FieldGroup>
			<Button
				type='button'
				disabled={busy || !captchaKey}
				onClick={() => void login()}
			>
				登录
			</Button>
			{message && <p className='text-muted-foreground'>{message}</p>}
		</div>
	)
}
