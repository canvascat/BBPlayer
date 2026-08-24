import '@applemusic-like-lyrics/core/style.css'

import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { BbplayerAccount } from './BbplayerAccount'
import { CommentsPanel } from './CommentsPanel'
import { NowPlaying } from './NowPlaying'
import { PhoneLogin } from './PhoneLogin'
import { formatMs, repeatLabel, type TrackItem } from './playback'
import { SkinPicker, type SkinTheme } from './SkinPicker'
import { listen, trpc } from './trpc'
import { usePlayback } from './usePlayback'

type Tab = 'home' | 'library' | 'settings' | 'player'

interface SearchHit {
	bvid: string
	title: string
	pic: string
	author: string
	duration: string
}

function shareRoleLabel(
	role: 'owner' | 'editor' | 'subscriber' | null | undefined,
) {
	if (role === 'owner') return '共享'
	if (role === 'editor') return '协作'
	if (role === 'subscriber') return '订阅'
	return ''
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

function Icon({ d, size = 18 }: { d: string; size?: number }) {
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
				stroke='currentColor'
				strokeWidth='1.8'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	)
}

const icons = {
	home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z',
	library: 'M4 5h7v14H4zM13 5h7v6h-7zM13 13h7v6h-7z',
	settings:
		'M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zM19.4 15a7.8 7.8 0 0 0 .1-1.5 7.8 7.8 0 0 0-.1-1.5l1.8-1.4-1.7-3-2.1.7a7.4 7.4 0 0 0-2.6-1.5L13.4 3h-2.8L10.2 5.3A7.4 7.4 0 0 0 7.6 6.8L5.5 6.1 3.8 9.1 5.6 10.5a7.8 7.8 0 0 0-.1 1.5 7.8 7.8 0 0 0 .1 1.5L3.8 14.9l1.7 3 2.1-.7a7.4 7.4 0 0 0 2.6 1.5l.4 2.3h2.8l.4-2.3a7.4 7.4 0 0 0 2.6-1.5l2.1.7 1.7-3z',
	search: 'm20 20-3.5-3.5M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z',
	play: 'M8 6.5v11l10-5.5z',
	pause: 'M8 6h3v12H8zM13 6h3v12h-3z',
	prev: 'M6 6v12M18 6 10 12l8 6z',
	next: 'M18 6v12M6 6l8 6-8 6z',
	down: 'm6 9 6 6 6-6',
	music:
		'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
	shuffle: 'M4 7h4l10 10h4M18 7h4M4 17h4l3-3',
	repeat: 'M17 3v4h4M7 21v-4H3M19 7a8 8 0 0 0-14 2M5 17a8 8 0 0 0 14-2',
	queue: 'M5 6h14M5 12h14M5 18h9',
	lyric: 'M9 18V6l10-2v12',
	comment: 'M5 5h14v10H8l-3 3z',
}

