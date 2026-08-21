import type { AmllLyricLine } from '@bbplayer/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import { currentLyricText } from './lyric-text'
import {
	neighborIndex,
	nextRepeatMode,
	RepeatMode,
	shuffleOrder,
	type RepeatMode as RepeatModeValue,
	type TrackItem,
} from './playback'
import { trpc } from './trpc'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function usePlayback() {
	const audioRef = useRef<HTMLAudioElement>(null)
	const queueRef = useRef<TrackItem[]>([])
	const indexRef = useRef(0)
	const repeatRef = useRef<RepeatModeValue>(RepeatMode.OFF)
	const shuffleRef = useRef(false)
	const orderRef = useRef<number[] | null>(null)
	const skipRef = useRef<(delta: number) => void>(() => undefined)
	const toggleRef = useRef<() => void>(() => undefined)
	const restoreSeekRef = useRef(0)
	const playTrackRef = useRef<
		(list: TrackItem[], start: number, seekMs?: number) => Promise<void>
	>(async () => undefined)

	const [queue, setQueue] = useState<TrackItem[]>([])
	const [index, setIndex] = useState(0)
	const [playing, setPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [lyrics, setLyrics] = useState<AmllLyricLine[]>([])
	const [status, setStatus] = useState('')
	const [error, setError] = useState('')
	const [repeatMode, setRepeatMode] = useState<RepeatModeValue>(RepeatMode.OFF)
	const [shuffle, setShuffle] = useState(false)
	const [playbackRate, setPlaybackRate] = useState(1)
	const [sleepUntil, setSleepUntil] = useState<number | null>(null)
	const [sleepLeft, setSleepLeft] = useState(0)

	const current = queue[index]
	queueRef.current = queue
	indexRef.current = index
	repeatRef.current = repeatMode
	shuffleRef.current = shuffle

	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		const onTime = () => {
			setCurrentTime(Math.round(audio.currentTime * 1000))
			setDuration(audio.duration * 1000 || 0)
		}
		const onPlay = () => setPlaying(true)
		const onPause = () => setPlaying(false)
		const onEnded = () => {
			if (repeatRef.current === RepeatMode.TRACK) {
				audio.currentTime = 0
				void audio.play()
				return
			}
			skipRef.current(1)
		}
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
	}, [])

	const playTrack = useCallback(
		async (list: TrackItem[], start: number, seekMs = 0) => {
			const track = list[start]
			if (!track) return
			setError('')
			setQueue(list)
			setIndex(start)
			setStatus('正在获取音频…')
			try {
				const resolved = await window.bbplayer.resolvePlay(track)
				const audio = audioRef.current
				if (!audio) return
				audio.src = resolved.playUrl
				audio.playbackRate = playbackRate
				setLyrics(resolved.lyrics ?? [])
				if (seekMs > 0) {
					const onLoaded = () => {
						audio.currentTime = seekMs / 1000
						audio.removeEventListener('loadedmetadata', onLoaded)
					}
					audio.addEventListener('loadedmetadata', onLoaded)
				}
				await audio.play()
				const bits = [
					resolved.cached ? '已缓存' : '',
					resolved.lyricSource === 'qqmusic'
						? '歌词来自 QQ 音乐'
						: resolved.lyricSource === 'kugou'
							? '歌词来自酷狗'
							: '',
					resolved.lyrics?.length ? '' : '暂无匹配歌词',
				].filter(Boolean)
				setStatus(bits.join(' · '))
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err))
				setStatus('')
			}
		},
		[playbackRate],
	)

	const skip = useCallback((delta: number) => {
		const next = neighborIndex(
			queueRef.current.length,
			indexRef.current,
			delta,
			repeatRef.current,
			shuffleRef.current ? orderRef.current : null,
		)
		if (next === null) {
			audioRef.current?.pause()
			return
		}
		void playTrackRef.current(queueRef.current, next)
	}, [])

	const toggle = useCallback(() => {
		const audio = audioRef.current
		if (!audio) return
		if (!audio.src) {
			const track = queueRef.current[indexRef.current]
			if (track) {
				void playTrackRef.current(
					queueRef.current,
					indexRef.current,
					restoreSeekRef.current,
				)
			}
			return
		}
		if (audio.paused) void audio.play()
		else audio.pause()
	}, [])

	playTrackRef.current = playTrack
	skipRef.current = skip
	toggleRef.current = toggle

	const cycleRepeat = useCallback(() => {
		setRepeatMode((mode) => nextRepeatMode(mode))
	}, [])

	const setRepeat = useCallback((mode: RepeatModeValue) => {
		setRepeatMode(mode)
	}, [])

	const toggleShuffle = useCallback(() => {
		setShuffle((enabled) => {
			const next = !enabled
			orderRef.current = next
				? shuffleOrder(queueRef.current.length, indexRef.current)
				: null
			return next
		})
	}, [])

	useEffect(() => {
		if (shuffle) {
			orderRef.current = shuffleOrder(queue.length, indexRef.current)
		} else {
			orderRef.current = null
		}
	}, [queue, shuffle])

	const cycleSpeed = useCallback(() => {
		setPlaybackRate((rate) => {
			const i = SPEEDS.indexOf(rate)
			return SPEEDS[(i + 1) % SPEEDS.length]
		})
	}, [])

	useEffect(() => {
		if (audioRef.current) audioRef.current.playbackRate = playbackRate
	}, [playbackRate])

	const seek = useCallback((value: number) => {
		setCurrentTime(value)
		if (audioRef.current) audioRef.current.currentTime = value / 1000
	}, [])

	const seekBy = useCallback((deltaMs: number) => {
		const audio = audioRef.current
		if (!audio?.src) return
		const next = Math.max(0, audio.currentTime + deltaMs / 1000)
		audio.currentTime = next
		setCurrentTime(Math.round(next * 1000))
	}, [])

	const playNext = useCallback((track: TrackItem) => {
		setQueue((list) => {
			if (list.length === 0) {
				void playTrackRef.current([track], 0)
				return [track]
			}
			const copy = [...list]
			copy.splice(indexRef.current + 1, 0, track)
			return copy
		})
	}, [])

	const addToEnd = useCallback((track: TrackItem) => {
		setQueue((list) => {
			if (list.length === 0) {
				void playTrackRef.current([track], 0)
				return [track]
			}
			return [...list, track]
		})
	}, [])

	const removeFromQueue = useCallback((id: string) => {
		const currentId = queueRef.current[indexRef.current]?.id
		const next = queueRef.current.filter((item) => item.id !== id)
		if (id === currentId) {
			const fallback = Math.min(indexRef.current, Math.max(0, next.length - 1))
			if (next.length === 0) {
				audioRef.current?.pause()
				if (audioRef.current) audioRef.current.src = ''
				setQueue([])
				setIndex(0)
				setLyrics([])
				return
			}
			void playTrackRef.current(next, fallback)
			return
		}
		const newIndex = next.findIndex((item) => item.id === currentId)
		setQueue(next)
		setIndex(newIndex < 0 ? 0 : newIndex)
	}, [])

	const startSleep = useCallback((minutes: number) => {
		if (minutes <= 0) {
			setSleepUntil(null)
			setSleepLeft(0)
			return
		}
		setSleepUntil(Date.now() + minutes * 60 * 1000)
	}, [])

	useEffect(() => {
		if (!sleepUntil) return
		const tick = () => {
			const left = Math.max(0, sleepUntil - Date.now())
			setSleepLeft(left)
			if (left <= 0) {
				audioRef.current?.pause()
				setSleepUntil(null)
			}
		}
		tick()
		const timer = window.setInterval(tick, 1000)
		return () => window.clearInterval(timer)
	}, [sleepUntil])

	useEffect(() => {
		void trpc.session.get.query().then((session) => {
			if (!session?.queue?.length) return
			setQueue(session.queue)
			setIndex(session.index)
			setRepeatMode(session.repeatMode)
			setShuffle(session.shuffle)
			setPlaybackRate(session.playbackRate || 1)
			restoreSeekRef.current = session.positionMs || 0
			setCurrentTime(session.positionMs || 0)
		})
	}, [])

	useEffect(() => {
		const handle = window.setTimeout(() => {
			void trpc.session.set.mutate({
				queue,
				index,
				positionMs: currentTime,
				repeatMode,
				shuffle,
				playbackRate,
			})
		}, 800)
		return () => window.clearTimeout(handle)
	}, [currentTime, index, playbackRate, queue, repeatMode, shuffle])

	const lyricLine = currentLyricText(lyrics, currentTime)

	useEffect(() => {
		window.bbplayer.reportState({
			title: current?.title ?? '',
			artist: current?.artist ?? '',
			playing,
			lyric: lyricLine,
			artwork: current?.artwork ?? '',
		})
	}, [current, lyricLine, playing])

	useEffect(() => {
		const handle = window.setTimeout(() => {
			window.bbplayer.pushLyrics({
				lyrics,
				currentTime,
				playing,
				title: current?.title ?? '',
				artist: current?.artist ?? '',
			})
		}, 180)
		return () => window.clearTimeout(handle)
	}, [current, currentTime, lyrics, playing])

	useEffect(() => {
		if (!('mediaSession' in navigator)) return
		if (!current) {
			navigator.mediaSession.metadata = null
			return
		}
		navigator.mediaSession.metadata = new MediaMetadata({
			title: current.title,
			artist: current.artist,
			artwork: current.artwork
				? [{ src: current.artwork, sizes: '512x512', type: 'image/jpeg' }]
				: [],
		})
		navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
		try {
			navigator.mediaSession.setPositionState({
				duration: Math.max(duration / 1000, 0),
				position: Math.min(currentTime / 1000, Math.max(duration / 1000, 0)),
				playbackRate,
			})
		} catch {
			// duration 未知时忽略
		}
		navigator.mediaSession.setActionHandler('play', () => toggleRef.current())
		navigator.mediaSession.setActionHandler('pause', () => toggleRef.current())
		navigator.mediaSession.setActionHandler('previoustrack', () =>
			skipRef.current(-1),
		)
		navigator.mediaSession.setActionHandler('nexttrack', () =>
			skipRef.current(1),
		)
		navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-5000))
		navigator.mediaSession.setActionHandler('seekforward', () => seekBy(5000))
	}, [current, currentTime, duration, playbackRate, playing, seekBy])

	return {
		audioRef,
		queue,
		index,
		current,
		playing,
		currentTime,
		duration,
		lyrics,
		status,
		error,
		setError,
		repeatMode,
		shuffle,
		playbackRate,
		sleepLeft,
		lyricLine,
		playTrack,
		skip,
		toggle,
		cycleRepeat,
		setRepeat,
		toggleShuffle,
		cycleSpeed,
		seek,
		seekBy,
		playNext,
		addToEnd,
		removeFromQueue,
		startSleep,
		skipRef,
		toggleRef,
	}
}
