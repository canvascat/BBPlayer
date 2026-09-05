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
	const [hitsTitle, setHitsTitle] = useState('')
	const [continuePlayingAfterClose, setContinuePlayingAfterClose] =
		useState(true)
	const [menuBarShowLyrics, setMenuBarShowLyrics] = useState(false)
	const [saved, setSaved] = useState('')
	const [showQueue, setShowQueue] = useState(false)
	const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
	const [libraryTick, setLibraryTick] = useState(0)
	const [createTitle, setCreateTitle] = useState('')
	const [pickPlaylistFor, setPickPlaylistFor] = useState<TrackItem | null>(null)
	const [autoCache, setAutoCache] = useState(true)
	const [filterNonSongs, setFilterNonSongs] = useState(false)
	const [lyricSource, setLyricSource] = useState<
		'auto' | 'netease' | 'qqmusic' | 'kugou'
	>('netease')
	const [musicAiBaseUrl, setMusicAiBaseUrl] = useState(
		'https://open.bigmodel.cn/api/paas/v4/',
	)
	const [musicAiApiKey, setMusicAiApiKey] = useState('')
	const [musicAiModel, setMusicAiModel] = useState('glm-4-flash')
	const [skin, setSkin] = useState<SkinTheme | null>(null)
	const [showComments, setShowComments] = useState(false)
	const [downloads, setDownloads] = useState<TrackItem[]>([])
	const [downloadTasks, setDownloadTasks] = useState<Record<string, string>>({})
	const [account, setAccount] = useState<AccountInfo | null>(null)
	const [favorites, setFavorites] = useState<RemoteFolder[]>([])
	const [collections, setCollections] = useState<RemoteFolder[]>([])
	const [watchLaterCount, setWatchLaterCount] = useState(0)
	const [loginBusy, setLoginBusy] = useState(false)
	const [loginMessage, setLoginMessage] = useState('')
	const [logLevel, setLogLevelState] = useState<
		'error' | 'warn' | 'info' | 'debug'
	>('warn')
	const [logPath, setLogPath] = useState('')

	const current = player.current
	const isPlayer = pathname === '/player'
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

	const bumpLibrary = () => setLibraryTick((n) => n + 1)

	const openFavorite = (id: string) => {
		void navigate({ to: '/library/favorites/$id', params: { id } })
	}

	const openCollection = (id: string) => {
		void navigate({ to: '/library/collections/$id', params: { id } })
	}

	const openWatchLater = () => {
		void navigate({ to: '/library/watch-later' })
	}

	const openPlaylist = (id: string) => {
		void navigate({ to: '/library/playlists/$id', params: { id } })
	}

	useEffect(() => {
		void trpcClient.settings.get.query().then((settings) => {
			setContinuePlayingAfterClose(settings.continuePlayingAfterClose)
			setMenuBarShowLyrics(settings.menuBarShowLyrics)
			setAutoCache(settings.autoCache ?? true)
			setFilterNonSongs(settings.filterNonSongs ?? false)
			setLyricSource(settings.lyricSource ?? 'netease')
			setMusicAiBaseUrl(
				settings.musicAiBaseUrl ?? 'https://open.bigmodel.cn/api/paas/v4/',
			)
			setMusicAiApiKey(settings.musicAiApiKey ?? '')
			setMusicAiModel(settings.musicAiModel ?? 'glm-4-flash')
			setSkin(settings.skin ?? null)
			setAccount(settings.account)
			setLogLevelState(settings.logLevel ?? 'warn')
			setLogPath(settings.logPath ?? '')
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
		})
	}, [])

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

	type MatchStrategy = {
		type: string
		bvid?: string
		query?: string
		id?: string
		mid?: string
	}

	const applySearchOrUploaderHits = async (
		strategy: MatchStrategy,
		q: string,
	) => {
		if (
			strategy.type === 'SEARCH' ||
			strategy.type === 'B23_RESOLVE_ERROR' ||
			strategy.type === 'B23_NO_BVID_ERROR' ||
			strategy.type === 'AV_PARSE_ERROR'
		) {
			const keyword = strategy.query || q
			const result = await trpcClient.bili.search.query({ keyword })
			setHits(result)
			setHitsTitle(`搜索：${keyword}`)
			return true
		}
		if (strategy.type === 'UPLOADER' && strategy.mid) {
			const result = await trpcClient.bili.uploader.query({
				mid: strategy.mid,
			})
			setHits(result.videos)
			setHitsTitle(result.title)
			return true
		}
		return false
	}

	const submitSearch = async (raw?: string) => {
		const q = (raw ?? query).trim()
		if (!q) return
		if (raw) setQuery(raw)
		player.setError('')
		setHits([])
		setHitsTitle('')
		const matched = await trpcClient.player.matchSearch.query({ query: q })
		if (matched.error) player.setError(matched.error)
		const strategy = matched.strategy as MatchStrategy
		try {
			if (strategy.type === 'BVID' && strategy.bvid) {
				void navigate({
					to: '/library/multipage/$bvid',
					params: { bvid: strategy.bvid },
				})
				return
			}
			if (await applySearchOrUploaderHits(strategy, q)) {
				void navigate({ to: '/' })
				return
			}
			if (strategy.type === 'FAVORITE' && strategy.id) {
				openFavorite(strategy.id)
				return
			}
			if (strategy.type === 'COLLECTION' && strategy.id) {
				openCollection(strategy.id)
				return
			}
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	const openHit = (hit: SearchHit) => {
		void navigate({
			to: '/library/multipage/$bvid',
			params: { bvid: hit.bvid },
		})
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

	const persistFilterNonSongs = (value: boolean) => {
		setFilterNonSongs(value)
		void (async () => {
			await trpcClient.settings.set.mutate({ filterNonSongs: value })
			const session = await trpcClient.session.get.query()
			player.applySessionQueue({
				queue: session?.queue ?? [],
				index: session?.index ?? 0,
			})
			await refreshPlaylists()
			bumpLibrary()
			await loadRemoteLibrary()
			setDownloads(await trpcClient.downloads.list.query())
			const q = query.trim()
			if (!q) return
			try {
				const matched = await trpcClient.player.matchSearch.query({
					query: q,
				})
				if (matched.error) player.setError(matched.error)
				await applySearchOrUploaderHits(matched.strategy, q)
			} catch (err) {
				player.setError(err instanceof Error ? err.message : String(err))
			}
		})()
	}

	const persistLyricSource = (
		value: 'auto' | 'netease' | 'qqmusic' | 'kugou',
	) => {
		setLyricSource(value)
		void trpcClient.settings.set.mutate({ lyricSource: value })
	}

	const persistMusicAiBaseUrl = (value: string) => {
		setMusicAiBaseUrl(value)
		void trpcClient.settings.set.mutate({ musicAiBaseUrl: value })
	}

	const persistMusicAiApiKey = (value: string) => {
		setMusicAiApiKey(value)
		void trpcClient.settings.set.mutate({ musicAiApiKey: value })
	}

	const persistMusicAiModel = (value: string) => {
		setMusicAiModel(value)
		void trpcClient.settings.set.mutate({ musicAiModel: value })
	}

	const persistSkin = (value: SkinTheme | null) => {
		setSkin(value)
		void trpcClient.settings.set.mutate({ skin: value })
	}

	const persistLogLevel = (value: 'error' | 'warn' | 'info' | 'debug') => {
		setLogLevelState(value)
		void trpcClient.settings.set.mutate({ logLevel: value })
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
		bumpLibrary()
		openPlaylist(playlist.id)
	}

	const addTrackToPlaylist = async (playlistId: string, track: TrackItem) => {
		await trpcClient.library.addTracks.mutate({ playlistId, tracks: [track] })
		setPickPlaylistFor(null)
		await refreshPlaylists()
		bumpLibrary()
	}

	const deletePlaylist = async (id: string) => {
		const playlist = playlists.find((item) => item.id === id)
		if (!window.confirm(`删除「${playlist?.title ?? ''}」？`)) return
		await trpcClient.library.delete.mutate({ id })
		await refreshPlaylists()
		bumpLibrary()
		if (pathname === `/library/playlists/${id}`) {
			void navigate({ to: '/library' })
		}
	}

	const openDownloads = () => {
		void navigate({ to: '/library/downloads' })
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
		hitsTitle,
		continuePlayingAfterClose,
		setContinuePlayingAfterClose: persistContinuePlayingAfterClose,
		menuBarShowLyrics,
		setMenuBarShowLyrics: persistMenuBarShowLyrics,
		saved,
		setSaved,
		showQueue,
		setShowQueue,
		playlists,
		libraryTick,
		createTitle,
		setCreateTitle,
		pickPlaylistFor,
		setPickPlaylistFor,
		autoCache,
		setAutoCache: persistAutoCache,
		filterNonSongs,
		setFilterNonSongs: persistFilterNonSongs,
		lyricSource,
		setLyricSource: persistLyricSource,
		musicAiBaseUrl,
		setMusicAiBaseUrl: persistMusicAiBaseUrl,
		musicAiApiKey,
		setMusicAiApiKey: persistMusicAiApiKey,
		musicAiModel,
		setMusicAiModel: persistMusicAiModel,
		skin,
		setSkin: persistSkin,
		showComments,
		setShowComments,
		downloads,
		downloadTasks,
		account,
		favorites,
		collections,
		watchLaterCount,
		loginBusy,
		loginMessage,
		logLevel,
		logPath,
		setLogLevel: persistLogLevel,
		current,
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
