import { createFileRoute } from '@tanstack/react-router'

import { useApp } from '@/app-context'
import { SettingSwitch } from '@/components/setting-switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
} from '@/components/ui/card'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { pageTitleClass } from '@/cover-ui'
import { SkinPicker } from '@/SkinPicker'
import { trpcClient } from '@/trpc'

export const Route = createFileRoute('/settings')({
	component: SettingsPage,
})

function SettingsPage() {
	const {
		account,
		logout,
		loginBusy,
		connectBili,
		loginMessage,
		continuePlayingAfterClose,
		setContinuePlayingAfterClose,
		menuBarShowLyrics,
		setMenuBarShowLyrics,
		autoCache,
		setAutoCache,
		lyricSource,
		setLyricSource,
		exportCached,
		refreshPlaylists,
		setSaved,
		skin,
		setSkin,
		saved,
	} = useApp()

	return (
		<>
			<h1 className={pageTitleClass}>设置</h1>
			<Card>
				<CardHeader>
					<CardDescription>
						在官方页面登录后可打开收藏夹、合集和稍后再看。
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{account ? (
						<div className='flex items-center gap-3'>
							<Avatar size='lg'>
								<AvatarImage
									src={account.face}
									alt=''
								/>
								<AvatarFallback>{account.name.slice(0, 1)}</AvatarFallback>
							</Avatar>
							<div className='min-w-0 flex-1'>
								<div className='truncate font-medium'>{account.name}</div>
								<div className='text-muted-foreground'>UID {account.mid}</div>
							</div>
							<Button
								type='button'
								variant='outline'
								onClick={() => void logout()}
							>
								退出登录
							</Button>
						</div>
					) : (
						<div className='flex flex-col gap-3'>
							<Button
								type='button'
								variant='secondary'
								disabled={loginBusy}
								onClick={() => void connectBili()}
							>
								{loginBusy ? '登录中…' : '连接 Bilibili'}
							</Button>
							{loginMessage && (
								<p className='text-muted-foreground'>{loginMessage}</p>
							)}
						</div>
					)}
					<SettingSwitch
						id='continue-playing'
						label='关闭窗口后继续播放'
						checked={continuePlayingAfterClose}
						onCheckedChange={setContinuePlayingAfterClose}
					/>
					<SettingSwitch
						id='menubar-lyrics'
						label='菜单栏显示歌词'
						checked={menuBarShowLyrics}
						onCheckedChange={setMenuBarShowLyrics}
					/>
					<SettingSwitch
						id='auto-cache'
						label='播放时自动缓存音频'
						checked={autoCache}
						onCheckedChange={setAutoCache}
					/>
					<Field orientation='horizontal'>
						<FieldContent>
							<FieldLabel id='lyric-source'>自动匹配的歌词源</FieldLabel>
							<FieldDescription>
								默认只用网易云。选「自动」时取最先返回的源，不保证匹配最好。
							</FieldDescription>
						</FieldContent>
						<ToggleGroup
							value={[lyricSource]}
							onValueChange={(value) => {
								const next = value[0]
								if (
									next === 'auto' ||
									next === 'netease' ||
									next === 'qqmusic' ||
									next === 'kugou'
								) {
									setLyricSource(next)
								}
							}}
							variant='outline'
							size='sm'
							spacing={0}
							aria-labelledby='lyric-source'
							className='max-w-xs flex-wrap'
						>
							<ToggleGroupItem value='netease'>网易云</ToggleGroupItem>
							<ToggleGroupItem value='qqmusic'>QQ 音乐</ToggleGroupItem>
							<ToggleGroupItem value='kugou'>酷狗</ToggleGroupItem>
							<ToggleGroupItem value='auto'>自动</ToggleGroupItem>
						</ToggleGroup>
					</Field>
					<div className='flex flex-wrap gap-2'>
						<Button
							type='button'
							variant='outline'
							onClick={() => void exportCached()}
						>
							导出已缓存音频
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={async () => {
								const result = (await trpcClient.backup.import.mutate()) as {
									message: string
								}
								setSaved(result.message)
								await refreshPlaylists()
							}}
						>
							导入备份
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={async () => {
								const result = (await trpcClient.backup.export.mutate()) as {
									message: string
								}
								setSaved(result.message)
							}}
						>
							导出备份
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={async () => {
								const result = await trpcClient.desktop.checkUpdate.mutate()
								setSaved(result.message)
							}}
						>
							检查更新
						</Button>
					</div>
					<SkinPicker
						value={skin}
						onChange={setSkin}
					/>
				</CardContent>
				{saved && (
					<CardFooter>
						<p className='text-muted-foreground'>{saved}</p>
					</CardFooter>
				)}
			</Card>
		</>
	)
}
