import '@applemusic-like-lyrics/core/style.css'

import {
	HouseIcon,
	LibraryIcon,
	ListMusicIcon,
	PauseIcon,
	PlayIcon,
	RepeatIcon,
	SearchIcon,
	SettingsIcon,
	ShuffleIcon,
	SkipBackIcon,
	SkipForwardIcon,
	MusicIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { SettingSwitch } from '@/components/setting-switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@/components/ui/input-group'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { BbplayerAccount } from './BbplayerAccount'
import { CommentsPanel } from './CommentsPanel'
import { NowPlaying } from './NowPlaying'
import { PhoneLogin } from './PhoneLogin'
import { formatMs, repeatLabel, type TrackItem } from './playback'
import { SkinPicker, type SkinTheme } from './SkinPicker'
import { listen, trpcClient } from './trpc'
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
const coverButtonClass =
	'h-auto min-w-0 flex-col items-stretch gap-2 p-0 whitespace-normal'

function CoverFace({ src, fallback }: { src?: string; fallback?: string }) {
	if (src) {
		return (
			<img
				src={src}
				alt=''
				className='aspect-square w-full rounded-xl object-cover'
			/>
		)
	}
	return (
		<div className='bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center rounded-xl text-2xl'>
			{fallback}
		</div>
	)
}

function CoverMeta({
	title,
	subtitle,
	active,
}: {
	title: string
	subtitle: string
	active?: boolean
}) {
	return (
		<>
			<span
				className={cn(
					'line-clamp-2 text-left text-sm',
					active && 'text-primary',
				)}
			>
				{title}
			</span>
			<span className='text-muted-foreground line-clamp-1 text-left text-xs'>
				{subtitle}
			</span>
		</>
	)
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
	const [menuBarShowLyrics, setMenuBarShowLyrics] = useState(false)
	const [saved, setSaved] = useState('')
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
	const [pickPlaylistFor, setPickPlaylistFor] = useState<TrackItem | null>(null)
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
		void trpcClient.settings.get.query().then((settings) => {
			setCookie(settings.cookie)
			setContinuePlayingAfterClose(settings.continuePlayingAfterClose)
			setMenuBarShowLyrics(settings.menuBarShowLyrics)
			setAutoCache(settings.autoCache ?? true)
			setSkin(settings.skin ?? null)
			setAccount(settings.account)
		})
		void refreshPlaylists()
		void loadRemoteLibrary()
		void trpcClient.downloads.list.query().then(setDownloads)
		void trpcClient.downloads.status.query().then(setDownloadTasks)
		void trpcClient.share.pending.query().then((payload) => {
			if (!payload?.shareId) return
			setShareInput(payload.shareId)
			if (payload.inviteCode) setShareInvite(payload.inviteCode)
			setTab('library')
		})
	}, [])

	useEffect(() => {
		return listen(trpcClient.share.incoming.subscribe, (payload) => {
			if (!payload.shareId) return
			setShareInput(payload.shareId)
			if (payload.inviteCode) setShareInvite(payload.inviteCode)
			setTab('library')
		})
	}, [])

	useEffect(() => {
		return listen(trpcClient.downloads.updates.subscribe, (payload) => {
			setDownloads(payload.records as TrackItem[])
			setDownloadTasks(payload.tasks)
			if (listTitle === '已下载') setPages(payload.records as TrackItem[])
		})
	}, [listTitle])

	useEffect(() => {
		return listen(trpcClient.auth.qrUpdates.subscribe, (payload) => {
			void (async () => {
				setQr(payload)
				if (payload.status === 'success') {
					const settings = await trpcClient.settings.get.query()
					setCookie(settings.cookie)
					setAccount(settings.account)
					await loadRemoteLibrary()
				}
			})()
		})
	}, [])

	const refreshPlaylists = async () => {
		setPlaylists(await trpcClient.library.list.query())
	}

	const loadRemoteLibrary = async () => {
		try {
			const remote = await trpcClient.bili.library.query()
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
			const result = await trpcClient.bili.favorite.query({ id })
			showRemoteVideos(result.title, result.videos)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openCollection = async (id: string) => {
		try {
			const result = await trpcClient.bili.collection.query({ id })
			showRemoteVideos(result.title, result.videos)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openWatchLater = async () => {
		try {
			const result = await trpcClient.bili.watchLater.query()
			showRemoteVideos(result.title, result.videos)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openPlaylist = async (id: string) => {
		let playlist = await trpcClient.library.get.query({ id })
		if (!playlist) return
		if (playlist.shareId) {
			try {
				await trpcClient.share.pull.mutate({ playlistId: id })
				playlist = (await trpcClient.library.get.query({ id })) ?? playlist
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
		return listen(trpcClient.player.commands.subscribe, (command) => {
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
		const matched = await trpcClient.player.matchSearch.query({ query: q })
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
				const video = await trpcClient.bili.video.query({ bvid: strategy.bvid })
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
				const result = await trpcClient.bili.search.query({ keyword })
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
				const result = await trpcClient.bili.uploader.query({
					mid: strategy.mid,
				})
				showRemoteVideos(result.title, result.videos)
				return
			}
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openHit = async (hit: SearchHit) => {
		const video = await trpcClient.bili.video.query({ bvid: hit.bvid })
		setActivePlaylistId(null)
		setListTitle(video.title)
		setPages(video.pages)
		setHits([])
		setTab('library')
	}

	const saveSettings = async () => {
		await trpcClient.settings.set.mutate({
			cookie,
			continuePlayingAfterClose,
			menuBarShowLyrics,
			autoCache,
			skin,
		})
		const accountNow = await trpcClient.auth.refresh.mutate()
		setAccount(accountNow)
		await loadRemoteLibrary()
		setSaved('已保存')
	}

	const exportCached = async (ids?: string[]) => {
		const result = (await trpcClient.downloads.export.mutate({ ids })) as {
			message: string
		}
		setSaved(result.message)
		if (result.message === '没有可导出的歌曲') {
			player.setError(result.message)
		}
	}

	const logout = async () => {
		await trpcClient.auth.logout.mutate()
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
		const playlist = await trpcClient.library.create.mutate({ title, tracks })
		setCreateTitle('')
		await refreshPlaylists()
		await openPlaylist(playlist.id)
	}

	const addTrackToPlaylist = async (playlistId: string, track: TrackItem) => {
		await trpcClient.library.addTracks.mutate({ playlistId, tracks: [track] })
		setPickPlaylistFor(null)
		await refreshPlaylists()
		if (activePlaylistId === playlistId) await openPlaylist(playlistId)
	}

	const subscribeShared = async () => {
		setLibraryNotice('')
		try {
			await trpcClient.share.preview.query({ input: shareInput })
			const result = await trpcClient.share.subscribe.mutate({
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
		try {
			if (action === 'delete') {
				if (!window.confirm(`删除「${playlist?.title ?? ''}」？`)) return
				await trpcClient.library.delete.mutate({ id })
				await refreshPlaylists()
				if (activePlaylistId === id) {
					setActivePlaylistId(null)
					setPages([])
					setListTitle('')
				}
				return
			}
			if (action === 'share') {
				const result = await trpcClient.share.enable.mutate({ playlistId: id })
				setLibraryNotice(
					result.alreadyShared ? `已复制订阅链接` : '已设为共享，链接已复制',
				)
				await trpcClient.desktop.copyText.mutate({ text: result.subscribeUrl })
				await refreshPlaylists()
				return
			}
			if (action === 'copy') {
				await trpcClient.share.copyLink.mutate({
					playlistId: id,
					kind: 'subscribe',
				})
				setLibraryNotice('已复制订阅链接')
				return
			}
			if (action === 'editor') {
				await trpcClient.share.copyLink.mutate({
					playlistId: id,
					kind: 'editor',
				})
				setLibraryNotice('已复制协作链接')
				return
			}
			if (action === 'sync') {
				await trpcClient.share.pull.mutate({ playlistId: id })
				setLibraryNotice('云端共享歌单已同步')
				await refreshPlaylists()
				if (activePlaylistId === id) await openPlaylist(id)
				return
			}
			if (action === 'rotate') {
				await trpcClient.share.rotateInvite.mutate({ playlistId: id })
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

	return (
		<TooltipProvider>
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
							<MusicIcon />
						</span>
						BBPlayer
					</div>
					<InputGroup className='max-w-xl flex-1 bg-background/40'>
						<InputGroupAddon>
							<SearchIcon />
						</InputGroupAddon>
						<InputGroupInput
							ref={searchRef}
							placeholder='搜索关键词 / b23.tv / av / bv'
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') void submitSearch()
							}}
						/>
					</InputGroup>
					<Button
						type='button'
						variant='ghost'
						size='icon'
						onClick={() => setTab('settings')}
						aria-label='设置'
					>
						<SettingsIcon />
					</Button>
				</header>
				<div className='body'>
					<aside className='sidebar'>
						<div className='nav-label'>在线音乐</div>
						<Button
							className='w-full justify-start'
							variant={tab === 'home' ? 'secondary' : 'ghost'}
							onClick={() => setTab('home')}
							type='button'
						>
							<HouseIcon data-icon='inline-start' />
							主页
						</Button>
						<Button
							className='w-full justify-start'
							variant={tab === 'library' ? 'secondary' : 'ghost'}
							onClick={() => setTab('library')}
							type='button'
						>
							<LibraryIcon data-icon='inline-start' />
							音乐库
						</Button>
						<div className='nav-label'>其他</div>
						<Button
							className='w-full justify-start'
							variant={tab === 'settings' ? 'secondary' : 'ghost'}
							onClick={() => setTab('settings')}
							type='button'
						>
							<SettingsIcon data-icon='inline-start' />
							设置
						</Button>
						{current && (
							<Button
								className='w-full justify-start'
								variant={tab === 'player' ? 'secondary' : 'ghost'}
								onClick={openPlayer}
								type='button'
							>
								<MusicIcon data-icon='inline-start' />
								正在播放
							</Button>
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
									<Card>
										<CardHeader>
											<CardTitle>快速开始</CardTitle>
											<CardDescription>
												粘贴完整链接，或直接输入作品标题。
											</CardDescription>
										</CardHeader>
										<CardContent className='flex flex-wrap gap-2'>
											<Button
												type='button'
												variant='secondary'
												onClick={() => void submitSearch('洛天依')}
											>
												洛天依
											</Button>
											<Button
												type='button'
												variant='secondary'
												onClick={() =>
													void submitSearch('Never Gonna Give You Up')
												}
											>
												Never Gonna Give You Up
											</Button>
										</CardContent>
									</Card>
									<Card className='hero-play'>
										{current ? (
											<CardContent className='flex items-center gap-4'>
												<img
													src={current.artwork}
													alt=''
													className='size-24 rounded-xl object-cover'
												/>
												<div className='min-w-0 flex-1'>
													<div className='text-muted-foreground'>
														队列 {player.queue.length} 首
													</div>
													<div className='truncate font-medium'>
														{current.title}
													</div>
													<div className='text-muted-foreground truncate'>
														{current.artist}
													</div>
													<div className='mt-2 flex flex-wrap gap-2'>
														<Button
															type='button'
															size='sm'
															onClick={player.toggle}
														>
															{player.playing ? '暂停' : '继续播放'}
														</Button>
														<Button
															type='button'
															size='sm'
															variant='secondary'
															onClick={openPlayer}
														>
															打开播放页
														</Button>
													</div>
												</div>
											</CardContent>
										) : (
											<>
												<CardHeader>
													<CardTitle>尚未播放</CardTitle>
													<CardDescription>
														{player.queue.length
															? '上次队列还在，按空格或播放即可续播。'
															: '搜索后点进分 P，封面会铺到整个窗口背景。'}
													</CardDescription>
												</CardHeader>
											</>
										)}
									</Card>
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
								<div className='flex flex-wrap items-center gap-2'>
									<Input
										value={shareInput}
										placeholder='粘贴共享链接或歌单 ID'
										onChange={(e) => setShareInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') void subscribeShared()
										}}
									/>
									<Input
										className='max-w-40'
										value={shareInvite}
										placeholder='邀请码（可选）'
										onChange={(e) => setShareInvite(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') void subscribeShared()
										}}
									/>
									<Button
										type='button'
										variant='secondary'
										onClick={() => void subscribeShared()}
									>
										订阅共享歌单
									</Button>
								</div>
								{account && (
									<>
										<div className='section-title'>B 站</div>
										<div className='cover-grid'>
											<Button
												className={coverButtonClass}
												type='button'
												variant='ghost'
												onClick={() => void openWatchLater()}
											>
												<CoverFace fallback='稍' />
												<CoverMeta
													title='稍后再看'
													subtitle={`${watchLaterCount} 首`}
												/>
											</Button>
											{favorites.map((folder) => (
												<Button
													className={coverButtonClass}
													key={`fav-${folder.id}`}
													type='button'
													variant='ghost'
													onClick={() => void openFavorite(folder.id)}
												>
													<CoverFace
														src={folder.coverUrl}
														fallback='藏'
													/>
													<CoverMeta
														title={folder.title}
														subtitle={`${folder.itemCount} 首`}
													/>
												</Button>
											))}
											{collections.map((folder) => (
												<Button
													className={coverButtonClass}
													key={`col-${folder.id}`}
													type='button'
													variant='ghost'
													onClick={() => void openCollection(folder.id)}
												>
													<CoverFace
														src={folder.coverUrl}
														fallback='集'
													/>
													<CoverMeta
														title={folder.title}
														subtitle={`${folder.itemCount} 首`}
													/>
												</Button>
											))}
										</div>
									</>
								)}
								<div className='section-title'>本地歌单</div>
								<div className='cover-grid'>
									<Button
										className={coverButtonClass}
										type='button'
										variant='ghost'
										onClick={() => {
											setActivePlaylistId(null)
											setHits([])
											setPages(downloads)
											setListTitle('已下载')
											setDownloadQuery('')
											setTab('library')
										}}
									>
										<CoverFace fallback='下' />
										<CoverMeta
											title='已下载'
											subtitle={`${downloads.length} 首`}
										/>
									</Button>
								</div>
								<div className='flex flex-wrap items-center gap-2'>
									<Input
										value={createTitle}
										placeholder='新播放列表标题'
										onChange={(e) => setCreateTitle(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') void createLocalPlaylist()
										}}
									/>
									<Button
										type='button'
										onClick={() => void createLocalPlaylist()}
									>
										创建播放列表
									</Button>
								</div>
								{playlists.length > 0 && (
									<div className='cover-grid'>
										{playlists.map((playlist) => (
											<ContextMenu key={playlist.id}>
												<ContextMenuTrigger>
													<Button
														className={coverButtonClass}
														type='button'
														variant='ghost'
														onClick={() => void openPlaylist(playlist.id)}
													>
														<CoverFace
															src={playlist.coverUrl}
															fallback={playlist.title.slice(0, 1)}
														/>
														<CoverMeta
															title={playlist.title}
															subtitle={
																playlist.shareRole
																	? `${shareRoleLabel(playlist.shareRole)} · ${playlist.itemCount} 首`
																	: `${playlist.itemCount} 首`
															}
															active={activePlaylistId === playlist.id}
														/>
													</Button>
												</ContextMenuTrigger>
												<ContextMenuContent>
													<ContextMenuGroup>
														{!playlist.shareId && (
															<ContextMenuItem
																onClick={() =>
																	void runPlaylistAction(playlist.id, 'share')
																}
															>
																设为共享
															</ContextMenuItem>
														)}
														{playlist.shareId && (
															<ContextMenuItem
																onClick={() =>
																	void runPlaylistAction(playlist.id, 'copy')
																}
															>
																复制订阅链接
															</ContextMenuItem>
														)}
														{playlist.shareRole === 'owner' && (
															<ContextMenuItem
																onClick={() =>
																	void runPlaylistAction(playlist.id, 'editor')
																}
															>
																复制协作链接
															</ContextMenuItem>
														)}
														{playlist.shareId && (
															<ContextMenuItem
																onClick={() =>
																	void runPlaylistAction(playlist.id, 'sync')
																}
															>
																同步云端
															</ContextMenuItem>
														)}
														{playlist.shareRole === 'owner' && (
															<ContextMenuItem
																onClick={() =>
																	void runPlaylistAction(playlist.id, 'rotate')
																}
															>
																重置邀请码
															</ContextMenuItem>
														)}
														<ContextMenuItem
															variant='destructive'
															onClick={() =>
																void runPlaylistAction(playlist.id, 'delete')
															}
														>
															删除
														</ContextMenuItem>
													</ContextMenuGroup>
												</ContextMenuContent>
											</ContextMenu>
										))}
									</div>
								)}
								{listTitle === '已下载' && (
									<div className='flex flex-wrap items-center gap-2'>
										<Input
											value={downloadQuery}
											placeholder='搜索已下载歌曲'
											onChange={(e) => setDownloadQuery(e.target.value)}
										/>
										<Button
											type='button'
											variant='secondary'
											onClick={() => void exportCached()}
										>
											导出
										</Button>
									</div>
								)}
								{hits.length > 0 && (
									<div className='cover-grid'>
										{hits.map((hit) => (
											<Button
												className={coverButtonClass}
												key={hit.bvid}
												type='button'
												variant='ghost'
												onClick={() => void openHit(hit)}
											>
												<CoverFace src={hit.pic} />
												<CoverMeta
													title={stripHtml(hit.title)}
													subtitle={`${hit.author} · ${hit.duration}`}
												/>
											</Button>
										))}
									</div>
								)}
								{visiblePages.length > 0 && (
									<div className='flex flex-col gap-1'>
										{visiblePages.map((page, i) => (
											<ContextMenu key={page.id}>
												<ContextMenuTrigger>
													<Button
														className={cn(
															'grid h-auto w-full grid-cols-[28px_48px_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 whitespace-normal',
															current?.id === page.id && 'bg-muted',
														)}
														type='button'
														variant='ghost'
														onClick={() => startPlay(visiblePages, i)}
													>
														<span className='text-muted-foreground text-right text-[13px]'>
															{String(i + 1).padStart(2, '0')}
														</span>
														<img
															className='size-12 rounded-lg object-cover'
															src={page.artwork}
															alt=''
														/>
														<div className='min-w-0 text-left'>
															<div className='truncate'>{page.title}</div>
															<div className='text-muted-foreground truncate text-xs'>
																{page.artist}
															</div>
														</div>
														<span className='text-muted-foreground text-xs'>
															{downloadTasks[page.id] === 'completed'
																? '已缓存'
																: downloadTasks[page.id] === 'downloading'
																	? '缓存中'
																	: downloadTasks[page.id] === 'queued'
																		? '排队'
																		: formatMs(page.duration * 1000)}
														</span>
													</Button>
												</ContextMenuTrigger>
												<ContextMenuContent>
													<ContextMenuGroup>
														<ContextMenuItem
															onClick={() => startPlay(visiblePages, i)}
														>
															播放
														</ContextMenuItem>
														<ContextMenuItem
															onClick={() => player.playNext(page)}
														>
															下一首播放
														</ContextMenuItem>
														<ContextMenuItem
															onClick={() => player.addToEnd(page)}
														>
															加入队列末尾
														</ContextMenuItem>
														<ContextMenuItem
															onClick={() => setPickPlaylistFor(page)}
														>
															添加到本地歌单
														</ContextMenuItem>
														<ContextMenuItem
															onClick={() => {
																if (downloadTasks[page.id] === 'completed') {
																	void trpcClient.downloads.remove.mutate({
																		id: page.id,
																	})
																} else {
																	void trpcClient.downloads.start.mutate(page)
																}
															}}
														>
															{downloadTasks[page.id] === 'completed'
																? '删除缓存'
																: downloadTasks[page.id] === 'downloading' ||
																	  downloadTasks[page.id] === 'queued'
																	? '正在缓存'
																	: '缓存音频'}
														</ContextMenuItem>
														{downloadTasks[page.id] === 'completed' && (
															<ContextMenuItem
																onClick={() => void exportCached([page.id])}
															>
																导出
															</ContextMenuItem>
														)}
														{activePlaylistId && (
															<ContextMenuItem
																onClick={() => {
																	void trpcClient.library.removeTrack
																		.mutate({
																			playlistId: activePlaylistId,
																			trackId: page.id,
																		})
																		.then(() => openPlaylist(activePlaylistId))
																		.then(refreshPlaylists)
																}}
															>
																从列表中移除
															</ContextMenuItem>
														)}
													</ContextMenuGroup>
												</ContextMenuContent>
											</ContextMenu>
										))}
									</div>
								)}
								{!hits.length &&
									!pages.length &&
									playlists.length === 0 &&
									!account && (
										<Empty>
											<EmptyHeader>
												<EmptyTitle>还没有内容</EmptyTitle>
												<EmptyDescription>
													创建本地歌单，或用顶栏搜索试试。
												</EmptyDescription>
											</EmptyHeader>
										</Empty>
									)}
								{player.error && <p className='error'>{player.error}</p>}
							</>
						)}
						{tab === 'settings' && (
							<>
								<h1 className='page-title'>设置</h1>
								<Card>
									<CardContent>
										<BbplayerAccount
											biliLoggedIn={Boolean(account)}
											onPlaylistsChanged={() => void refreshPlaylists()}
										/>
									</CardContent>
								</Card>
								<Card>
									<CardHeader>
										<CardDescription>
											扫码登录后可打开收藏夹、合集和稍后再看。也可以继续粘贴
											Cookie。
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
													<AvatarFallback>
														{account.name.slice(0, 1)}
													</AvatarFallback>
												</Avatar>
												<div className='min-w-0 flex-1'>
													<div className='truncate font-medium'>
														{account.name}
													</div>
													<div className='text-muted-foreground'>
														UID {account.mid}
													</div>
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
												{qr?.dataUrl ? (
													<img
														className='size-40 rounded-lg'
														src={qr.dataUrl}
														alt='登录二维码'
													/>
												) : (
													<div className='bg-muted text-muted-foreground flex size-40 items-center justify-center rounded-lg'>
														二维码
													</div>
												)}
												<p className='text-muted-foreground'>
													{qr?.statusText || '点击下方按钮生成二维码'}
												</p>
												<div className='flex flex-wrap gap-2'>
													<Button
														type='button'
														variant='secondary'
														onClick={() =>
															void trpcClient.auth.qrStart
																.mutate()
																.catch((err) => {
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
													</Button>
													{qr?.url && (
														<Button
															type='button'
															variant='outline'
															onClick={() =>
																void trpcClient.desktop.openExternal.mutate({
																	url: qr.url!,
																})
															}
														>
															在浏览器打开
														</Button>
													)}
												</div>
											</div>
										)}
										<PhoneLogin
											disabled={Boolean(account)}
											onLoggedIn={() => {
												void trpcClient.settings.get
													.query()
													.then((settings) => {
														setCookie(settings.cookie)
														setAccount(settings.account)
													})
												void loadRemoteLibrary()
											}}
										/>
										<Field>
											<FieldLabel htmlFor='cookie'>Cookie</FieldLabel>
											<Textarea
												id='cookie'
												value={cookie}
												onChange={(e) => setCookie(e.target.value)}
												placeholder='粘贴 Bilibili Cookie'
											/>
										</Field>
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
													const result =
														(await trpcClient.backup.import.mutate()) as {
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
													const result =
														(await trpcClient.backup.export.mutate()) as {
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
													const result =
														await trpcClient.desktop.checkUpdate.mutate()
													setSaved(result.message)
												}}
											>
												检查更新
											</Button>
										</div>
										<SkinPicker
											value={skin}
											onChange={(next) => {
												setSkin(next)
												void trpcClient.settings.set.mutate({ skin: next })
											}}
										/>
									</CardContent>
									<CardFooter className='justify-start'>
										<Button
											type='button'
											onClick={() => void saveSettings()}
										>
											保存
										</Button>
										{saved && <p className='text-muted-foreground'>{saved}</p>}
									</CardFooter>
								</Card>
							</>
						)}
					</main>
				</div>
				<footer className='bar'>
					<Slider
						className='absolute top-[-8px] right-0 left-0'
						min={0}
						max={player.duration || 1}
						value={player.currentTime}
						onValueChange={(value) => {
							const next = Array.isArray(value) ? value[0] : value
							player.seek(Math.round(Number(next)))
						}}
					/>
					<Button
						className='now h-auto justify-start gap-3 px-0 hover:bg-transparent'
						variant='ghost'
						type='button'
						onClick={openPlayer}
					>
						{current?.artwork ? (
							<img
								src={current.artwork}
								alt=''
								className='size-14 rounded-lg object-cover'
							/>
						) : (
							<div className='bg-muted size-14 rounded-lg' />
						)}
						<div className='min-w-0 text-left'>
							<div className='truncate font-medium'>
								{current?.title ?? '未在播放'}
							</div>
							<div className='text-muted-foreground truncate text-sm'>
								{player.lyricLine || current?.artist || '从搜索开始'}
							</div>
						</div>
					</Button>
					<div className='controls'>
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
							size='icon-lg'
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
							type='button'
							title={repeatLabel(player.repeatMode)}
							onClick={player.cycleRepeat}
						>
							<RepeatIcon />
						</Button>
					</div>
					<div className='bar-right'>
						<Button
							variant='ghost'
							size='sm'
							type='button'
							onClick={cycleSleep}
						>
							{player.sleepLeft > 0
								? `定时 ${formatMs(player.sleepLeft)}`
								: '定时'}
						</Button>
						<Button
							variant='ghost'
							size='sm'
							type='button'
							onClick={player.cycleSpeed}
						>
							{player.playbackRate}x
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
						<div className='time'>
							<b>{formatMs(player.currentTime)}</b> /{' '}
							{formatMs(player.duration)}
						</div>
					</div>
				</footer>
				{showQueue && (
					<aside className='queue-panel'>
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
