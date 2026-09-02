import { useApp } from '@/app-context'
import { Button } from '@/components/ui/button'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { formatMs, type TrackItem } from '@/playback'
import { trpcClient } from '@/trpc'

export function LibraryTrackList({
	tracks,
	playlistId,
	onRemoved,
	statusLabel,
}: {
	tracks: TrackItem[]
	playlistId?: string
	onRemoved?: () => void
	statusLabel?: (track: TrackItem) => string
}) {
	const {
		current,
		startPlay,
		player,
		setPickPlaylistFor,
		downloadTasks,
		exportCached,
		refreshPlaylists,
	} = useApp()

	return (
		<div className='flex flex-col gap-1'>
			{tracks.map((page, i) => (
				<ContextMenu key={page.id}>
					<ContextMenuTrigger>
						<Button
							className={cn(
								'grid h-auto w-full grid-cols-[28px_48px_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 whitespace-normal',
								current?.id === page.id && 'bg-muted',
							)}
							type='button'
							variant='ghost'
							onClick={() => startPlay(tracks, i)}
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
								{statusLabel
									? statusLabel(page)
									: downloadTasks[page.id] === 'completed'
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
							<ContextMenuItem onClick={() => startPlay(tracks, i)}>
								播放
							</ContextMenuItem>
							<ContextMenuItem onClick={() => player.playNext(page)}>
								下一首播放
							</ContextMenuItem>
							<ContextMenuItem onClick={() => player.addToEnd(page)}>
								加入队列末尾
							</ContextMenuItem>
							<ContextMenuItem onClick={() => setPickPlaylistFor(page)}>
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
								<ContextMenuItem onClick={() => void exportCached([page.id])}>
									导出
								</ContextMenuItem>
							)}
							{playlistId && (
								<ContextMenuItem
									onClick={() => {
										void trpcClient.library.removeTrack
											.mutate({
												playlistId,
												trackId: page.id,
											})
											.then(() => {
												onRemoved?.()
												return refreshPlaylists()
											})
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
	)
}
