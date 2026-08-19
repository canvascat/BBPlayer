import { LyricPlayer } from '@applemusic-like-lyrics/react'
import type { AmllLyricLine } from '@bbplayer/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Tab = 'home' | 'library' | 'settings' | 'player'

interface TrackItem {
	id: string
	bvid: string
	cid: number
	title: string
	artist: string
	artwork: string
	duration: number
}

interface SearchHit {
	bvid: string
	title: string
	pic: string
	author: string
	duration: string
}

function greeting() {
	const hour = new Date().getHours()
	if (hour < 6) return '凌晨好'
	if (hour < 12) return '早上好'
	if (hour < 18) return '下午好'
	return '晚上好'
}

function stripHtml(input: string) {
	return input.replace(/<[^>]+>/g, '')
}

export default function App() {
	const audioRef = useRef<HTMLAudioElement>(null)
	const [tab, setTab] = useState<Tab>('home')
	const [query, setQuery] = useState('')
	const [error, setError] = useState('')
	const [hits, setHits] = useState<SearchHit[]>([])
	const [pages, setPages] = useState<TrackItem[]>([])
	const [listTitle, setListTitle] = useState('')
	const [queue, setQueue] = useState<TrackItem[]>([])
	const [index, setIndex] = useState(0)
	const [playing, setPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [lyrics, setLyrics] = useState<AmllLyricLine[]>([])
	const [cookie, setCookie] = useState('')
	const [continuePlayingAfterClose, setContinuePlayingAfterClose] =
		useState(true)
	const [status, setStatus] = useState('')

	const current = queue[index]

	useEffect(() => {
		void window.bbplayer.getSettings().then((settings) => {
			setCookie(settings.cookie)
			setContinuePlayingAfterClose(settings.continuePlayingAfterClose)
		})
	}, [])

	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		const onTime = () => {
			setCurrentTime(audio.currentTime * 1000)
			setDuration(audio.duration * 1000 || 0)
		}
		const onPlay = () => setPlaying(true)
		const onPause = () => setPlaying(false)
		const onEnded = () => void skip(1)
		audio.addEventListener('timeupdate', onTime)
		audio.addEventListener('play', onPlay)
		audio.addEventListener('pause', onPause)
		audio.addEventListener('ended', onEnded)
		return () => {
			audio.removeEventListener('timeupdate', onTime)
			audio.removeEventListener('play', onPlay)
			audio.removeEventListener('pause', onPause)
			audio.removeEventListener('ended', onEnded)
		}
	})

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement
			if (
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable
			) {
				return
			}
			if (event.code === 'Space') {
				event.preventDefault()
				toggle()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	})

	const playTrack = useCallback(async (list: TrackItem[], start: number) => {
		const track = list[start]
		if (!track) return
		setError('')
		setQueue(list)
		setIndex(start)
		setTab('player')
		setStatus('正在获取音频…')
		try {
			const resolved = await window.bbplayer.resolvePlay(track)
			const audio = audioRef.current
			if (!audio) return
			audio.src = resolved.playUrl
			setLyrics(resolved.lyrics ?? [])
			await audio.play()
			setStatus(resolved.lyrics?.length ? '' : '暂无匹配歌词')
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
			setStatus('')
		}
	}, [])

	const skip = useCallback(
		async (delta: number) => {
			const next = index + delta
			if (next < 0 || next >= queue.length) return
			await playTrack(queue, next)
		},
		[index, playTrack, queue],
	)

	const toggle = useCallback(() => {
		const audio = audioRef.current
		if (!audio?.src) return
		if (audio.paused) void audio.play()
		else audio.pause()
	}, [])

	const submitSearch = async () => {
		if (!query.trim()) return
		setError('')
		setHits([])
		setPages([])
		const matched = await window.bbplayer.matchSearch(query)
		if (matched.error) {
			setError(matched.error)
		}
		const strategy = matched.strategy as { type: string; bvid?: string; query?: string }
		try {
			if (strategy.type === 'BVID' && strategy.bvid) {
				const video = await window.bbplayer.getVideo(strategy.bvid)
				setListTitle(video.title)
				setPages(video.pages)
				setTab('library')
				return
			}
			if (
				strategy.type === 'SEARCH' ||
				strategy.type === 'B23_RESOLVE_ERROR' ||
				strategy.type === 'B23_NO_BVID_ERROR' ||
				strategy.type === 'AV_PARSE_ERROR'
			) {
				const keyword = strategy.query || query
				const result = await window.bbplayer.searchVideos(keyword)
				setHits(result)
				setListTitle(`搜索：${keyword}`)
				setTab('library')
			}
			if (strategy.type === 'FAVORITE' || strategy.type === 'COLLECTION' || strategy.type === 'UPLOADER') {
				setError('收藏夹 / 合集 / UP 主页将在下一阶段接入，请先用 BV 或关键词。')
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openHit = async (hit: SearchHit) => {
		const video = await window.bbplayer.getVideo(hit.bvid)
		setListTitle(video.title)
		setPages(video.pages)
		setHits([])
		setTab('library')
	}

	const saveSettings = async () => {
		await window.bbplayer.setSettings({ cookie, continuePlayingAfterClose })
		setStatus('已保存')
	}

	const amllLines = useMemo(() => lyrics, [lyrics])

	return (
		<div className='app'>
			<aside className='sidebar'>
				<div className='brand'>BBPlayer</div>
				<button
					className={`nav-btn ${tab === 'home' ? 'active' : ''}`}
					onClick={() => setTab('home')}
					type='button'
				>
					主页
				</button>
				<button
					className={`nav-btn ${tab === 'library' ? 'active' : ''}`}
					onClick={() => setTab('library')}
					type='button'
				>
					音乐库
				</button>
				<button
					className={`nav-btn ${tab === 'settings' ? 'active' : ''}`}
					onClick={() => setTab('settings')}
					type='button'
				>
					设置
				</button>
			</aside>
			<main className='content'>
				{tab === 'home' && (
					<>
						<h1>BBPlayer</h1>
						<p className='greeting'>{greeting()}，陌生人</p>
						<input
							className='search'
							placeholder='关键词 / b23.tv / 完整网址 / av / bv'
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') void submitSearch()
							}}
						/>
						{error && <p className='error'>{error}</p>}
					</>
				)}
				{tab === 'library' && (
					<>
						<h1>音乐库</h1>
						<p className='muted'>{listTitle || '搜索后会在这里列出分 P 或结果'}</p>
						<div className='list'>
							{pages.map((page, i) => (
								<div
									className='row'
									key={page.id}
									onClick={() => void playTrack(pages, i)}
								>
									<img className='cover' src={page.artwork} alt='' />
									<div>
										<div>{page.title}</div>
										<div className='muted'>{page.artist}</div>
									</div>
								</div>
							))}
							{hits.map((hit) => (
								<div
									className='row'
									key={hit.bvid}
									onClick={() => void openHit(hit)}
								>
									<img className='cover' src={hit.pic} alt='' />
									<div>
										<div>{stripHtml(hit.title)}</div>
										<div className='muted'>
											{hit.author} · {hit.duration}
										</div>
									</div>
								</div>
							))}
						</div>
						{error && <p className='error'>{error}</p>}
					</>
				)}
				{tab === 'settings' && (
					<>
						<h1>设置</h1>
						<p className='muted'>Bilibili Cookie 用于收藏夹和部分取流。扫码登录下一阶段接入。</p>
						<label className='field'>
							Cookie
							<textarea
								value={cookie}
								onChange={(e) => setCookie(e.target.value)}
								placeholder='粘贴 Bilibili Cookie'
							/>
						</label>
						<label className='inline'>
							<input
								type='checkbox'
								checked={continuePlayingAfterClose}
								onChange={(e) =>
									setContinuePlayingAfterClose(e.target.checked)
								}
							/>
							关闭窗口后继续播放
						</label>
						<p>
							<button type='button' onClick={() => void saveSettings()}>
								保存
							</button>
						</p>
						{status && <p className='muted'>{status}</p>}
						<p className='muted'>
							歌词界面使用 AMLL（AGPL）。本桌面端因此以 AGPL-3.0 分发。
						</p>
					</>
				)}
				{tab === 'player' && current && (
					<div className='player-view'>
						<div>
							<img className='player-cover' src={current.artwork} alt='' />
							<h1>{current.title}</h1>
							<p className='muted'>{current.artist}</p>
							<p className='muted'>{status}</p>
						</div>
						<div className='lyrics-wrap'>
							{amllLines.length > 0 ? (
								<LyricPlayer
									lyricLines={amllLines}
									currentTime={currentTime}
								/>
							) : (
								<p className='muted'>暂无歌词</p>
							)}
						</div>
					</div>
				)}
			</main>
			<footer className='bar'>
				<div className='now' onClick={() => current && setTab('player')}>
					{current?.artwork && <img src={current.artwork} alt='' />}
					<div className='meta'>
						<div className='title'>{current?.title ?? '未在播放'}</div>
						<div className='artist'>{current?.artist ?? ''}</div>
					</div>
				</div>
				<div className='controls'>
					<button type='button' onClick={() => void skip(-1)}>
						上一首
					</button>
					<button type='button' onClick={toggle}>
						{playing ? '暂停' : '播放'}
					</button>
					<button type='button' onClick={() => void skip(1)}>
						下一首
					</button>
				</div>
				<input
					className='progress'
					type='range'
					min={0}
					max={duration || 1}
					value={currentTime}
					onChange={(e) => {
						const value = Number(e.target.value)
						setCurrentTime(value)
						if (audioRef.current) audioRef.current.currentTime = value / 1000
					}}
				/>
			</footer>
			<audio ref={audioRef} preload='auto' />
		</div>
	)
}
