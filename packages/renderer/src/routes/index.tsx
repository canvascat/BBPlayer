import { createFileRoute } from '@tanstack/react-router'
import { MusicIcon } from 'lucide-react'

import { useApp } from '@/app-context'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	CoverFace,
	CoverMeta,
	coverButtonClass,
	coverGridClass,
	greeting,
	OverflowText,
	pageTitleClass,
	stripHtml,
} from '@/cover-ui'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
	component: HomePage,
})

function HomePage() {
	const {
		account,
		current,
		player,
		openPlayer,
		submitSearch,
		hits,
		hitsTitle,
		openHit,
	} = useApp()

	return (
		<>
			<div>
				<h1 className={pageTitleClass}>
					{account ? `${greeting()}，${account.name}` : greeting()}
				</h1>
				<p className='text-muted-foreground mt-6 text-sm'>
					空格播放 · 左右切歌 · ⌘L 聚焦搜索
				</p>
			</div>
			<div className='grid grid-cols-1 gap-4 min-[980px]:grid-cols-2'>
				<Card className='min-h-[151px] justify-between gap-2 rounded-lg [--card-spacing:1.5rem]'>
					<CardHeader>
						<CardTitle>快速开始</CardTitle>
						<CardDescription>
							粘贴完整链接，或直接输入作品标题。
						</CardDescription>
					</CardHeader>
					<CardContent className='flex flex-wrap gap-2'>
						<Button
							type='button'
							size='sm'
							variant='secondary'
							onClick={() => void submitSearch('洛天依')}
						>
							洛天依
						</Button>
						<Button
							type='button'
							size='sm'
							variant='secondary'
							onClick={() => void submitSearch('Never Gonna Give You Up')}
						>
							Never Gonna Give You Up
						</Button>
					</CardContent>
				</Card>
				<Card
					className={cn(
						'min-h-[151px] rounded-lg [--card-spacing:1.5rem]',
						current && 'flex-row items-center',
					)}
				>
					{current ? (
						<CardContent className='flex min-w-0 flex-1 items-center gap-4'>
							{current.artwork ? (
								<img
									src={current.artwork}
									alt=''
									className='size-24 shrink-0 rounded-xl object-cover'
								/>
							) : (
								<div className='bg-muted text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-xl'>
									<MusicIcon />
								</div>
							)}
							<div className='flex min-w-0 flex-1 flex-col gap-2'>
								<div className='text-muted-foreground text-xs'>
									队列 {player.queue.length} 首
								</div>
								<OverflowText
									className='text-base'
									text={current.title}
								/>
								<OverflowText
									className='text-muted-foreground'
									text={current.artist}
								/>
								<div className='flex flex-wrap gap-2'>
									<Button
										type='button'
										size='sm'
										variant='default'
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
						<CardHeader>
							<CardTitle>尚未播放</CardTitle>
							<CardDescription>
								{player.queue.length
									? '上次队列还在，按空格或播放即可续播。'
									: '搜索后点进分 P 即可开播。'}
							</CardDescription>
						</CardHeader>
					)}
				</Card>
			</div>
			{player.error && <p className='text-destructive mt-3'>{player.error}</p>}
			{hits.length > 0 ? (
				<div className='flex flex-col gap-3'>
					<div className='text-base font-normal'>{hitsTitle || '搜索结果'}</div>
					<div className={coverGridClass}>
						{hits.map((hit) => (
							<Button
								className={coverButtonClass}
								key={hit.bvid}
								type='button'
								variant='ghost'
								onClick={() => openHit(hit)}
							>
								<CoverFace src={hit.pic} />
								<CoverMeta
									title={stripHtml(hit.title)}
									subtitle={`${hit.author} · ${hit.duration}`}
								/>
							</Button>
						))}
					</div>
				</div>
			) : null}
			{player.queue.length > 0 && (
				<div className='flex flex-col gap-6'>
					<div className='text-base font-normal'>最近播放</div>
					<div className={coverGridClass}>
						{player.queue.slice(0, 5).map((track, i) => (
							<Button
								className={coverButtonClass}
								key={`${track.id}-${i}`}
								type='button'
								variant='ghost'
								onClick={() => {
									void player.playTrack(player.queue, i)
								}}
							>
								<CoverFace
									src={track.artwork}
									fallback='♪'
								/>
								<CoverMeta
									title={track.title}
									subtitle={track.artist}
									active={current?.id === track.id}
								/>
							</Button>
						))}
					</div>
				</div>
			)}
		</>
	)
}
