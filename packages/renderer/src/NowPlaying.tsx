import { LyricPlayer } from '@applemusic-like-lyrics/react'
import { useEffect, useState } from 'react'

import { formatClock, formatMs, repeatLabel, type TrackItem } from './playback'
import { trpc } from './trpc'
import type { usePlayback } from './usePlayback'

function Icon({
	d,
	size = 18,
	filled = false,
}: {
	d: string
	size?: number
	filled?: boolean
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			aria-hidden
		>
			<path
				d={d}
				fill={filled ? 'currentColor' : 'none'}
				stroke='currentColor'
				strokeWidth={filled ? 0 : 1.8}
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	)
}

const icons = {
	down: 'm6 9 6 6 6-6',
	play: 'M8 5.5v13l12-6.5z',
	pause: 'M7 6h3.5v12H7zM13.5 6H17v12h-3.5z',
	prev: 'M6 6v12M18 6 10 12l8 6z',
	next: 'M18 6v12M6 6l8 6-8 6z',
	shuffle: 'M4 7h4l10 10h4M18 7h4M4 17h4l3-3',
	repeat: 'M17 3v4h4M7 21v-4H3M19 7a8 8 0 0 0-14 2M5 17a8 8 0 0 0 14-2',
	queue: 'M5 6h14M5 12h14M5 18h9',
	lyric: 'M9 18V6l10-2v12',
	more: 'M6 12.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
}

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
	const [moreOpen, setMoreOpen] = useState(false)
	const remaining = Math.max(0, player.duration - player.currentTime)

	useEffect(() => {
		if (!moreOpen) return
		const onKey = (event: KeyboardEvent) => {
			if (event.code === 'Escape') setMoreOpen(false)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [moreOpen])

	return (
		<section className='now-playing'>
			<div className='now-playing-bg' />
			<div className='now-playing-scrim' />
			<div className='now-playing-top'>
				<button
					className='now-playing-close'
					type='button'
					aria-label='收起播放页'
					onClick={onClose}
				>
					<Icon
						d={icons.down}
						size={20}
					/>
				</button>
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
						<div className='now-playing-more-wrap'>
							<button
								className={`now-playing-more ${moreOpen ? 'on' : ''}`}
								type='button'
								aria-label='更多'
								aria-expanded={moreOpen}
								onClick={() => setMoreOpen((value) => !value)}
							>
								<Icon
									d={icons.more}
									size={20}
									filled
								/>
							</button>
							{moreOpen && (
								<>
									<div
										className='ctx-backdrop'
										onClick={() => setMoreOpen(false)}
									/>
									<div className='ctx-menu now-playing-menu'>
										<button
											type='button'
											onClick={() => {
												onSleep()
												setMoreOpen(false)
											}}
										>
											{player.sleepLeft > 0
												? `定时 ${formatMs(player.sleepLeft)}`
												: '定时关闭'}
										</button>
										<button
											type='button'
											onClick={() => {
												player.cycleSpeed()
												setMoreOpen(false)
											}}
										>
											倍速 {player.playbackRate}x
										</button>
										<button
											type='button'
											onClick={() => {
												onToggleComments()
												setMoreOpen(false)
											}}
										>
											{commentsOpen ? '关闭评论' : '评论'}
										</button>
										<button
											type='button'
											onClick={() => {
												void trpc.mini.toggle.mutate({ show: true })
												setMoreOpen(false)
											}}
										>
											迷你窗口
										</button>
									</div>
								</>
							)}
						</div>
					</div>
					<div className='now-playing-seek'>
						<input
							className='now-playing-range'
							type='range'
							min={0}
							max={player.duration || 1}
							value={player.currentTime}
							aria-label='播放进度'
							onChange={(event) =>
								player.seek(Math.round(Number(event.target.value)))
							}
						/>
						<div className='now-playing-times'>
							<span>{formatClock(player.currentTime)}</span>
							<span>-{formatClock(remaining)}</span>
						</div>
					</div>
					<div className='now-playing-transport'>
						<button
							className={`now-playing-ctrl ${player.shuffle ? 'on' : ''}`}
							type='button'
							title='随机'
							onClick={player.toggleShuffle}
						>
							<Icon
								d={icons.shuffle}
								size={22}
							/>
						</button>
						<button
							className='now-playing-ctrl'
							type='button'
							aria-label='上一首'
							onClick={() => player.skip(-1)}
						>
							<Icon
								d={icons.prev}
								size={26}
								filled
							/>
						</button>
						<button
							className='now-playing-play'
							type='button'
							aria-label={player.playing ? '暂停' : '播放'}
							onClick={player.toggle}
						>
							<Icon
								d={player.playing ? icons.pause : icons.play}
								size={36}
								filled
							/>
						</button>
						<button
							className='now-playing-ctrl'
							type='button'
							aria-label='下一首'
							onClick={() => player.skip(1)}
						>
							<Icon
								d={icons.next}
								size={26}
								filled
							/>
						</button>
						<button
							className={`now-playing-ctrl ${player.repeatMode ? 'on' : ''}`}
							type='button'
							title={repeatLabel(player.repeatMode)}
							onClick={player.cycleRepeat}
						>
							<Icon
								d={icons.repeat}
								size={22}
							/>
						</button>
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
				<button
					className='now-playing-dock-btn'
					type='button'
					title='歌词窗口'
					aria-label='歌词窗口'
					onClick={() => void trpc.lyrics.toggle.mutate()}
				>
					<Icon
						d={icons.lyric}
						size={20}
					/>
				</button>
				<button
					className={`now-playing-dock-btn ${queueOpen ? 'on' : ''}`}
					type='button'
					title='队列'
					aria-label='队列'
					onClick={onToggleQueue}
				>
					<Icon
						d={icons.queue}
						size={20}
					/>
				</button>
			</div>
		</section>
	)
}
