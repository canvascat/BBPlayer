import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

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
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import {
	CoverFace,
	CoverMeta,
	coverButtonClass,
	coverGridClass,
} from '@/cover-ui'

export const Route = createFileRoute('/library/_catalog/')({
	component: PlaylistsPage,
})

function PlaylistsPage() {
	const {
		account,
		watchLaterCount,
		playlists,
		createTitle,
		setCreateTitle,
		createLocalPlaylist,
		deletePlaylist,
	} = useApp()
	const [query, setQuery] = useState('')
	const q = query.trim().toLowerCase()
	const filtered = useMemo(() => {
		if (!q) return playlists
		return playlists.filter((playlist) =>
			playlist.title.toLowerCase().includes(q),
		)
	}, [playlists, q])
	const showWatchLater = Boolean(account) && (!q || '稍后再看'.includes(q))
	const count = playlists.length + (account ? 1 : 0)

	return (
		<>
			<div className='flex items-center justify-between'>
				<div className='text-sm font-medium'>播放列表</div>
				<div className='text-muted-foreground text-sm'>{count} 个播放列表</div>
			</div>
			<InputGroup>
				<InputGroupInput
					value={query}
					placeholder='搜索播放列表'
					onChange={(e) => setQuery(e.target.value)}
				/>
			</InputGroup>
			{showWatchLater || filtered.length > 0 ? (
				<div className={coverGridClass}>
					{showWatchLater ? (
						<Button
							className={coverButtonClass}
							variant='ghost'
							nativeButton={false}
							render={<Link to='/library/watch-later' />}
						>
							<CoverFace fallback='稍' />
							<CoverMeta
								title='稍后再看'
								subtitle={`${watchLaterCount} 首`}
							/>
						</Button>
					) : null}
					{filtered.map((playlist) => (
						<ContextMenu key={playlist.id}>
							<ContextMenuTrigger>
								<Button
									className={coverButtonClass}
									variant='ghost'
									nativeButton={false}
									render={
										<Link
											to='/library/playlists/$id'
											params={{ id: playlist.id }}
										/>
									}
								>
									<CoverFace
										src={playlist.coverUrl}
										fallback={playlist.title.slice(0, 1)}
									/>
									<CoverMeta
										title={playlist.title}
										subtitle={`${playlist.itemCount} 首`}
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
			) : (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyTitle>没有播放列表</EmptyTitle>
						<EmptyDescription>创建一个本地歌单开始收听。</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
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
		</>
	)
}
