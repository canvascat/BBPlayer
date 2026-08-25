import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

import { listen, trpc } from './trpc'

interface MiniState {
	title: string
	artist: string
	playing: boolean
	lyric: string
	artwork: string
}

function sendCommand(command: string) {
	void trpc.player.sendCommand.mutate({ command })
}

export default function MiniApp() {
	const [state, setState] = useState<MiniState>({
		title: '',
		artist: '',
		playing: false,
		lyric: '',
		artwork: '',
	})

	useEffect(() => {
		void trpc.player.snapshot.query().then(setState)
		return listen(trpc.lyrics.meta.subscribe, setState)
	}, [])

	return (
		<div className='grid h-full grid-cols-[64px_1fr_auto] items-center gap-2.5 bg-linear-to-b from-zinc-800 to-zinc-950 px-3 pt-5.5 pb-2.5 [-webkit-app-region:drag]'>
			<Button
				className='size-14 overflow-hidden rounded-lg p-0 [-webkit-app-region:no-drag]'
				type='button'
				variant='secondary'
				title='打开播放页'
				onDoubleClick={() => sendCommand('open-player')}
			>
				{state.artwork ? (
					<img
						src={state.artwork}
						alt=''
						className='size-full object-cover'
					/>
				) : (
					<span />
				)}
			</Button>
			<div className='min-w-0'>
				<div className='truncate text-sm font-semibold'>
					{state.title || '未在播放'}
				</div>
				<div className='text-muted-foreground mt-1 truncate text-xs'>
					{state.artist || 'BBPlayer'}
				</div>
			</div>
			<div className='flex gap-1.5 [-webkit-app-region:no-drag]'>
				<Button
					type='button'
					size='xs'
					variant='secondary'
					onClick={() => sendCommand('prev')}
				>
					上一首
				</Button>
				<Button
					type='button'
					size='xs'
					onClick={() => sendCommand('playpause')}
				>
					{state.playing ? '暂停' : '播放'}
				</Button>
				<Button
					type='button'
					size='xs'
					variant='secondary'
					onClick={() => sendCommand('next')}
				>
					下一首
				</Button>
			</div>
		</div>
	)
}
