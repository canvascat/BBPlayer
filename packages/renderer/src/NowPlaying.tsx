import { LyricPlayer } from '@applemusic-like-lyrics/react'
import {
	ChevronDownIcon,
	EllipsisIcon,
	ListMusicIcon,
	PauseIcon,
	PlayIcon,
	RepeatIcon,
	ShuffleIcon,
	SkipBackIcon,
	SkipForwardIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

import { formatClock, formatMs, repeatLabel, type TrackItem } from './playback'
import type { usePlayback } from './usePlayback'

type Playback = ReturnType<typeof usePlayback>

const ENTER_MS = 320
const EXIT_MS = 240

export function NowPlaying({
	track,
	player,
	commentsOpen,
	queueOpen,
	children,
	onClose,
	onToggleComments,
	onToggleQueue,
	onSleep,
}: {
	track: TrackItem
	player: Playback
	commentsOpen: boolean
	queueOpen: boolean
	children?: ReactNode
	onClose: () => void
	onToggleComments: () => void
	onToggleQueue: () => void
	onSleep: () => void
}) {
	const remaining = Math.max(0, player.duration - player.currentTime)
	const [leaving, setLeaving] = useState(false)
	const onCloseRef = useRef(onClose)

	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	const requestClose = useCallback(() => {
		setLeaving(true)
	}, [])

	useEffect(() => {
		if (!leaving) return
		const reduced = window.matchMedia(
			'(prefers-reduced-motion: reduce)',
		).matches
		const id = window.setTimeout(
			() => onCloseRef.current(),
			reduced ? 0 : EXIT_MS,
		)
		return () => window.clearTimeout(id)
	}, [leaving])

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code !== 'Escape' || event.defaultPrevented) return
			event.preventDefault()
			requestClose()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [requestClose])

	return (
		<section
			className={cn(
				'bg-background text-foreground absolute inset-0 z-20 grid grid-rows-[52px_1fr] overflow-hidden motion-reduce:animate-none',
				leaving
					? 'animate-out slide-out-to-bottom fill-mode-forwards ease-in'
					: 'animate-in slide-in-from-bottom fill-mode-both ease-out',
			)}
			style={{
				animationDuration: `${leaving ? EXIT_MS : ENTER_MS}ms`,
			}}
			data-player-page
		>
			<div className='flex items-center justify-end px-4'>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					aria-label='收起播放页'
					onClick={requestClose}
				>
					<ChevronDownIcon />
				</Button>
			</div>
			<div className='grid min-h-0 grid-cols-[1fr_minmax(256px,320px)_1fr] items-stretch gap-6 px-6 pb-6 max-[980px]:grid-cols-[220px_1fr] max-[980px]:px-8 max-[980px]:pt-2 max-[980px]:pb-16'>
				<div className='col-start-2 flex w-full min-w-0 flex-col items-center justify-center'>
					<img
						className='bg-muted size-64 rounded-xl object-cover'
						src={track.artwork}
						alt=''
					/>
					<div className='mt-4 flex w-full flex-col items-center gap-2'>
						<div className='min-w-0 text-center'>
							<h1 className='truncate text-3xl font-semibold tracking-tight'>
								{track.title}
							</h1>
							<p className='text-muted-foreground mt-1 truncate text-base'>
								{track.artist}
							</p>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant='ghost'
										size='icon'
										aria-label='更多'
									/>
								}
							>
								<EllipsisIcon />
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end'>
								<DropdownMenuGroup>
									<DropdownMenuItem onClick={onSleep}>
										{player.sleepLeft > 0
											? `定时 ${formatMs(player.sleepLeft)}`
											: '定时关闭'}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={player.cycleSpeed}>
										倍速 {player.playbackRate}x
									</DropdownMenuItem>
									<DropdownMenuItem onClick={onToggleComments}>
										{commentsOpen ? '关闭评论' : '评论'}
									</DropdownMenuItem>
								</DropdownMenuGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<div className='mt-4 w-full max-w-64'>
						<Slider
							min={0}
							max={player.duration || 1}
							value={player.currentTime}
							aria-label='播放进度'
							onValueChange={(value) => {
								const next = Array.isArray(value) ? value[0] : value
								player.seek(Math.round(Number(next)))
							}}
						/>
						<div className='text-muted-foreground mt-1.5 flex justify-between text-xs tabular-nums'>
							<span>{formatClock(player.currentTime)}</span>
							<span>-{formatClock(remaining)}</span>
						</div>
					</div>
					<div className='mt-4 flex w-full max-w-64 items-center justify-center gap-2'>
						<Button
							className={cn(player.shuffle && 'bg-muted')}
							type='button'
							variant='ghost'
							size='icon'
							title='随机'
							onClick={player.toggleShuffle}
						>
							<ShuffleIcon />
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							aria-label='上一首'
							onClick={() => player.skip(-1)}
						>
							<SkipBackIcon />
						</Button>
						<Button
							type='button'
							variant='default'
							size='icon'
							aria-label={player.playing ? '暂停' : '播放'}
							onClick={player.toggle}
						>
							{player.playing ? <PauseIcon /> : <PlayIcon />}
						</Button>
						<Button
							type='button'
							variant='ghost'
							size='icon'
							aria-label='下一首'
							onClick={() => player.skip(1)}
						>
							<SkipForwardIcon />
						</Button>
						<Button
							className={cn(player.repeatMode && 'bg-muted')}
							type='button'
							variant='ghost'
							size='icon'
							title={repeatLabel(player.repeatMode)}
							onClick={player.cycleRepeat}
						>
							<RepeatIcon />
						</Button>
					</div>
				</div>
				<div
					className='relative col-start-3 h-full min-h-0 pr-2 font-semibold tracking-tight [--amll-lp-color:var(--foreground)] [--amll-lp-font-size:max(18px,3.2vh,1.6vw)] [--amll-lp-hover-bg-color:transparent] [--amll-lp-line-width-aspect:1] [&_.amll-lyric-player]:h-full'
					data-lyrics
				>
					{player.lyrics.length > 0 ? (
						<LyricPlayer
							lyricLines={player.lyrics}
							currentTime={Math.round(player.currentTime)}
							playing={player.playing}
							enableBlur
							enableScale
							alignAnchor='center'
							alignPosition={0.4}
							wordFadeWidth={0.5}
							style={{ height: '100%', width: '100%' }}
							onLyricLineClick={(event) => {
								const line = player.lyrics[event.lineIndex]
								if (line) player.seek(line.startTime)
							}}
						/>
					) : (
						<p className='text-muted-foreground m-0 grid h-full place-items-center text-[22px]'>
							暂无歌词
						</p>
					)}
				</div>
			</div>
			<div className='absolute right-[22px] bottom-[22px] flex gap-1'>
				<Button
					className={cn(queueOpen && 'bg-muted')}
					type='button'
					variant='ghost'
					size='icon'
					title='队列'
					aria-label='队列'
					onClick={onToggleQueue}
				>
					<ListMusicIcon />
				</Button>
			</div>
			{children}
		</section>
	)
}
