import type { AmllLyricLine } from '@bbplayer/core'
import { useEffect, useState } from 'react'

import { currentLyricText } from './lyric-text'

interface LyricsPayload {
	lyrics: AmllLyricLine[]
	currentTime: number
	playing: boolean
	title: string
	artist: string
}

export default function LyricsApp() {
	const [payload, setPayload] = useState<LyricsPayload>({
		lyrics: [],
		currentTime: 0,
		playing: false,
		title: '',
		artist: '',
	})
	const [expanded, setExpanded] = useState(false)

	useEffect(() => {
		void window.bbplayer.getCurrentLyrics().then((current) => {
			if (current) setPayload(current as LyricsPayload)
		})
		return window.bbplayer.onLyricsUpdate((next) => {
			setPayload(next as LyricsPayload)
		})
	}, [])

	const line =
		currentLyricText(payload.lyrics, payload.currentTime) ||
		payload.title ||
		'暂无歌词'

	return (
		<div className={`lyrics-app ${expanded ? 'expanded' : ''}`}>
			<button
				className='lyric-hit'
				type='button'
				onClick={() => setExpanded((value) => !value)}
			>
				<div className='lyric-line'>{line}</div>
				{payload.artist && <div className='lyric-sub'>{payload.artist}</div>}
			</button>
			{expanded && (
				<div className='lyric-controls'>
					<button
						type='button'
						onClick={() => window.bbplayer.sendCommand('prev')}
					>
						上一首
					</button>
					<button
						type='button'
						onClick={() => window.bbplayer.sendCommand('playpause')}
					>
						{payload.playing ? '暂停' : '播放'}
					</button>
					<button
						type='button'
						onClick={() => window.bbplayer.sendCommand('next')}
					>
						下一首
					</button>
				</div>
			)}
		</div>
	)
}
