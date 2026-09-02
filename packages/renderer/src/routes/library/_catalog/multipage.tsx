import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useApp, type SearchHit } from '@/app-context'
import { LibraryLoginGate } from '@/components/library-login-gate'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import {
	CoverFace,
	CoverMeta,
	coverButtonClass,
	coverGridClass,
} from '@/cover-ui'
import { multipageFavorite } from '@/library-nav'
import { trpcClient } from '@/trpc'

export const Route = createFileRoute('/library/_catalog/multipage')({
	component: MultipagePage,
})

function MultipagePage() {
	const { account, favorites } = useApp()
	const folder = multipageFavorite(favorites)

	if (!account) return <LibraryLoginGate />

	if (!folder) {
		return (
			<>
				<div className='text-sm font-medium'>分 p</div>
				<Empty className='border'>
					<EmptyHeader>
						<EmptyTitle>
							未找到分 P 视频收藏夹，请先创建一个收藏夹，并以 [mp] 开头
						</EmptyTitle>
						<EmptyDescription>
							分 p 分段只列出标题以 [mp] 开头的收藏夹里的视频。
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</>
		)
	}

	return (
		<MultipageVideos
			key={folder.id}
			folder={folder}
		/>
	)
}

function MultipageVideos({
	folder,
}: {
	folder: { id: string; title: string }
}) {
	const { player } = useApp()
	const [videos, setVideos] = useState<SearchHit[] | null>(null)

	useEffect(() => {
		let cancelled = false
		void trpcClient.bili.favorite
			.query({ id: folder.id })
			.then((result) => {
				if (!cancelled) setVideos(result.videos)
			})
			.catch((err) => {
				player.setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [folder.id])

	return (
		<>
			<div className='text-sm font-medium'>分 p</div>
			{videos === null ? (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>加载中</EmptyTitle>
						<EmptyDescription>正在读取分 P 收藏夹。</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : videos.length > 0 ? (
				<div className={coverGridClass}>
					{videos.map((video) => (
						<Button
							className={coverButtonClass}
							key={video.bvid}
							variant='ghost'
							nativeButton={false}
							render={
								<Link
									to='/library/multipage/$bvid'
									params={{ bvid: video.bvid }}
								/>
							}
						>
							<CoverFace
								src={video.pic}
								fallback='P'
							/>
							<CoverMeta
								title={video.title}
								subtitle={video.author}
							/>
						</Button>
					))}
				</div>
			) : (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyTitle>没有分 P 视频</EmptyTitle>
						<EmptyDescription>
							把视频加进「{folder.title}」后会出现在这里。
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</>
	)
}
