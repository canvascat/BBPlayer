import type { AmllLyricLine } from '@bbplayer/core'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

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
		<div className='flex h-full flex-col justify-center bg-linear-to-b from-zinc-800 to-zinc-950 px-4.5 pt-7 pb-3.5 [-webkit-app-region:drag]'>
			<button
				className='cursor-pointer border-0 bg-transparent p-0 text-left text-inherit [-webkit-app-region:no-drag]'
				type='button'
				onClick={() => setExpanded((value) => !value)}
			>
				<div className='line-clamp-2 text-[22px] leading-snug font-semibold'>
					{line}
				</div>
				{payload.artist && (
					<div className='text-muted-foreground mt-2 text-[13px]'>
						{payload.artist}
					</div>
				)}
			</button>
			{expanded && (
				<div className='mt-3.5 flex gap-2 [-webkit-app-region:no-drag]'>
					<Button
						type='button'
						size='sm'
						variant='secondary'
						onClick={() => sendCommand('prev')}
					>
						上一首
					</Button>
					<Button
						type='button'
						size='sm'
						onClick={() => sendCommand('playpause')}
					>
						{payload.playing ? '暂停' : '播放'}
					</Button>
					<Button
						type='button'
						size='sm'
						variant='secondary'
						onClick={() => sendCommand('next')}
					>
						下一首
					</Button>
				</div>
			)}
		</div>
	)
}
