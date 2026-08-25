import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
					? await trpc.account.register.mutate({
							username,
							password,
							name: name.trim() || undefined,
							face: face.trim() || undefined,
						})
					: await trpc.account.login.mutate({ username, password })
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
			<div className='flex flex-col gap-4'>
				<p className='text-muted-foreground'>
					BBPlayer 账号用于恢复和订阅共享歌单。
				</p>
				<div className='flex items-center gap-3'>
					<Avatar>
						<AvatarImage
							src={account.face ?? undefined}
							alt=''
						/>
						<AvatarFallback>{account.name.slice(0, 1)}</AvatarFallback>
					</Avatar>
					<div className='min-w-0 flex-1'>
						<div className='truncate font-medium'>{account.name}</div>
						<div className='text-muted-foreground truncate'>
							@{account.username}
						</div>
					</div>
					<Button
						type='button'
						variant='outline'
						onClick={() => {
							void trpc.account.logout.mutate().then((settings) => {
								setAccount(settings.bbplayerAccount)
								setMessage('')
							})
						}}
					>
						退出登录
					</Button>
				</div>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor='bbplayer-name'>昵称</FieldLabel>
						<Input
							id='bbplayer-name'
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
				</FieldGroup>
				<div className='flex flex-wrap gap-2'>
					<Button
						type='button'
						variant='outline'
						disabled={busy}
						onClick={() => {
							setBusy(true)
							void trpc.account.updateProfile
								.mutate({ name, face: face || undefined })
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
					</Button>
					<Button
						type='button'
						variant='outline'
						disabled={busy || !biliLoggedIn}
						onClick={() => {
							setBusy(true)
							void trpc.account.fillFromBili
								.mutate()
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
					</Button>
					<Button
						type='button'
						variant='outline'
						disabled={busy}
						onClick={() => {
							setBusy(true)
							void trpc.account.restore
								.mutate()
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
					</Button>
				</div>
				{message && <p className='text-muted-foreground'>{message}</p>}
			</div>
		)
	}

	return (
		<div className='flex flex-col gap-4'>
			<p className='text-muted-foreground'>
				BBPlayer 账号用于恢复和订阅共享歌单。
			</p>
			<ToggleGroup
				value={[mode]}
				onValueChange={(value) => {
					const next = value[0]
					if (next === 'login' || next === 'register') setMode(next)
				}}
				variant='outline'
				spacing={0}
			>
				<ToggleGroupItem value='login'>登录</ToggleGroupItem>
				<ToggleGroupItem value='register'>注册</ToggleGroupItem>
			</ToggleGroup>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor='bbplayer-username'>用户名</FieldLabel>
					<Input
						id='bbplayer-username'
						value={username}
						onChange={(event) => setUsername(event.target.value)}
						autoComplete='username'
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor='bbplayer-password'>密码</FieldLabel>
					<Input
						id='bbplayer-password'
						type='password'
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						autoComplete={
							mode === 'login' ? 'current-password' : 'new-password'
						}
					/>
				</Field>
				{mode === 'register' && (
					<Field>
						<FieldLabel htmlFor='bbplayer-nickname'>昵称（可选）</FieldLabel>
						<Input
							id='bbplayer-nickname'
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
				)}
			</FieldGroup>
			<Button
				type='button'
				disabled={busy}
				onClick={() => void submit()}
			>
				{busy ? '处理中…' : mode === 'register' ? '注册' : '登录'}
			</Button>
			{message && <p className='text-muted-foreground'>{message}</p>}
		</div>
	)
}
