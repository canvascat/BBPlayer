import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { useApp } from '@/app-context'
import { LibraryTrackList } from '@/components/library-track-list'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { pageTitleClass } from '@/cover-ui'
import { trpcClient } from '@/trpc'

export const Route = createFileRoute('/library/downloads')({
	component: DownloadsPage,
})

function DownloadsPage() {
	const { downloads, exportCached, filterNonSongs } = useApp()
	const [query, setQuery] = useState('')
	const q = query.trim().toLowerCase()
	const tracks = useMemo(() => {
		if (!q) return downloads
		return downloads.filter(
			(item) =>
				item.title.toLowerCase().includes(q) ||
				item.artist.toLowerCase().includes(q),
		)
	}, [downloads, q])

	useEffect(() => {
		void trpcClient.downloads.list.query()
	}, [filterNonSongs])

	return (
		<>
			<div className='flex items-center gap-2'>
				<h1 className={pageTitleClass}>已下载</h1>
				<div className='flex-1' />
				<Button
					type='button'
					variant='ghost'
					onClick={() => void exportCached()}
				>
					导出
				</Button>
			</div>
			<Button
				size='sm'
				variant='ghost'
				className='w-fit'
				nativeButton={false}
				render={
					<Link
						from={Route.fullPath}
						to='..'
					/>
				}
			>
				← 返回
			</Button>
			<Input
				value={query}
				placeholder='搜索已下载歌曲'
				onChange={(e) => setQuery(e.target.value)}
			/>
			{tracks.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>没有歌曲</EmptyTitle>
						<EmptyDescription>
							{filterNonSongs ? '已按设置隐藏非歌曲视频' : '这个列表还是空的。'}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<LibraryTrackList
					tracks={tracks}
					statusLabel={() => '已缓存'}
				/>
			)}
		</>
	)
}
