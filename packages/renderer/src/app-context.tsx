import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from 'react'

import type { TrackItem } from './playback'
import type { SkinTheme } from './SkinPicker'
import { listen, trpcClient } from './trpc'
import { usePlayback } from './usePlayback'

export interface SearchHit {
	bvid: string
	title: string
	pic: string
	author: string
	duration: string
}

export type PlaylistSummary = {
	id: string
	title: string
	description: string
	coverUrl: string
	itemCount: number
}

export type RemoteFolder = {
	id: string
	title: string
	coverUrl: string
	itemCount: number
}

export type AccountInfo = {
	mid: number
	name: string
	face: string
}

function useAppModel() {
	const navigate = useNavigate()
	const router = useRouter()
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})
	const player = usePlayback()
	const searchRef = useRef<HTMLInputElement>(null)
	const [query, setQuery] = useState('')
	const [hits, setHits] = useState<SearchHit[]>([])
	const [pages, setPages] = useState<TrackItem[]>([])
	const [listTitle, setListTitle] = useState('')
	const [continuePlayingAfterClose, setContinuePlayingAfterClose] =
		useState(true)
	const [menuBarShowLyrics, setMenuBarShowLyrics] = useState(false)
	const [saved, setSaved] = useState('')
	const [showQueue, setShowQueue] = useState(false)
	const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
	const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
	const [createTitle, setCreateTitle] = useState('')
	const [pickPlaylistFor, setPickPlaylistFor] = useState<TrackItem | null>(null)
	const [autoCache, setAutoCache] = useState(true)
	const [skin, setSkin] = useState<SkinTheme | null>(null)
	const [showComments, setShowComments] = useState(false)
	const [downloads, setDownloads] = useState<TrackItem[]>([])
	const [downloadTasks, setDownloadTasks] = useState<Record<string, string>>({})
	const [downloadQuery, setDownloadQuery] = useState('')
	const [account, setAccount] = useState<AccountInfo | null>(null)
	const [favorites, setFavorites] = useState<RemoteFolder[]>([])
	const [collections, setCollections] = useState<RemoteFolder[]>([])
	const [watchLaterCount, setWatchLaterCount] = useState(0)
	const [loginBusy, setLoginBusy] = useState(false)
	const [loginMessage, setLoginMessage] = useState('')

	const current = player.current
	const isPlayer = pathname === '/player'
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
		void navigate({ to: '/library' })
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
		const playlist = await trpcClient.library.get.query({ id })
		if (!playlist) return
		setActivePlaylistId(id)
		setListTitle(playlist.title)
		setPages(playlist.tracks)
		setHits([])
		void navigate({ to: '/library' })
	}

	useEffect(() => {
		void trpcClient.settings.get.query().then((settings) => {
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
	}, [])

	useEffect(() => {
		return listen(trpcClient.downloads.updates.subscribe, (payload) => {
			setDownloads(payload.records as TrackItem[])
			setDownloadTasks(payload.tasks)
			if (listTitle === '已下载') setPages(payload.records as TrackItem[])
		})
	}, [listTitle])

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
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [player])

	useEffect(() => {
		if (isPlayer && !current) {
			void navigate({ to: '/' })
		}
	}, [current, isPlayer, navigate])

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
				if (pathname !== '/player') void navigate({ to: '/' })
			}
			if (command === 'open-settings') void navigate({ to: '/settings' })
			if (command === 'open-player' && player.current) {
				void navigate({ to: '/player' })
			}
			if (command === 'sleep-off') player.startSleep(0)
			else if (command.startsWith('sleep-')) {
				const minutes = Number(command.slice(6))
				if (minutes > 0) player.startSleep(minutes)
			}
		})
	}, [navigate, pathname, player])

	const closePlayer = useCallback(() => {
		if (router.history.canGoBack()) {
			router.history.back()
			return
		}
		void navigate({ to: '/' })
	}, [navigate, router])

	const openPlayer = () => {
		if (!current) return
		void navigate({ to: '/player' })
	}

	const startPlay = (list: TrackItem[], start: number) => {
		void navigate({ to: '/player' })
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
				void navigate({ to: '/library' })
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
				void navigate({ to: '/library' })
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
		void navigate({ to: '/library' })
	}

	const persistContinuePlayingAfterClose = (value: boolean) => {
		setContinuePlayingAfterClose(value)
		void trpcClient.settings.set.mutate({ continuePlayingAfterClose: value })
	}

	const persistMenuBarShowLyrics = (value: boolean) => {
		setMenuBarShowLyrics(value)
		void trpcClient.settings.set.mutate({ menuBarShowLyrics: value })
	}

	const persistAutoCache = (value: boolean) => {
		setAutoCache(value)
		void trpcClient.settings.set.mutate({ autoCache: value })
	}

	const persistSkin = (value: SkinTheme | null) => {
		setSkin(value)
		void trpcClient.settings.set.mutate({ skin: value })
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
		setAccount(null)
		setFavorites([])
		setCollections([])
		setWatchLaterCount(0)
		setLoginMessage('')
		setSaved('已退出登录')
	}

	const connectBili = async () => {
		setLoginBusy(true)
		setLoginMessage('')
		try {
			const result = await trpcClient.auth.webStart.mutate()
			setAccount(result.account)
			await loadRemoteLibrary()
			setLoginMessage('登录成功')
		} catch (err) {
			setLoginMessage(err instanceof Error ? err.message : String(err))
		} finally {
			setLoginBusy(false)
		}
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

	const deletePlaylist = async (id: string) => {
		const playlist = playlists.find((item) => item.id === id)
		if (!window.confirm(`删除「${playlist?.title ?? ''}」？`)) return
		await trpcClient.library.delete.mutate({ id })
		await refreshPlaylists()
		if (activePlaylistId === id) {
			setActivePlaylistId(null)
			setPages([])
			setListTitle('')
		}
	}

	const openDownloads = () => {
		setActivePlaylistId(null)
		setHits([])
		setPages(downloads)
		setListTitle('已下载')
		setDownloadQuery('')
		void navigate({ to: '/library' })
	}

	const cycleSleep = () => {
		const steps = [0, 15, 30, 45, 60]
		const currentMinutes = Math.ceil(player.sleepLeft / 60000)
		const at = steps.findIndex((step) => step >= currentMinutes)
		const next = steps[(at < 0 ? 0 : at) + 1] ?? 0
		player.startSleep(next)
	}

	return {
		pathname,
		isPlayer,
		player,
		searchRef,
		query,
		setQuery,
		hits,
		pages,
		listTitle,
		continuePlayingAfterClose,
		setContinuePlayingAfterClose: persistContinuePlayingAfterClose,
		menuBarShowLyrics,
		setMenuBarShowLyrics: persistMenuBarShowLyrics,
		saved,
		setSaved,
		showQueue,
		setShowQueue,
		playlists,
		activePlaylistId,
		createTitle,
		setCreateTitle,
		pickPlaylistFor,
		setPickPlaylistFor,
		autoCache,
		setAutoCache: persistAutoCache,
		skin,
		setSkin: persistSkin,
		showComments,
		setShowComments,
		downloads,
		downloadTasks,
		downloadQuery,
		setDownloadQuery,
		account,
		favorites,
		collections,
		watchLaterCount,
		loginBusy,
		loginMessage,
		current,
		visiblePages,
		coverImage,
		refreshPlaylists,
		openFavorite,
		openCollection,
		openWatchLater,
		openPlaylist,
		closePlayer,
		openPlayer,
		startPlay,
		submitSearch,
		openHit,
		exportCached,
		logout,
		connectBili,
		createLocalPlaylist,
		addTrackToPlaylist,
		deletePlaylist,
		openDownloads,
		cycleSleep,
	}
}

type AppModel = ReturnType<typeof useAppModel>

const AppContext = createContext<AppModel | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
	const value = useAppModel()
	return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
	const ctx = useContext(AppContext)
	if (!ctx) throw new Error('useApp 必须在 AppProvider 内使用')
	return ctx
}
