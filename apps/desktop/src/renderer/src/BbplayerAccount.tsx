import { useEffect, useState } from 'react'

import { trpc } from './trpc'

type Mode = 'login' | 'register'

export function BbplayerAccount({
	biliLoggedIn,
	onPlaylistsChanged,
}: {
	biliLoggedIn: boolean
	onPlaylistsChanged: () => void
}) {
	const [mode, setMode] = useState<Mode>('login')
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [name, setName] = useState('')
	const [face, setFace] = useState('')
	const [busy, setBusy] = useState(false)
	const [message, setMessage] = useState('')
	const [account, setAccount] = useState<{
		id: string
		username: string
		name: string
		face: string | null
	} | null>(null)

	const load = async () => {
		const settings = await trpc.settings.get.query()
		setAccount(settings.bbplayerAccount)
		if (settings.bbplayerAccount) {
			setName(settings.bbplayerAccount.name)
			setFace(settings.bbplayerAccount.face ?? '')
			setUsername(settings.bbplayerAccount.username)
		}
	}

	useEffect(() => {
		void load()
	}, [])

	const applySettings = (
		settings: Awaited<ReturnType<typeof trpc.settings.get.query>> & {
			restoreMessage?: string
		},
	) => {
		setAccount(settings.bbplayerAccount)
		if (settings.bbplayerAccount) {
			setName(settings.bbplayerAccount.name)
			setFace(settings.bbplayerAccount.face ?? '')
			setUsername(settings.bbplayerAccount.username)
		}
		if (settings.restoreMessage) setMessage(settings.restoreMessage)
		onPlaylistsChanged()
	}

	const submit = async () => {
		setBusy(true)
		setMessage('')
		try {
			const settings =
				mode === 'register'
					? await window.bbplayer.registerBbplayer({
							username,
							password,
							name: name.trim() || undefined,
							face: face.trim() || undefined,
						})
					: await window.bbplayer.loginBbplayer({ username, password })
			setPassword('')
			applySettings(settings)
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error))
		} finally {
			setBusy(false)
		}
	}

	if (account) {
		return (
			<div className='bbplayer-account'>
				<p className='muted'>BBPlayer 账号用于恢复和订阅共享歌单。</p>
				<div className='account-row'>
					{account.face ? (
						<img
							src={account.face}
							alt=''
						/>
					) : (
						<div className='cover-fallback small'>
							{account.name.slice(0, 1)}
						</div>
					)}
					<div>
						<div className='title'>{account.name}</div>
						<div className='muted'>@{account.username}</div>
					</div>
					<button
						className='chip'
						type='button'
						onClick={() => {
							void window.bbplayer.logoutBbplayer().then((settings) => {
								setAccount(settings.bbplayerAccount)
								setMessage('')
							})
						}}
					>
						退出登录
					</button>
				</div>
				<label className='field'>
					昵称
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</label>
				<div className='chips'>
					<button
						className='chip'
						type='button'
						disabled={busy}
						onClick={() => {
							setBusy(true)
							void window.bbplayer
								.updateBbplayerProfile({ name, face: face || undefined })
								.then(applySettings)
								.catch((error) =>
									setMessage(
										error instanceof Error ? error.message : String(error),
									),
								)
								.finally(() => setBusy(false))
						}}
					>
						保存资料
					</button>
					<button
						className='chip'
						type='button'
						disabled={busy || !biliLoggedIn}
						onClick={() => {
							setBusy(true)
							void window.bbplayer
								.fillBbplayerFromBili()
								.then(applySettings)
								.catch((error) =>
									setMessage(
										error instanceof Error ? error.message : String(error),
									),
								)
								.finally(() => setBusy(false))
						}}
					>
						用 B 站资料填充
					</button>
					<button
						className='chip'
						type='button'
						disabled={busy}
						onClick={() => {
							setBusy(true)
							void window.bbplayer
								.restoreSharedPlaylists()
								.then((result) => {
									setMessage(result.message)
									onPlaylistsChanged()
								})
								.catch((error) =>
									setMessage(
										error instanceof Error ? error.message : String(error),
									),
								)
								.finally(() => setBusy(false))
						}}
					>
						同步云端共享歌单
					</button>
				</div>
				{message && <p className='muted'>{message}</p>}
			</div>
		)
	}

	return (
		<div className='bbplayer-account'>
			<p className='muted'>BBPlayer 账号用于恢复和订阅共享歌单。</p>
			<div className='chips'>
				<button
					className={`chip ${mode === 'login' ? 'on' : ''}`}
					type='button'
					onClick={() => setMode('login')}
				>
					登录
				</button>
				<button
					className={`chip ${mode === 'register' ? 'on' : ''}`}
					type='button'
					onClick={() => setMode('register')}
				>
					注册
				</button>
			</div>
			<label className='field'>
				用户名
				<input
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					autoComplete='username'
				/>
			</label>
			<label className='field'>
				密码
				<input
					type='password'
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
				/>
			</label>
			{mode === 'register' && (
				<label className='field'>
					昵称（可选）
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</label>
			)}
			<div className='chips'>
				<button
					className='chip'
					type='button'
					disabled={busy}
					onClick={() => void submit()}
				>
					{busy ? '处理中…' : mode === 'register' ? '注册' : '登录'}
				</button>
			</div>
			{message && <p className='muted'>{message}</p>}
		</div>
	)
}
