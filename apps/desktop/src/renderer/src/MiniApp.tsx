import { useEffect, useState } from 'react'

interface MiniState {
	title: string
	artist: string
	playing: boolean
	lyric: string
	artwork: string
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
		void window.bbplayer.getSnapshot().then(setState)
		return window.bbplayer.onLyricsMeta((next) => {
			setState(next)
		})
	}, [])

	return (
		<div className='mini-app'>
			<button
				className='mini-cover'
				type='button'
				title='打开播放页'
				onDoubleClick={() => window.bbplayer.sendCommand('open-player')}
			>
				{state.artwork ? (
					<img
						src={state.artwork}
						alt=''
					/>
				) : (
					<span />
				)}
			</button>
			<div className='mini-meta'>
				<div className='mini-title'>{state.title || '未在播放'}</div>
				<div className='mini-sub'>{state.artist || 'BBPlayer'}</div>
			</div>
			<div className='mini-controls'>
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
					{state.playing ? '暂停' : '播放'}
				</button>
				<button
					type='button'
					onClick={() => window.bbplayer.sendCommand('next')}
				>
					下一首
				</button>
			</div>
		</div>
	)
}
