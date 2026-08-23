import type { AmllLyricLine } from '@bbplayer/core'
import { useEffect, useState } from 'react'

import { currentLyricText } from './lyric-text'
import { listen, trpc } from './trpc'

interface LyricsPayload {
	lyrics: AmllLyricLine[]
	currentTime: number
	playing: boolean
	title: string
	artist: string
}

function sendCommand(command: string) {
	void trpc.player.sendCommand.mutate({ command })
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
		void trpc.lyrics.current.query().then((current) => {
			if (current) setPayload(current as LyricsPayload)
		})
		return listen(trpc.lyrics.updates.subscribe, (next) => {
			if (next) setPayload(next as LyricsPayload)
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
						onClick={() => sendCommand('prev')}
					>
						上一首
					</button>
					<button
						type='button'
						onClick={() => sendCommand('playpause')}
					>
						{payload.playing ? '暂停' : '播放'}
					</button>
					<button
						type='button'
						onClick={() => sendCommand('next')}
					>
						下一首
					</button>
				</div>
			)}
		</div>
	)
}