export default function App() {
	const player = usePlayback()
	const searchRef = useRef<HTMLInputElement>(null)
	const [tab, setTab] = useState<Tab>('home')
	const [lastTab, setLastTab] = useState<Tab>('home')
	const [query, setQuery] = useState('')
	const [hits, setHits] = useState<SearchHit[]>([])
	const [pages, setPages] = useState<TrackItem[]>([])
	const [listTitle, setListTitle] = useState('')
	const [cookie, setCookie] = useState('')
	const [continuePlayingAfterClose, setContinuePlayingAfterClose] =
		useState(true)
	const [lyricsAlwaysOnTop, setLyricsAlwaysOnTop] = useState(true)
	const [lyricsWindowLocked, setLyricsWindowLocked] = useState(false)
	const [autoOpenLyricsWindow, setAutoOpenLyricsWindow] = useState(false)
	const [menuBarShowLyrics, setMenuBarShowLyrics] = useState(false)
	const [saved, setSaved] = useState('')
	const [menu, setMenu] = useState<{
		x: number
		y: number
		track: TrackItem
	} | null>(null)
	const [barMenu, setBarMenu] = useState<{ x: number; y: number } | null>(null)
	const [showQueue, setShowQueue] = useState(false)
	const [playlists, setPlaylists] = useState<
		Array<{
			id: string
			title: string
			description: string
			coverUrl: string
			itemCount: number
			shareId: string | null
			shareRole: 'owner' | 'editor' | 'subscriber' | null
		}>
	>([])
	const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
	const [createTitle, setCreateTitle] = useState('')
	const [shareInput, setShareInput] = useState('')
	const [shareInvite, setShareInvite] = useState('')
	const [libraryNotice, setLibraryNotice] = useState('')
	const [playlistMenu, setPlaylistMenu] = useState<{
		id: string
		x: number
		y: number
	} | null>(null)
	const [pickPlaylistFor, setPickPlaylistFor] = useState<TrackItem | null>(null)
	const [miniAlwaysOnTop, setMiniAlwaysOnTop] = useState(true)
	const [autoOpenMiniWindow, setAutoOpenMiniWindow] = useState(false)
	const [autoCache, setAutoCache] = useState(true)
	const [skin, setSkin] = useState<SkinTheme | null>(null)
	const [showComments, setShowComments] = useState(false)
	const [downloads, setDownloads] = useState<TrackItem[]>([])
	const [downloadTasks, setDownloadTasks] = useState<Record<string, string>>({})
	const [downloadQuery, setDownloadQuery] = useState('')
	const [account, setAccount] = useState<{
		mid: number
		name: string
		face: string
	} | null>(null)
	const [favorites, setFavorites] = useState<
		Array<{
			id: string
			title: string
			coverUrl: string
			itemCount: number
		}>
	>([])
	const [collections, setCollections] = useState<
		Array<{
			id: string
			title: string
			coverUrl: string
			itemCount: number
		}>
	>([])
	const [watchLaterCount, setWatchLaterCount] = useState(0)
	const [qr, setQr] = useState<{
		status: string
		statusText: string
		dataUrl?: string
		url?: string
	} | null>(null)

	const current = player.current
	const visiblePages =
		listTitle === '已下载' && downloadQuery.trim()
			? pages.filter((item) => {
					const q = downloadQuery.trim().toLowerCase()
					return (
						item.title.toLowerCase().includes(q) ||
						item.artist.toLowerCase().includes(q)
					)
				})
			: pages
	const coverImage = current?.artwork
		? `url("${current.artwork.replace(/"/g, '')}")`
		: skin?.coverUrl
			? `url("${skin.coverUrl.replace(/"/g, '')}")`
			: 'none'

	useEffect(() => {
		void trpc.settings.get.query().then((settings) => {
			setCookie(settings.cookie)
			setContinuePlayingAfterClose(settings.continuePlayingAfterClose)
			setLyricsAlwaysOnTop(settings.lyricsAlwaysOnTop)
			setLyricsWindowLocked(settings.lyricsWindowLocked)
			setAutoOpenLyricsWindow(settings.autoOpenLyricsWindow)
			setMenuBarShowLyrics(settings.menuBarShowLyrics)
			setMiniAlwaysOnTop(settings.miniAlwaysOnTop)
			setAutoOpenMiniWindow(settings.autoOpenMiniWindow)
			setAutoCache(settings.autoCache ?? true)
			setSkin(settings.skin ?? null)
			setAccount(settings.account)
		})
		void refreshPlaylists()
		void loadRemoteLibrary()
		void trpc.downloads.list.query().then(setDownloads)
		void trpc.downloads.status.query().then(setDownloadTasks)
		void trpc.share.pending.query().then((payload) => {
			if (!payload?.shareId) return
			setShareInput(payload.shareId)
			if (payload.inviteCode) setShareInvite(payload.inviteCode)
			setTab('library')
		})
	}, [])

	useEffect(() => {
		return listen(trpc.share.incoming.subscribe, (payload) => {
			if (!payload.shareId) return
			setShareInput(payload.shareId)
			if (payload.inviteCode) setShareInvite(payload.inviteCode)
			setTab('library')
		})
	}, [])

	useEffect(() => {
		return listen(trpc.downloads.updates.subscribe, (payload) => {
			setDownloads(payload.records as TrackItem[])
			setDownloadTasks(payload.tasks)
			if (listTitle === '已下载') setPages(payload.records as TrackItem[])
		})
	}, [listTitle])

	useEffect(() => {
		return listen(trpc.auth.qrUpdates.subscribe, (payload) => {
			void (async () => {
				setQr(payload)
				if (payload.status === 'success') {
					const settings = await trpc.settings.get.query()
					setCookie(settings.cookie)
					setAccount(settings.account)
					await loadRemoteLibrary()
				}
			})()
		})
	}, [])

	const refreshPlaylists = async () => {
		setPlaylists(await trpc.library.list.query())
	}

	const loadRemoteLibrary = async () => {
		try {
			const remote = await trpc.bili.library.query()
			setAccount(remote.account)
			setFavorites(remote.favorites)
			setCollections(remote.collections)
			setWatchLaterCount(remote.watchLater)
		} catch {
			setFavorites([])
			setCollections([])
			setWatchLaterCount(0)
		}
	}

	const showRemoteVideos = (
		title: string,
		videos: Array<{
			bvid: string
			title: string
			pic: string
			author: string
			duration: string
		}>,
	) => {
		setActivePlaylistId(null)
		setPages([])
		setHits(videos)
		setListTitle(title)
		setTab('library')
	}

	const openFavorite = async (id: string) => {
		try {
			const result = await trpc.bili.favorite.query({ id })
			showRemoteVideos(result.title, result.videos)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openCollection = async (id: string) => {
		try {
			const result = await trpc.bili.collection.query({ id })
			showRemoteVideos(result.title, result.videos)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openWatchLater = async () => {
		try {
			const result = await trpc.bili.watchLater.query()
			showRemoteVideos(result.title, result.videos)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openPlaylist = async (id: string) => {
		let playlist = await trpc.library.get.query({ id })
		if (!playlist) return
		if (playlist.shareId) {
			try {
				await trpc.share.pull.mutate({ playlistId: id })
				playlist = (await trpc.library.get.query({ id })) ?? playlist
			} catch (error) {
				setLibraryNotice(error instanceof Error ? error.message : String(error))
			}
		}
		setActivePlaylistId(id)
		setListTitle(playlist.title)
		setPages(playlist.tracks)
		setHits([])
		setTab('library')
	}

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement
			const typing =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable
			if (event.key === 'l' && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				searchRef.current?.focus()
				searchRef.current?.select()
				return
			}
			if (typing) return
			if (event.code === 'Space') {
				event.preventDefault()
				player.toggleRef.current()
			}
			if (event.code === 'ArrowLeft' && event.shiftKey) {
				event.preventDefault()
				player.seekBy(-5000)
			} else if (event.code === 'ArrowRight' && event.shiftKey) {
				event.preventDefault()
				player.seekBy(5000)
			} else if (event.code === 'ArrowLeft') {
				event.preventDefault()
				player.skipRef.current(-1)
			} else if (event.code === 'ArrowRight') {
				event.preventDefault()
				player.skipRef.current(1)
			}
			if (event.code === 'Escape' && tab === 'player') {
				setTab(lastTab === 'player' ? 'home' : lastTab)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [lastTab, player, tab])

	useEffect(() => {
		if (tab === 'player' && !current) {
			setTab(lastTab === 'player' ? 'home' : lastTab)
		}
	}, [current, lastTab, tab])

	useEffect(() => {
		return listen(trpc.player.commands.subscribe, (command) => {
			if (command === 'playpause') player.toggleRef.current()
			if (command === 'pause') player.audioRef.current?.pause()
			if (command === 'prev') player.skipRef.current(-1)
			if (command === 'next') player.skipRef.current(1)
			if (command === 'repeat-off') player.setRepeat(0)
			if (command === 'repeat-track') player.setRepeat(1)
			if (command === 'repeat-queue') player.setRepeat(2)
			if (command === 'shuffle') player.toggleShuffle()
			if (command === 'open-queue') {
				setShowQueue(true)
				setTab((currentTab) => (currentTab === 'player' ? currentTab : 'home'))
			}
			if (command === 'open-settings') setTab('settings')
			if (command === 'open-player' && player.current) {
				setLastTab((currentTab) => (tab === 'player' ? currentTab : tab))
				setTab('player')
			}
			if (command === 'sleep-off') player.startSleep(0)
			else if (command.startsWith('sleep-')) {
				const minutes = Number(command.slice(6))
				if (minutes > 0) player.startSleep(minutes)
			}
		})
	}, [player, tab])

	const openPlayer = () => {
		if (!current) return
		if (tab !== 'player') setLastTab(tab)
		setTab('player')
	}

	const startPlay = (list: TrackItem[], start: number) => {
		setLastTab('library')
		setTab('player')
		void player.playTrack(list, start)
	}

	const submitSearch = async (raw?: string) => {
		const q = (raw ?? query).trim()
		if (!q) return
		if (raw) setQuery(raw)
		player.setError('')
		setHits([])
		setPages([])
		setActivePlaylistId(null)
		const matched = await trpc.player.matchSearch.query({ query: q })
		if (matched.error) player.setError(matched.error)
		const strategy = matched.strategy as {
			type: string
			bvid?: string
			query?: string
			id?: string
			mid?: string
		}
		try {
			if (strategy.type === 'BVID' && strategy.bvid) {
				const video = await trpc.bili.video.query({ bvid: strategy.bvid })
				setActivePlaylistId(null)
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
				const keyword = strategy.query || q
				const result = await trpc.bili.search.query({ keyword })
				setHits(result)
				setListTitle(`搜索：${keyword}`)
				setTab('library')
			}
			if (strategy.type === 'FAVORITE' && strategy.id) {
				await openFavorite(strategy.id)
				return
			}
			if (strategy.type === 'COLLECTION' && strategy.id) {
				await openCollection(strategy.id)
				return
			}
			if (strategy.type === 'UPLOADER' && strategy.mid) {
				const result = await trpc.bili.uploader.query({ mid: strategy.mid })
				showRemoteVideos(result.title, result.videos)
				return
			}
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openHit = async (hit: SearchHit) => {
		const video = await trpc.bili.video.query({ bvid: hit.bvid })
		setActivePlaylistId(null)
		setListTitle(video.title)
		setPages(video.pages)
		setHits([])
		setTab('library')
	}

	const saveSettings = async () => {
		await trpc.settings.set.mutate({
			cookie,
			continuePlayingAfterClose,
			lyricsAlwaysOnTop,
			lyricsWindowLocked,
			autoOpenLyricsWindow,
			menuBarShowLyrics,
			miniAlwaysOnTop,
			autoOpenMiniWindow,
			autoCache,
			skin,
		})
		const accountNow = await trpc.auth.refresh.mutate()
		setAccount(accountNow)
		await loadRemoteLibrary()
		setSaved('已保存')
	}

	const exportCached = async (ids?: string[]) => {
		const result = (await trpc.downloads.export.mutate({ ids })) as {
			message: string
		}
		setSaved(result.message)
		if (result.message === '没有可导出的歌曲') {
			player.setError(result.message)
		}
	}

	const logout = async () => {
		await trpc.auth.logout.mutate()
		setCookie('')
		setAccount(null)
		setFavorites([])
		setCollections([])
		setWatchLaterCount(0)
		setQr(null)
		setSaved('已退出登录')
	}

	const createLocalPlaylist = async (
		tracks?: TrackItem[],
		titleOverride?: string,
	) => {
		const title = (titleOverride ?? createTitle).trim()
		if (!title) {
			player.setError('标题不能为空')
			return
		}
		player.setError('')
		const playlist = await trpc.library.create.mutate({ title, tracks })
		setCreateTitle('')
		await refreshPlaylists()
		await openPlaylist(playlist.id)
	}

	const addTrackToPlaylist = async (playlistId: string, track: TrackItem) => {
		await trpc.library.addTracks.mutate({ playlistId, tracks: [track] })
		setPickPlaylistFor(null)
		await refreshPlaylists()
		if (activePlaylistId === playlistId) await openPlaylist(playlistId)
	}

	const subscribeShared = async () => {
		setLibraryNotice('')
		try {
			await trpc.share.preview.query({ input: shareInput })
			const result = await trpc.share.subscribe.mutate({
				input: shareInput,
				inviteCode: shareInvite.trim() || undefined,
			})
			setShareInput('')
			setShareInvite('')
			setLibraryNotice(
				result.alreadyMember
					? `已在本地：${result.title}`
					: `已订阅「${result.title}」`,
			)
			await refreshPlaylists()
			await openPlaylist(result.playlistId)
		} catch (error) {
			setLibraryNotice(error instanceof Error ? error.message : String(error))
		}
	}

	const runPlaylistAction = async (
		id: string,
		action: 'share' | 'copy' | 'editor' | 'sync' | 'rotate' | 'delete',
	) => {
		const playlist = playlists.find((item) => item.id === id)
		setPlaylistMenu(null)
		try {
			if (action === 'delete') {
				if (!window.confirm(`删除「${playlist?.title ?? ''}」？`)) return
				await trpc.library.delete.mutate({ id })
				await refreshPlaylists()
				if (activePlaylistId === id) {
					setActivePlaylistId(null)
					setPages([])
					setListTitle('')
				}
				return
			}
			if (action === 'share') {
				const result = await trpc.share.enable.mutate({ playlistId: id })
				setLibraryNotice(
					result.alreadyShared ? `已复制订阅链接` : '已设为共享，链接已复制',
				)
				await trpc.desktop.copyText.mutate({ text: result.subscribeUrl })
				await refreshPlaylists()
				return
			}
			if (action === 'copy') {
				await trpc.share.copyLink.mutate({
					playlistId: id,
					kind: 'subscribe',
				})
				setLibraryNotice('已复制订阅链接')
				return
			}
			if (action === 'editor') {
				await trpc.share.copyLink.mutate({
					playlistId: id,
					kind: 'editor',
				})
				setLibraryNotice('已复制协作链接')
				return
			}
			if (action === 'sync') {
				await trpc.share.pull.mutate({ playlistId: id })
				setLibraryNotice('云端共享歌单已同步')
				await refreshPlaylists()
				if (activePlaylistId === id) await openPlaylist(id)
				return
			}
			if (action === 'rotate') {
				await trpc.share.rotateInvite.mutate({ playlistId: id })
				setLibraryNotice('已重置邀请码并复制协作链接')
			}
		} catch (error) {
			setLibraryNotice(error instanceof Error ? error.message : String(error))
		}
	}

	const cycleSleep = () => {
		const steps = [0, 15, 30, 45, 60]
		const currentMinutes = Math.ceil(player.sleepLeft / 60000)
		const at = steps.findIndex((step) => step >= currentMinutes)
		const next = steps[(at < 0 ? 0 : at) + 1] ?? 0
		player.startSleep(next)
	}

	const onRowMenu = (event: MouseEvent, track: TrackItem) => {
		event.preventDefault()
		setMenu({ x: event.clientX, y: event.clientY, track })
	}

	return (
		<div
			className={`app${tab === 'player' ? ' player-open' : ''}`}
			style={{
				['--cover-image' as string]: coverImage,
				...(skin?.primary
					? {
							['--app-primary' as string]: skin.primary,
							['--app-primary-hex' as string]: `rgb(${skin.primary})`,
						}
					: {}),
			}}
		>
			<header className='header'>
				<div className='brand'>
					<span className='brand-mark'>
						<Icon
							d={icons.music}
							size={16}
						/>
					</span>
					BBPlayer
				</div>
				<label className='search-wrap'>
					<Icon
						d={icons.search}
						size={16}
					/>
					<input
						ref={searchRef}
						placeholder='搜索关键词 / b23.tv / av / bv'
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') void submitSearch()
						}}
					/>
				</label>
				<button
					className='icon-btn'
					type='button'
					onClick={() => setTab('settings')}
					aria-label='设置'
				>
					<Icon d={icons.settings} />
				</button>
			</header>
			<div className='body'>
				<aside className='sidebar'>
					<div className='nav-label'>在线音乐</div>
					<button
						className={`nav-btn ${tab === 'home' ? 'active' : ''}`}
						onClick={() => setTab('home')}
						type='button'
					>
						<Icon d={icons.home} />
						主页
					</button>
					<button
						className={`nav-btn ${tab === 'library' ? 'active' : ''}`}
						onClick={() => setTab('library')}
						type='button'
					>
						<Icon d={icons.library} />
						音乐库
					</button>
					<div className='nav-label'>其他</div>
					<button
						className={`nav-btn ${tab === 'settings' ? 'active' : ''}`}
						onClick={() => setTab('settings')}
						type='button'
					>
						<Icon d={icons.settings} />
						设置
					</button>
					{current && (
						<button
							className={`nav-btn ${tab === 'player' ? 'active' : ''}`}
							onClick={openPlayer}
							type='button'
						>
							<Icon d={icons.music} />
							正在播放
						</button>
					)}
				</aside>
				<main className='content'>
					{tab === 'home' && (
						<>
							<h1 className='page-title'>
								{account ? `${greeting()}，${account.name}` : greeting()}
							</h1>
							<p className='greeting'>
								空格播放，左右切歌，Shift+方向键快进快退，⌘L 聚焦搜索
							</p>
							<div className='hero'>
								<div className='card'>
									<div className='section-title'>快速开始</div>
									<p className='muted'>粘贴完整链接，或直接输入作品标题。</p>
									<div className='chips'>
										<button
											className='chip'
											type='button'
											onClick={() => void submitSearch('洛天依')}
										>
											洛天依
										</button>
										<button
											className='chip'
											type='button'
											onClick={() =>
												void submitSearch('Never Gonna Give You Up')
											}
										>
											Never Gonna Give You Up
										</button>
									</div>
								</div>
								<div className='card hero-play'>
									{current ? (
										<>
											<img
												src={current.artwork}
												alt=''
											/>
											<div>
												<div className='muted'>
													队列 {player.queue.length} 首
												</div>
												<div className='title'>{current.title}</div>
												<div className='muted'>{current.artist}</div>
												<div className='chips'>
													<button
														className='chip'
														type='button'
														onClick={player.toggle}
													>
														{player.playing ? '暂停' : '继续播放'}
													</button>
													<button
														className='chip'
														type='button'
														onClick={openPlayer}
													>
														打开播放页
													</button>
												</div>
											</div>
										</>
									) : (
										<div>
											<div className='section-title'>尚未播放</div>
											<p className='muted'>
												{player.queue.length
													? '上次队列还在，按空格或播放即可续播。'
													: '搜索后点进分 P，封面会铺到整个窗口背景。'}
											</p>
										</div>
									)}
								</div>
							</div>
							{player.error && <p className='error'>{player.error}</p>}
						</>
					)}
					{tab === 'library' && (
						<>
							<h1 className='page-title'>音乐库</h1>
							<p className='muted'>
								{listTitle || '本地歌单、收藏夹和合集会显示在这里。'}
							</p>
							{libraryNotice && <p className='muted'>{libraryNotice}</p>}
							<div className='create-row'>
								<input
									value={shareInput}
									placeholder='粘贴共享链接或歌单 ID'
									onChange={(e) => setShareInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void subscribeShared()
									}}
								/>
								<input
									value={shareInvite}
									placeholder='邀请码（可选）'
									onChange={(e) => setShareInvite(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void subscribeShared()
									}}
								/>
								<button
									className='chip'
									type='button'
									onClick={() => void subscribeShared()}
								>
									订阅共享歌单
								</button>
							</div>
							{account && (
								<>
									<div className='section-title'>B 站</div>
									<div className='cover-grid'>
										<button
											className='cover-card'
											type='button'
											onClick={() => void openWatchLater()}
										>
											<div className='cover-fallback'>稍</div>
											<div className='name'>稍后再看</div>
											<div className='sub'>{watchLaterCount} 首</div>
										</button>
										{favorites.map((folder) => (
											<button
												className='cover-card'
												key={`fav-${folder.id}`}
												type='button'
												onClick={() => void openFavorite(folder.id)}
											>
												{folder.coverUrl ? (
													<img
														src={folder.coverUrl}
														alt=''
													/>
												) : (
													<div className='cover-fallback'>藏</div>
												)}
												<div className='name'>{folder.title}</div>
												<div className='sub'>{folder.itemCount} 首</div>
											</button>
										))}
										{collections.map((folder) => (
											<button
												className='cover-card'
												key={`col-${folder.id}`}
												type='button'
												onClick={() => void openCollection(folder.id)}
											>
												{folder.coverUrl ? (
													<img
														src={folder.coverUrl}
														alt=''
													/>
												) : (
													<div className='cover-fallback'>集</div>
												)}
												<div className='name'>{folder.title}</div>
												<div className='sub'>{folder.itemCount} 首</div>
											</button>
										))}
									</div>
								</>
							)}
							<div className='section-title'>本地歌单</div>
							<div className='cover-grid'>
								<button
									className='cover-card'
									type='button'
									onClick={() => {
										setActivePlaylistId(null)
										setHits([])
										setPages(downloads)
										setListTitle('已下载')
										setDownloadQuery('')
										setTab('library')
									}}
								>
									<div className='cover-fallback'>下</div>
									<div className='name'>已下载</div>
									<div className='sub'>{downloads.length} 首</div>
								</button>
							</div>
							<div className='create-row'>
								<input
									value={createTitle}
									placeholder='新播放列表标题'
									onChange={(e) => setCreateTitle(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') void createLocalPlaylist()
									}}
								/>
								<button
									className='chip'
									type='button'
									onClick={() => void createLocalPlaylist()}
								>
									创建播放列表
								</button>
							</div>
							{playlists.length > 0 && (
								<div className='cover-grid'>
									{playlists.map((playlist) => (
										<button
											className={`cover-card ${activePlaylistId === playlist.id ? 'active' : ''}`}
											key={playlist.id}
											type='button'
											onClick={() => void openPlaylist(playlist.id)}
											onContextMenu={(event) => {
												event.preventDefault()
												setPlaylistMenu({
													id: playlist.id,
													x: event.clientX,
													y: event.clientY,
												})
											}}
										>
											{playlist.coverUrl ? (
												<img
													src={playlist.coverUrl}
													alt=''
												/>
											) : (
												<div className='cover-fallback'>
													{playlist.title.slice(0, 1)}
												</div>
											)}
											<div className='name'>{playlist.title}</div>
											<div className='sub'>
												{playlist.shareRole
													? `${shareRoleLabel(playlist.shareRole)} · ${playlist.itemCount} 首`
													: `${playlist.itemCount} 首`}
											</div>
										</button>
									))}
								</div>
							)}
							{listTitle === '已下载' && (
								<div className='create-row'>
									<input
										value={downloadQuery}
										placeholder='搜索已下载歌曲'
										onChange={(e) => setDownloadQuery(e.target.value)}
									/>
									<button
										className='chip'
										type='button'
										onClick={() => void exportCached()}
									>
										导出
									</button>
								</div>
							)}
							{hits.length > 0 && (
								<div className='cover-grid'>
									{hits.map((hit) => (
										<button
											className='cover-card'
											key={hit.bvid}
											type='button'
											onClick={() => void openHit(hit)}
										>
											<img
												src={hit.pic}
												alt=''
											/>
											<div className='name'>{stripHtml(hit.title)}</div>
											<div className='sub'>
												{hit.author} · {hit.duration}
											</div>
										</button>
									))}
								</div>
							)}
							{visiblePages.length > 0 && (
								<div className='list'>
									{visiblePages.map((page, i) => (
										<button
											className={`row ${current?.id === page.id ? 'active' : ''}`}
											key={page.id}
											type='button'
											onClick={() => startPlay(visiblePages, i)}
											onContextMenu={(event) => onRowMenu(event, page)}
										>
											<span className='idx'>
												{String(i + 1).padStart(2, '0')}
											</span>
											<img
												className='cover'
												src={page.artwork}
												alt=''
											/>
											<div>
												<div>{page.title}</div>
												<div className='sub'>{page.artist}</div>
											</div>
											<span className='muted'>
												{downloadTasks[page.id] === 'completed'
													? '已缓存'
													: downloadTasks[page.id] === 'downloading'
														? '缓存中'
														: downloadTasks[page.id] === 'queued'
															? '排队'
															: formatMs(page.duration * 1000)}
											</span>
										</button>
									))}
								</div>
							)}
							{!hits.length &&
								!pages.length &&
								playlists.length === 0 &&
								!account && (
									<p className='empty'>
										还没有内容。创建本地歌单，或用顶栏搜索试试。
									</p>
								)}
							{player.error && <p className='error'>{player.error}</p>}
						</>
					)}
					{tab === 'settings' && (
						<>
							<h1 className='page-title'>设置</h1>
							<div className='card'>
								<BbplayerAccount
									biliLoggedIn={Boolean(account)}
									onPlaylistsChanged={() => void refreshPlaylists()}
								/>
							</div>
							<div className='card'>
								<p className='muted'>
									扫码登录后可打开收藏夹、合集和稍后再看。也可以继续粘贴
									Cookie。
								</p>
								{account ? (
									<div className='account-row'>
										<img
											src={account.face}
											alt=''
										/>
										<div>
											<div className='title'>{account.name}</div>
											<div className='muted'>UID {account.mid}</div>
										</div>
										<button
											className='chip'
											type='button'
											onClick={() => void logout()}
										>
											退出登录
										</button>
									</div>
								) : (
									<div className='qr-box'>
										{qr?.dataUrl ? (
											<img
												className='qr-image'
												src={qr.dataUrl}
												alt='登录二维码'
											/>
										) : (
											<div className='qr-placeholder'>二维码</div>
										)}
										<p className='muted'>
											{qr?.statusText || '点击下方按钮生成二维码'}
										</p>
										<div className='chips'>
											<button
												className='chip'
												type='button'
												onClick={() =>
													void trpc.auth.qrStart.mutate().catch((err) => {
														setQr({
															status: 'error',
															statusText:
																err instanceof Error
																	? err.message
																	: String(err),
														})
													})
												}
											>
												{qr?.status === 'expired' || qr?.status === 'error'
													? '重新生成'
													: '扫码登录'}
											</button>
											{qr?.url && (
												<button
													className='chip'
													type='button'
													onClick={() =>
														void trpc.desktop.openExternal.mutate({
															url: qr.url!,
														})
													}
												>
													在浏览器打开
												</button>
											)}
										</div>
									</div>
								)}
								<PhoneLogin
									disabled={Boolean(account)}
									onLoggedIn={() => {
										void trpc.settings.get.query().then((settings) => {
											setCookie(settings.cookie)
											setAccount(settings.account)
										})
										void loadRemoteLibrary()
									}}
								/>
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
								<label className='inline'>
									<input
										type='checkbox'
										checked={autoOpenLyricsWindow}
										onChange={(e) => setAutoOpenLyricsWindow(e.target.checked)}
									/>
									播放时打开歌词窗口
								</label>
								<label className='inline'>
									<input
										type='checkbox'
										checked={lyricsAlwaysOnTop}
										onChange={(e) => setLyricsAlwaysOnTop(e.target.checked)}
									/>
									歌词窗口置顶
								</label>
								<label className='inline'>
									<input
										type='checkbox'
										checked={lyricsWindowLocked}
										onChange={(e) => setLyricsWindowLocked(e.target.checked)}
									/>
									歌词窗口锁定
								</label>
								<label className='inline'>
									<input
										type='checkbox'
										checked={menuBarShowLyrics}
										onChange={(e) => setMenuBarShowLyrics(e.target.checked)}
									/>
									菜单栏显示歌词
								</label>
								<label className='inline'>
									<input
										type='checkbox'
										checked={autoOpenMiniWindow}
										onChange={(e) => setAutoOpenMiniWindow(e.target.checked)}
									/>
									播放时打开迷你窗口
								</label>
								<label className='inline'>
									<input
										type='checkbox'
										checked={miniAlwaysOnTop}
										onChange={(e) => setMiniAlwaysOnTop(e.target.checked)}
									/>
									迷你窗口置顶
								</label>
								<label className='inline'>
									<input
										type='checkbox'
										checked={autoCache}
										onChange={(e) => setAutoCache(e.target.checked)}
									/>
									播放时自动缓存音频
								</label>
								<div className='chips'>
									<button
										className='chip'
										type='button'
										onClick={() => void exportCached()}
									>
										导出已缓存音频
									</button>
									<button
										className='chip'
										type='button'
										onClick={async () => {
											const result = (await trpc.backup.import.mutate()) as {
												message: string
											}
											setSaved(result.message)
											await refreshPlaylists()
										}}
									>
										导入备份
									</button>
									<button
										className='chip'
										type='button'
										onClick={async () => {
											const result = (await trpc.backup.export.mutate()) as {
												message: string
											}
											setSaved(result.message)
										}}
									>
										导出备份
									</button>
									<button
										className='chip'
										type='button'
										onClick={async () => {
											const result = await trpc.desktop.checkUpdate.mutate()
											setSaved(result.message)
										}}
									>
										检查更新
									</button>
								</div>
								<SkinPicker
									value={skin}
									onChange={(next) => {
										setSkin(next)
										void trpc.settings.set.mutate({ skin: next })
									}}
								/>
								<button
									className='save-btn'
									type='button'
									onClick={() => void saveSettings()}
								>
									保存
								</button>
								{saved && <p className='muted'>{saved}</p>}
							</div>
						</>
					)}
				</main>
			</div>
			<footer
				className='bar'
				onContextMenu={(event) => {
					event.preventDefault()
					setBarMenu({ x: event.clientX, y: event.clientY })
				}}
			>
				<input
					className='progress'
					type='range'
					min={0}
					max={player.duration || 1}
					value={player.currentTime}
					onChange={(e) => player.seek(Math.round(Number(e.target.value)))}
				/>
				<button
					className='now'
					type='button'
					onClick={openPlayer}
				>
					{current?.artwork ? (
						<img
							src={current.artwork}
							alt=''
						/>
					) : (
						<div
							className='cover'
							style={{ width: 56, height: 56, borderRadius: 8 }}
						/>
					)}
					<div className='meta'>
						<div className='title'>{current?.title ?? '未在播放'}</div>
						<div className='artist'>
							{player.lyricLine || current?.artist || '从搜索开始'}
						</div>
					</div>
				</button>
				<div className='controls'>
					<button
						className={`play-icon ${player.shuffle ? 'on' : ''}`}
						type='button'
						title='随机'
						onClick={player.toggleShuffle}
					>
						<Icon
							d={icons.shuffle}
							size={16}
						/>
					</button>
					<button
						className='play-icon'
						type='button'
						onClick={() => player.skip(-1)}
					>
						<Icon d={icons.prev} />
					</button>
					<button
						className='play-pause'
						type='button'
						onClick={player.toggle}
					>
						<Icon
							d={player.playing ? icons.pause : icons.play}
							size={20}
						/>
					</button>
					<button
						className='play-icon'
						type='button'
						onClick={() => player.skip(1)}
					>
						<Icon d={icons.next} />
					</button>
					<button
						className={`play-icon ${player.repeatMode ? 'on' : ''}`}
						type='button'
						title={repeatLabel(player.repeatMode)}
						onClick={player.cycleRepeat}
					>
						<Icon
							d={icons.repeat}
							size={16}
						/>
					</button>
				</div>
				<div className='bar-right'>
					<button
						className='text-btn'
						type='button'
						onClick={cycleSleep}
					>
						{player.sleepLeft > 0
							? `定时 ${formatMs(player.sleepLeft)}`
							: '定时'}
					</button>
					<button
						className='text-btn'
						type='button'
						onClick={player.cycleSpeed}
					>
						{player.playbackRate}x
					</button>
					<button
						className='play-icon'
						type='button'
						title='歌词窗口'
						onClick={() => void trpc.lyrics.toggle.mutate()}
					>
						<Icon d={icons.lyric} />
					</button>
					<button
						className='play-icon'
						type='button'
						title='迷你窗口'
						onClick={() => void trpc.mini.toggle.mutate()}
					>
						<Icon d={icons.music} />
					</button>
					<button
						className='play-icon'
						type='button'
						title='队列'
						onClick={() => setShowQueue((value) => !value)}
					>
						<Icon d={icons.queue} />
					</button>
					<div className='time'>
						<b>{formatMs(player.currentTime)}</b> / {formatMs(player.duration)}
					</div>
				</div>
			</footer>
			{showQueue && (
				<aside className='queue-panel'>
					<div className='queue-head'>
						<strong>播放队列 ({player.queue.length})</strong>
						<div className='chips'>
							<button
								className='chip'
								type='button'
								onClick={() => {
									if (!player.queue.length) return
									void createLocalPlaylist(
										player.queue,
										createTitle.trim() || '播放队列',
									)
								}}
							>
								保存为本地歌单
							</button>
							<button
								type='button'
								onClick={() => setShowQueue(false)}
							>
								关闭
							</button>
						</div>
					</div>
					<div className='list'>
						{player.queue.map((item, i) => (
							<button
								className={`row ${i === player.index ? 'active' : ''}`}
								key={`${item.id}-${i}`}
								type='button'
								onClick={() => void player.playTrack(player.queue, i)}
							>
								<span className='idx'>{String(i + 1).padStart(2, '0')}</span>
								<img
									className='cover'
									src={item.artwork}
									alt=''
								/>
								<div>
									<div>{item.title}</div>
									<div className='sub'>{item.artist}</div>
								</div>
								<button
									type='button'
									className='text-btn'
									onClick={(event) => {
										event.stopPropagation()
										player.removeFromQueue(item.id)
									}}
								>
									移除
								</button>
							</button>
						))}
					</div>
				</aside>
			)}
			{tab === 'player' && current && (
				<NowPlaying
					track={current}
					player={player}
					commentsOpen={showComments}
					queueOpen={showQueue}
					onClose={() => setTab(lastTab === 'player' ? 'home' : lastTab)}
					onToggleComments={() => setShowComments((value) => !value)}
					onToggleQueue={() => setShowQueue((value) => !value)}
					onSleep={cycleSleep}
				/>
			)}
			{tab === 'player' && current && showComments && (
				<CommentsPanel
					key={current.bvid}
					bvid={current.bvid}
					onClose={() => setShowComments(false)}
				/>
			)}
			<audio
				ref={player.audioRef}
				preload='auto'
			/>
			{menu && (
				<div
					className='ctx-backdrop'
					onClick={() => setMenu(null)}
					onContextMenu={(event) => {
						event.preventDefault()
						setMenu(null)
					}}
				>
					<div
						className='ctx-menu'
						style={{ left: menu.x, top: menu.y }}
						onClick={(event) => event.stopPropagation()}
					>
						<button
							type='button'
							onClick={() => {
								startPlay(
									pages,
									pages.findIndex((item) => item.id === menu.track.id),
								)
								setMenu(null)
							}}
						>
							播放
						</button>
						<button
							type='button'
							onClick={() => {
								player.playNext(menu.track)
								setMenu(null)
							}}
						>
							下一首播放
						</button>
						<button
							type='button'
							onClick={() => {
								player.addToEnd(menu.track)
								setMenu(null)
							}}
						>
							加入队列末尾
						</button>
						<button
							type='button'
							onClick={() => {
								setPickPlaylistFor(menu.track)
								setMenu(null)
							}}
						>
							添加到本地歌单
						</button>
						<button
							type='button'
							onClick={() => {
								if (downloadTasks[menu.track.id] === 'completed') {
									void trpc.downloads.remove.mutate({ id: menu.track.id })
								} else {
									void trpc.downloads.start.mutate(menu.track)
								}
								setMenu(null)
							}}
						>
							{downloadTasks[menu.track.id] === 'completed'
								? '删除缓存'
								: downloadTasks[menu.track.id] === 'downloading' ||
									  downloadTasks[menu.track.id] === 'queued'
									? '正在缓存'
									: '缓存音频'}
						</button>
						{downloadTasks[menu.track.id] === 'completed' && (
							<button
								type='button'
								onClick={() => {
									void exportCached([menu.track.id])
									setMenu(null)
								}}
							>
								导出
							</button>
						)}
						{activePlaylistId && (
							<button
								type='button'
								onClick={() => {
									void trpc.library.removeTrack
										.mutate({
											playlistId: activePlaylistId,
											trackId: menu.track.id,
										})
										.then(() => openPlaylist(activePlaylistId))
										.then(refreshPlaylists)
									setMenu(null)
								}}
							>
								从列表中移除
							</button>
						)}
					</div>
				</div>
			)}
			{barMenu && (
				<div
					className='ctx-backdrop'
					onClick={() => setBarMenu(null)}
					onContextMenu={(event) => {
						event.preventDefault()
						setBarMenu(null)
					}}
				>
					<div
						className='ctx-menu'
						style={{ left: barMenu.x, top: barMenu.y }}
						onClick={(event) => event.stopPropagation()}
					>
						<button
							type='button'
							onClick={() => {
								setShowQueue(true)
								setBarMenu(null)
							}}
						>
							打开队列
						</button>
						<button
							type='button'
							onClick={() => {
								void trpc.lyrics.toggle.mutate({ show: true })
								setBarMenu(null)
							}}
						>
							打开歌词窗口
						</button>
						<button
							type='button'
							onClick={() => {
								void trpc.mini.toggle.mutate({ show: true })
								setBarMenu(null)
							}}
						>
							打开迷你窗口
						</button>
					</div>
				</div>
			)}
			{playlistMenu && (
				<div
					className='ctx-backdrop'
					onClick={() => setPlaylistMenu(null)}
					onContextMenu={(event) => {
						event.preventDefault()
						setPlaylistMenu(null)
					}}
				>
					<div
						className='ctx-menu'
						style={{ left: playlistMenu.x, top: playlistMenu.y }}
						onClick={(event) => event.stopPropagation()}
					>
						{(() => {
							const playlist = playlists.find(
								(item) => item.id === playlistMenu.id,
							)
							if (!playlist) return null
							return (
								<>
									{!playlist.shareId && (
										<button
											type='button'
											onClick={() =>
												void runPlaylistAction(playlist.id, 'share')
											}
										>
											设为共享
										</button>
									)}
									{playlist.shareId && (
										<button
											type='button'
											onClick={() =>
												void runPlaylistAction(playlist.id, 'copy')
											}
										>
											复制订阅链接
										</button>
									)}
									{playlist.shareRole === 'owner' && (
										<button
											type='button'
											onClick={() =>
												void runPlaylistAction(playlist.id, 'editor')
											}
										>
											复制协作链接
										</button>
									)}
									{playlist.shareId && (
										<button
											type='button'
											onClick={() =>
												void runPlaylistAction(playlist.id, 'sync')
											}
										>
											同步云端
										</button>
									)}
									{playlist.shareRole === 'owner' && (
										<button
											type='button'
											onClick={() =>
												void runPlaylistAction(playlist.id, 'rotate')
											}
										>
											重置邀请码
										</button>
									)}
									<button
										type='button'
										onClick={() =>
											void runPlaylistAction(playlist.id, 'delete')
										}
									>
										删除
									</button>
								</>
							)
						})()}
					</div>
				</div>
			)}
			{pickPlaylistFor && (
				<div
					className='ctx-backdrop'
					onClick={() => setPickPlaylistFor(null)}
				>
					<div
						className='dialog'
						onClick={(event) => event.stopPropagation()}
					>
						<div className='section-title'>添加到本地歌单</div>
						{playlists.length === 0 && (
							<p className='muted'>还没有歌单。先在音乐库创建一个。</p>
						)}
						{playlists.map((playlist) => (
							<button
								key={playlist.id}
								type='button'
								className='row'
								onClick={() =>
									void addTrackToPlaylist(playlist.id, pickPlaylistFor)
								}
							>
								<div>{playlist.title}</div>
								<div className='sub'>{playlist.itemCount} 首</div>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
