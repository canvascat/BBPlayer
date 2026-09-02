import { Link, Outlet } from '@tanstack/react-router'
import {
	ChevronsUpDownIcon,
	HouseIcon,
	LibraryIcon,
	ListMusicIcon,
	MusicIcon,
	PauseIcon,
	PlayIcon,
	RepeatIcon,
	SearchIcon,
	SettingsIcon,
	ShuffleIcon,
	SkipBackIcon,
	SkipForwardIcon,
	UserIcon,
} from 'lucide-react'

import { useApp } from '@/app-context'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { navLabelClass } from '@/cover-ui'
import { cn } from '@/lib/utils'
import { isLibraryPath } from '@/library-nav'

import { CommentsPanel } from './CommentsPanel'
import { NowPlaying } from './NowPlaying'
import { formatClock, formatMs, repeatLabel } from './playback'

export default function App() {
	const app = useApp()
	const {
		pathname,
		isPlayer,
		player,
		searchRef,
		query,
		setQuery,
		showQueue,
		setShowQueue,
		playlists,
		createTitle,
		pickPlaylistFor,
		setPickPlaylistFor,
		showComments,
		setShowComments,
		account,
		current,
		coverImage,
		closePlayer,
		openPlayer,
		submitSearch,
		addTrackToPlaylist,
		createLocalPlaylist,
		cycleSleep,
	} = app

	return (
		<TooltipProvider>
			<div
				className='relative isolate grid h-full grid-rows-[1fr_var(--bar-h)] bg-background text-foreground'
				style={{
					['--cover-image' as string]: coverImage,
					...(app.skin?.primary
						? {
								['--app-primary' as string]: app.skin.primary,
								['--app-primary-hex' as string]: `rgb(${app.skin.primary})`,
							}
						: {}),
				}}
			>
				<div
					className='grid min-h-0 grid-cols-[var(--sidebar-w)_1px_1fr]'
					inert={isPlayer || undefined}
				>
					<aside className='bg-sidebar text-sidebar-foreground flex flex-col gap-2 overflow-auto p-2'>
						<div
							className='flex min-h-[68px] items-center gap-3 pl-3'
							data-titlebar
						>
							<div
								className='h-3 w-[52px] shrink-0'
								aria-hidden
							/>
							<div className='flex min-w-0 flex-1 items-center gap-2'>
								<span className='bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg'>
									<MusicIcon />
								</span>
								<div className='min-w-0 flex-1'>
									<div className='truncate text-sm font-semibold leading-tight'>
										BBPlayer
									</div>
									<div className='text-muted-foreground truncate text-xs leading-tight'>
										本地音频
									</div>
								</div>
								<ChevronsUpDownIcon className='text-muted-foreground size-4 shrink-0' />
							</div>
						</div>
						<InputGroup className='bg-background'>
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
							<InputGroupInput
								ref={searchRef}
								placeholder='搜索关键词 / BV'
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void submitSearch()
								}}
							/>
						</InputGroup>
						<div className={navLabelClass}>在线音乐</div>
						<Button
							className='h-9 w-full justify-start px-2'
							nativeButton={false}
							render={<Link to='/' />}
							variant={pathname === '/' ? 'secondary' : 'ghost'}
						>
							<HouseIcon data-icon='inline-start' />
							主页
						</Button>
						<Button
							className='h-9 w-full justify-start px-2'
							nativeButton={false}
							render={<Link to='/library' />}
							variant={isLibraryPath(pathname) ? 'secondary' : 'ghost'}
						>
							<LibraryIcon data-icon='inline-start' />
							音乐库
						</Button>
						<div className={navLabelClass}>其他</div>
						<Button
							className='h-9 w-full justify-start px-2'
							nativeButton={false}
							render={<Link to='/settings' />}
							variant={pathname === '/settings' ? 'secondary' : 'ghost'}
						>
							<SettingsIcon data-icon='inline-start' />
							设置
						</Button>
						<div className='flex-1' />
						<Button
							className='h-9 w-full justify-start px-2'
							nativeButton={false}
							render={<Link to='/settings' />}
							variant='ghost'
						>
							<UserIcon data-icon='inline-start' />
							{account?.name ?? '未登录'}
						</Button>
					</aside>
					<Separator orientation='vertical' />
					<main className='bg-background flex min-h-0 min-w-0 flex-col gap-6 overflow-y-auto p-6 [&>*]:shrink-0'>
						<Outlet />
					</main>
				</div>
				<footer
					className='relative flex items-center overflow-visible border-t bg-background px-4 py-3'
					inert={isPlayer || undefined}
				>
					<div className='grid min-h-0 flex-1 grid-cols-3 items-center gap-4'>
						<Button
							className='flex h-auto min-w-0 items-center justify-start gap-3 px-0 text-left hover:bg-transparent'
							variant='ghost'
							type='button'
							onClick={openPlayer}
						>
							{current?.artwork ? (
								<img
									src={current.artwork}
									alt=''
									className='size-12 rounded-lg object-cover'
								/>
							) : (
								<div className='bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-lg'>
									<MusicIcon />
								</div>
							)}
							<div className='min-w-0 text-left'>
								<div className='truncate text-sm'>
									{current?.title ?? '未在播放'}
								</div>
								<div className='text-muted-foreground truncate text-xs'>
									{current?.artist || '从搜索开始'}
								</div>
							</div>
						</Button>
						<div className='flex items-center justify-center gap-2'>
							<Button
								className={cn(player.shuffle && 'bg-muted')}
								variant='ghost'
								size='icon'
								type='button'
								title='随机'
								onClick={player.toggleShuffle}
							>
								<ShuffleIcon />
							</Button>
							<Button
								variant='ghost'
								size='icon'
								type='button'
								onClick={() => player.skip(-1)}
							>
								<SkipBackIcon />
							</Button>
							<Button
								variant='default'
								size='icon'
								type='button'
								onClick={player.toggle}
							>
								{player.playing ? <PauseIcon /> : <PlayIcon />}
							</Button>
							<Button
								variant='ghost'
								size='icon'
								type='button'
								onClick={() => player.skip(1)}
							>
								<SkipForwardIcon />
							</Button>
							<Button
								className={cn(player.repeatMode && 'bg-muted')}
								variant='ghost'
								size='icon'
								title={repeatLabel(player.repeatMode)}
								onClick={player.cycleRepeat}
							>
								<RepeatIcon />
							</Button>
						</div>
						<div className='flex min-w-0 items-center justify-end gap-2'>
							<Button
								variant='ghost'
								type='button'
								onClick={cycleSleep}
							>
								{player.sleepLeft > 0
									? `定时 ${formatMs(player.sleepLeft)}`
									: '定时'}
							</Button>
							<Button
								variant='ghost'
								type='button'
								onClick={player.cycleSpeed}
							>
								{Number(player.playbackRate).toFixed(1)}x
							</Button>
							<Button
								variant='ghost'
								size='icon'
								type='button'
								title='队列'
								onClick={() => setShowQueue((value) => !value)}
							>
								<ListMusicIcon />
							</Button>
							<div className='text-muted-foreground justify-self-end text-sm tabular-nums'>
								{formatClock(player.currentTime)} /{' '}
								{formatClock(player.duration)}
							</div>
						</div>
					</div>
				</footer>
				<Slider
					className={cn(
						'absolute inset-x-0 bottom-[calc(var(--bar-h)-6px)] z-10 flex h-3 items-center px-[3px]',
						isPlayer && 'pointer-events-none',
					)}
					trackClassName='absolute top-1/2 left-[-3px] mt-[-2px] h-1 min-w-[calc(100%+6px)] rounded-none data-horizontal:w-[calc(100%+6px)]'
					min={0}
					max={player.duration || 1}
					value={player.currentTime}
					aria-label='播放进度'
					onValueChange={(value) => {
						const next = Array.isArray(value) ? value[0] : value
						player.seek(Math.round(Number(next)))
					}}
				/>
				{showQueue && (
					<aside
						className={cn(
							'bg-card absolute right-3 w-[360px] max-h-[min(520px,62vh)] overflow-auto rounded-xl border p-3',
							isPlayer
								? 'bottom-4 z-30'
								: 'bottom-[calc(var(--bar-h)+12px)] z-[15]',
						)}
					>
						<div className='flex items-center justify-between gap-2'>
							<strong>播放队列 ({player.queue.length})</strong>
							<div className='flex gap-2'>
								<Button
									type='button'
									size='sm'
									variant='secondary'
									onClick={() => {
										if (!player.queue.length) return
										void createLocalPlaylist(
											player.queue,
											createTitle.trim() || '播放队列',
										)
									}}
								>
									保存为本地歌单
								</Button>
								<Button
									type='button'
									size='sm'
									variant='ghost'
									onClick={() => setShowQueue(false)}
								>
									关闭
								</Button>
							</div>
						</div>
						<div className='mt-2 flex flex-col gap-1'>
							{player.queue.map((item, i) => (
								<div
									className={cn(
										'grid grid-cols-[28px_48px_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2',
										i === player.index && 'bg-muted',
									)}
									key={`${item.id}-${i}`}
								>
									<Button
										className='col-span-3 grid h-auto grid-cols-[28px_48px_1fr] items-center gap-3 p-0 whitespace-normal'
										type='button'
										variant='ghost'
										onClick={() => void player.playTrack(player.queue, i)}
									>
										<span className='text-muted-foreground text-right text-[13px]'>
											{String(i + 1).padStart(2, '0')}
										</span>
										<img
											className='size-12 rounded-lg object-cover'
											src={item.artwork}
											alt=''
										/>
										<div className='min-w-0 text-left'>
											<div className='truncate'>{item.title}</div>
											<div className='text-muted-foreground truncate text-xs'>
												{item.artist}
											</div>
										</div>
									</Button>
									<Button
										type='button'
										size='sm'
										variant='ghost'
										onClick={() => player.removeFromQueue(item.id)}
									>
										移除
									</Button>
								</div>
							))}
						</div>
					</aside>
				)}
				{isPlayer && current && (
					<NowPlaying
						track={current}
						player={player}
						commentsOpen={showComments}
						queueOpen={showQueue}
						onClose={closePlayer}
						onToggleComments={() => setShowComments((value) => !value)}
						onToggleQueue={() => setShowQueue((value) => !value)}
						onSleep={cycleSleep}
					>
						{showComments && (
							<CommentsPanel
								key={current.bvid}
								bvid={current.bvid}
								onClose={() => setShowComments(false)}
							/>
						)}
					</NowPlaying>
				)}
				<audio
					ref={player.audioRef}
					preload='auto'
				/>
				<Dialog
					open={Boolean(pickPlaylistFor)}
					onOpenChange={(open) => {
						if (!open) setPickPlaylistFor(null)
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>添加到本地歌单</DialogTitle>
						</DialogHeader>
						{playlists.length === 0 && (
							<p className='text-muted-foreground'>
								还没有歌单。先在音乐库创建一个。
							</p>
						)}
						<div className='flex flex-col gap-1'>
							{playlists.map((playlist) => (
								<Button
									key={playlist.id}
									type='button'
									variant='ghost'
									className='h-auto justify-between'
									onClick={() =>
										void addTrackToPlaylist(playlist.id, pickPlaylistFor!)
									}
								>
									<span>{playlist.title}</span>
									<span className='text-muted-foreground'>
										{playlist.itemCount} 首
									</span>
								</Button>
							))}
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</TooltipProvider>
	)
}
