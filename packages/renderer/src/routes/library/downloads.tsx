import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { useApp } from '@/app-context'
import { LibraryTrackList } from '@/components/library-track-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pageTitleClass } from '@/cover-ui'

export const Route = createFileRoute('/library/downloads')({
	component: DownloadsPage,
})

function DownloadsPage() {
	const { downloads, exportCached } = useApp()
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
			<LibraryTrackList
				tracks={tracks}
				statusLabel={() => '已缓存'}
			/>
		</>
	)
}
