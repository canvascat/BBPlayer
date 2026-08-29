import { createFileRoute } from '@tanstack/react-router'

import { useApp } from '@/app-context'
import { Button } from '@/components/ui/button'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import {
	CoverFace,
	CoverMeta,
	coverButtonClass,
	coverGridClass,
	pageTitleClass,
	stripHtml,
} from '@/cover-ui'
import { cn } from '@/lib/utils'
import { formatMs } from '@/playback'
import { trpcClient } from '@/trpc'

export const Route = createFileRoute('/library')({
	component: LibraryPage,
})

function LibraryPage() {
	const {
		account,
		listTitle,
		openWatchLater,
		watchLaterCount,
		favorites,
		openFavorite,
		collections,
		openCollection,
		openDownloads,
		downloads,
		createTitle,
		setCreateTitle,
		createLocalPlaylist,
		playlists,
		openPlaylist,
		refreshPlaylists,
		deletePlaylist,
		activePlaylistId,
		downloadQuery,
		setDownloadQuery,
		exportCached,
		hits,
		openHit,
		visiblePages,
		current,
		startPlay,
		player,
		setPickPlaylistFor,
		downloadTasks,
		pages,
	} = useApp()

	return (
		<>
			<h1 className={pageTitleClass}>音乐库</h1>
			<p className='text-muted-foreground'>
				{listTitle || '本地歌单、收藏夹和合集会显示在这里。'}
			</p>
			{account && (
				<>
					<div className='text-base font-normal'>B 站</div>
					<div className={coverGridClass}>
						<Button
							className={coverButtonClass}
							type='button'
							variant='ghost'
							onClick={() => void openWatchLater()}
						>
							<CoverFace fallback='稍' />
							<CoverMeta
								title='稍后再看'
								subtitle={`${watchLaterCount} 首`}
							/>
						</Button>
						{favorites.map((folder) => (
							<Button
								className={coverButtonClass}
								key={`fav-${folder.id}`}
								type='button'
								variant='ghost'
								onClick={() => void openFavorite(folder.id)}
							>
								<CoverFace
									src={folder.coverUrl}
									fallback='藏'
								/>
								<CoverMeta
									title={folder.title}
									subtitle={`${folder.itemCount} 首`}
								/>
							</Button>
						))}
						{collections.map((folder) => (
							<Button
								className={coverButtonClass}
								key={`col-${folder.id}`}
								type='button'
								variant='ghost'
								onClick={() => void openCollection(folder.id)}
							>
								<CoverFace
									src={folder.coverUrl}
									fallback='集'
								/>
								<CoverMeta
									title={folder.title}
									subtitle={`${folder.itemCount} 首`}
								/>
							</Button>
						))}
					</div>
				</>
			)}
			<div className='text-base font-normal'>本地歌单</div>
			<div className={coverGridClass}>
				<Button
					className={coverButtonClass}
					type='button'
					variant='ghost'
					onClick={openDownloads}
				>
					<CoverFace fallback='下' />
					<CoverMeta
						title='已下载'
						subtitle={`${downloads.length} 首`}
					/>
				</Button>
			</div>
			<div className='flex items-center gap-2'>
				<InputGroup className='flex-1'>
					<InputGroupInput
						value={createTitle}
						placeholder='新播放列表标题'
						onChange={(e) => setCreateTitle(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') void createLocalPlaylist()
						}}
					/>
				</InputGroup>
				<Button
					type='button'
					onClick={() => void createLocalPlaylist()}
				>
					创建播放列表
				</Button>
			</div>
			{playlists.length > 0 && (
				<div className={coverGridClass}>
					{playlists.map((playlist) => (
						<ContextMenu key={playlist.id}>
							<ContextMenuTrigger>
								<Button
									className={coverButtonClass}
									type='button'
									variant='ghost'
									onClick={() => void openPlaylist(playlist.id)}
								>
									<CoverFace
										src={playlist.coverUrl}
										fallback={playlist.title.slice(0, 1)}
									/>
									<CoverMeta
										title={playlist.title}
										subtitle={`${playlist.itemCount} 首`}
										active={activePlaylistId === playlist.id}
									/>
								</Button>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuGroup>
									<ContextMenuItem
										variant='destructive'
										onClick={() => void deletePlaylist(playlist.id)}
									>
										删除
									</ContextMenuItem>
								</ContextMenuGroup>
							</ContextMenuContent>
						</ContextMenu>
					))}
				</div>
			)}
			{listTitle === '已下载' && (
				<div className='flex flex-wrap items-center gap-2'>
					<Input
						value={downloadQuery}
						placeholder='搜索已下载歌曲'
						onChange={(e) => setDownloadQuery(e.target.value)}
					/>
					<Button
						type='button'
						variant='secondary'
						onClick={() => void exportCached()}
					>
						导出
					</Button>
				</div>
			)}
			{hits.length > 0 && (
				<div className={coverGridClass}>
					{hits.map((hit) => (
						<Button
							className={coverButtonClass}
							key={hit.bvid}
							type='button'
							variant='ghost'
							onClick={() => void openHit(hit)}
						>
							<CoverFace src={hit.pic} />
							<CoverMeta
								title={stripHtml(hit.title)}
								subtitle={`${hit.author} · ${hit.duration}`}
							/>
						</Button>
					))}
				</div>
			)}
			{visiblePages.length > 0 && (
				<div className='flex flex-col gap-1'>
					{visiblePages.map((page, i) => (
						<ContextMenu key={page.id}>
							<ContextMenuTrigger>
								<Button
									className={cn(
										'grid h-auto w-full grid-cols-[28px_48px_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 whitespace-normal',
										current?.id === page.id && 'bg-muted',
									)}
									type='button'
									variant='ghost'
									onClick={() => startPlay(visiblePages, i)}
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
										{downloadTasks[page.id] === 'completed'
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
									<ContextMenuItem onClick={() => startPlay(visiblePages, i)}>
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
										<ContextMenuItem
											onClick={() => void exportCached([page.id])}
										>
											导出
										</ContextMenuItem>
									)}
									{activePlaylistId && (
										<ContextMenuItem
											onClick={() => {
												void trpcClient.library.removeTrack
													.mutate({
														playlistId: activePlaylistId,
														trackId: page.id,
													})
													.then(() => openPlaylist(activePlaylistId))
													.then(refreshPlaylists)
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
			)}
			{!hits.length && !pages.length && playlists.length === 0 && !account && (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>还没有内容</EmptyTitle>
						<EmptyDescription>
							创建本地歌单，或用侧栏搜索试试。
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			{player.error && <p className='text-destructive mt-3'>{player.error}</p>}
		</>
	)
}
