import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useApp, type SearchHit } from '@/app-context'
import { LibraryBackButton } from '@/components/library-back-button'
import { LibraryDetailChrome } from '@/components/library-detail-chrome'
import { LibraryVideoList } from '@/components/library-video-list'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { trpcClient } from '@/trpc'

export const Route = createFileRoute('/library/favorites/$id')({
	component: FavoriteDetailPage,
})

function FavoriteDetailPage() {
	const { id } = Route.useParams()
	const { startPlay, player, createLocalPlaylist } = useApp()
	const [title, setTitle] = useState('收藏夹')
	const [videos, setVideos] = useState<SearchHit[] | null>(null)

	useEffect(() => {
		let cancelled = false
		void trpcClient.bili.favorite
			.query({ id })
			.then((result) => {
				if (cancelled) return
				setTitle(result.title)
				setVideos(result.videos)
			})
			.catch((err) => {
				player.setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [id])

	const playAll = async () => {
		const first = videos?.[0]
		if (!first) return
		const video = await trpcClient.bili.video.query({ bvid: first.bvid })
		startPlay(video.pages, 0)
	}

	const syncLocal = async () => {
		if (!videos?.length) return
		try {
			const pages = await Promise.all(
				videos.map((item) => trpcClient.bili.video.query({ bvid: item.bvid })),
			)
			await createLocalPlaylist(
				pages.flatMap((item) => item.pages),
				title,
			)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	if (!videos) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>加载中</EmptyTitle>
					<EmptyDescription>正在读取收藏夹。</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<LibraryDetailChrome
			back={<LibraryBackButton from={Route.fullPath} />}
			title={title}
			subtitle={`${videos.length} 首歌曲`}
			coverSrc={videos[0]?.pic}
			coverFallback='藏'
			actions={
				<>
					<Button
						type='button'
						onClick={() => void playAll()}
						disabled={videos.length === 0}
					>
						播放全部
					</Button>
					<Button
						type='button'
						variant='ghost'
						onClick={() => void syncLocal()}
						disabled={videos.length === 0}
					>
						同步到本地
					</Button>
				</>
			}
		>
			<LibraryVideoList videos={videos} />
		</LibraryDetailChrome>
	)
}
