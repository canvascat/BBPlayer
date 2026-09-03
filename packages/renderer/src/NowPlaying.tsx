import '@applemusic-like-lyrics/core/style.css'

import {
	BackgroundRender,
	LyricPlayer,
	MeshGradientRenderer,
	PixiRenderer,
} from '@applemusic-like-lyrics/react'
import {
	CaptionsIcon,
	ChevronDownIcon,
	EllipsisIcon,
	LanguagesIcon,
	ListMusicIcon,
	PauseIcon,
	PlayIcon,
	RepeatIcon,
	ShuffleIcon,
	SkipBackIcon,
	SkipForwardIcon,
	SpeechIcon,
} from 'lucide-react'
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react'

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

import { lyricBgRendererLabel } from './lyric-bg-renderer'
import {
	applyLyricAuxDisplay,
	lyricLinesHaveRoman,
	lyricLinesHaveTranslation,
} from './lyric-overlay'
import { LyricOffsetRail } from './LyricOffsetRail'
import {
	LYRIC_MOTION_EASE,
	lyricsPanelTransition,
	lyricsPanelVisible,
	PLAYER_COLUMN,
	playerStageColumns,
	STAGE_MOVE_MS,
} from './now-playing-layout'
import { formatClock, formatMs, repeatLabel, type TrackItem } from './playback'
import { useLyricAuxDisplay } from './useLyricAuxDisplay'
import { useLyricBgRenderer } from './useLyricBgRenderer'
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
	const [lyricsOpen, setLyricsOpen] = useState(true)
	const [offsetOpen, setOffsetOpen] = useState(false)
	const [bgKind, setBgKind] = useLyricBgRenderer()
	const aux = useLyricAuxDisplay()
	const lyricsVisible = lyricsPanelVisible(lyricsOpen)
	const canAdjustOffset = lyricsOpen && player.lyrics.length > 0
	const hasTranslation = lyricLinesHaveTranslation(player.lyrics)
	const hasRoman = lyricLinesHaveRoman(player.lyrics)
	const displayedLyrics = useMemo(
		() =>
			applyLyricAuxDisplay(player.lyrics, {
				translation: aux.translation,
				roman: aux.roman,
			}),
		[player.lyrics, aux.translation, aux.roman],
	)
	const onCloseRef = useRef(onClose)

	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	useEffect(() => {
		setOffsetOpen(false)
	}, [track.id])

	useEffect(() => {
		if (!lyricsOpen) setOffsetOpen(false)
	}, [lyricsOpen])

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
				'dark text-foreground bg-background absolute inset-0 z-20 grid grid-rows-[52px_1fr] overflow-hidden motion-reduce:animate-none',
				leaving
					? 'animate-out slide-out-to-bottom fill-mode-forwards ease-in'
					: 'animate-in slide-in-from-bottom fill-mode-both ease-out',
			)}
			style={{
				animationDuration: `${leaving ? EXIT_MS : ENTER_MS}ms`,
			}}
			data-player-page
			data-lyrics-open={lyricsOpen ? 'true' : 'false'}
		>
			<BackgroundRender
				className='pointer-events-none absolute inset-0'
				style={{ display: 'block' }}
				album={track.artwork || undefined}
				playing={player.playing}
				hasLyric={player.lyrics.length > 0}
				staticMode={
					window.matchMedia('(prefers-reduced-motion: reduce)').matches
				}
				renderer={bgKind === 'pixi' ? PixiRenderer : MeshGradientRenderer}
			/>
			<div className='relative flex items-center justify-end px-4'>
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
			<div
				className='relative grid h-full min-h-0 items-stretch pb-16 motion-reduce:transition-none'
				data-player-stage
				style={{
					gridTemplateColumns: playerStageColumns(lyricsOpen),
					transitionProperty: 'grid-template-columns',
					transitionDuration: `${STAGE_MOVE_MS}ms`,
					transitionTimingFunction: LYRIC_MOTION_EASE,
				}}
			>
				<div
					className='col-start-2 flex w-full min-w-0 flex-col items-center justify-center overflow-hidden'
					style={{ maxWidth: PLAYER_COLUMN }}
				>
					<img
						className='bg-muted size-64 rounded-xl object-cover'
						src={track.artwork}
						alt=''
					/>
					<div className='mt-4 flex w-full min-w-0 flex-col items-center gap-2'>
						<div className='w-full min-w-0 text-center'>
							<h1
								className='truncate text-3xl font-semibold tracking-tight'
								title={track.title}
							>
								{track.title}
							</h1>
							<p
								className='text-muted-foreground mt-1 truncate text-base'
								title={track.artist}
							>
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
									<DropdownMenuItem
										disabled={!canAdjustOffset}
										onClick={() => setOffsetOpen(true)}
									>
										时间轴偏移
									</DropdownMenuItem>
									<DropdownMenuItem onClick={onToggleComments}>
										{commentsOpen ? '关闭评论' : '评论'}
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											setBgKind(bgKind === 'pixi' ? 'mesh' : 'pixi')
										}
									>
										背景渲染：{lyricBgRendererLabel(bgKind)}
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
					className={cn(
						'relative col-start-3 h-full min-h-0 min-w-0',
						!lyricsVisible && 'pointer-events-none',
					)}
					aria-hidden={!lyricsVisible}
					inert={!lyricsVisible}
				>
					<div
						className={cn(
							'absolute inset-0 pl-8 pr-12 font-semibold tracking-tight motion-reduce:transition-none [--amll-lp-color:var(--foreground)] [--amll-lp-font-size:max(28px,5.6vh)] [--amll-lp-hover-bg-color:transparent] [--amll-lp-line-width-aspect:1] [&_.amll-lyric-player]:h-full [&_.amll-lyric-player]:min-h-0 [&_.amll-lyric-player]:w-full',
							!lyricsVisible && 'opacity-0',
						)}
						style={{ transition: lyricsPanelTransition(lyricsVisible) }}
						data-lyrics
					>
						{player.lyrics.length > 0 ? (
							<LyricPlayer
								className='h-full min-h-0 w-full'
								lyricLines={displayedLyrics}
								currentTime={Math.round(player.lyricClockMs)}
								playing={player.playing}
								enableBlur
								enableScale
								alignAnchor='center'
								alignPosition={0.4}
								wordFadeWidth={0.5}
								style={{ height: '100%', width: '100%', minHeight: 0 }}
								onLyricLineClick={(event) => {
									const line = player.lyrics[event.lineIndex]
									if (line) player.seekLyricLine(line.startTime)
								}}
							/>
						) : (
							<p className='text-muted-foreground m-0 grid h-full place-items-center text-[22px]'>
								暂无歌词
							</p>
						)}
					</div>
				</div>
			</div>
			{offsetOpen && canAdjustOffset ? (
				<LyricOffsetRail
					offsetSec={player.lyricOffsetSec}
					onStep={player.stepLyricOffsetBy}
					onDone={() => setOffsetOpen(false)}
				/>
			) : null}
			<div className='absolute right-[22px] bottom-[22px] flex gap-1'>
				<Button
					className={cn(lyricsOpen && 'bg-muted')}
					type='button'
					variant='ghost'
					size='icon'
					title='歌词'
					aria-label='歌词'
					aria-pressed={lyricsOpen}
					onClick={() => setLyricsOpen((open) => !open)}
				>
					<CaptionsIcon />
				</Button>
				{lyricsOpen && hasTranslation ? (
					<Button
						className={cn(aux.translation && 'bg-muted')}
						type='button'
						variant='ghost'
						size='icon'
						title='翻译'
						aria-label='翻译'
						aria-pressed={aux.translation}
						onClick={() => aux.setTranslation(!aux.translation)}
					>
						<LanguagesIcon />
					</Button>
				) : null}
				{lyricsOpen && hasRoman ? (
					<Button
						className={cn(aux.roman && 'bg-muted')}
						type='button'
						variant='ghost'
						size='icon'
						title='读音'
						aria-label='读音'
						aria-pressed={aux.roman}
						onClick={() => aux.setRoman(!aux.roman)}
					>
						<SpeechIcon />
					</Button>
				) : null}
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
