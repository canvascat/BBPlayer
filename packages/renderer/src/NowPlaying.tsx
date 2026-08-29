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

export function NowPlaying({
	track,
	player,
	commentsOpen,
	queueOpen,
	onClose,
	onToggleComments,
	onToggleQueue,
	onSleep,
}: {
	track: TrackItem
	player: Playback
	commentsOpen: boolean
	queueOpen: boolean
	onClose: () => void
	onToggleComments: () => void
	onToggleQueue: () => void
	onSleep: () => void
}) {
	const remaining = Math.max(0, player.duration - player.currentTime)

	return (
		<section className='now-playing'>
			<div className='now-playing-bg' />
			<div className='now-playing-scrim' />
			<div className='now-playing-top'>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					aria-label='收起播放页'
					onClick={onClose}
				>
					<ChevronDownIcon />
				</Button>
			</div>
			<div className='now-playing-stage'>
				<div className='now-playing-col'>
					<img
						className='now-playing-art'
						src={track.artwork}
						alt=''
					/>
					<div className='now-playing-heading'>
						<div className='now-playing-titles'>
							<h1>{track.title}</h1>
							<p>{track.artist}</p>
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
					<div className='now-playing-seek'>
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
						<div className='now-playing-times'>
							<span>{formatClock(player.currentTime)}</span>
							<span>-{formatClock(remaining)}</span>
						</div>
					</div>
					<div className='now-playing-transport'>
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
				<div className='now-playing-lyrics'>
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
						<p className='now-playing-empty'>暂无歌词</p>
					)}
				</div>
			</div>
			<div className='now-playing-dock'>
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
		</section>
	)
}
