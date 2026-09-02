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

export const Route = createFileRoute('/library/watch-later')({
	component: WatchLaterPage,
})

function WatchLaterPage() {
	const { startPlay, player } = useApp()
	const [videos, setVideos] = useState<SearchHit[] | null>(null)

	useEffect(() => {
		let cancelled = false
		void trpcClient.bili.watchLater
			.query()
			.then((result) => {
				if (!cancelled) setVideos(result.videos)
			})
			.catch((err) => {
				player.setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [])

	const playAll = async () => {
		const first = videos?.[0]
		if (!first) return
		const video = await trpcClient.bili.video.query({ bvid: first.bvid })
		startPlay(video.pages, 0)
	}

	if (!videos) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>加载中</EmptyTitle>
					<EmptyDescription>正在读取稍后再看。</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<LibraryDetailChrome
			back={<LibraryBackButton from={Route.fullPath} />}
			title='稍后再看'
			subtitle={`${videos.length} 首歌曲 · 稍后再看`}
			coverSrc={videos[0]?.pic}
			coverFallback='稍'
			actions={
				<Button
					type='button'
					onClick={() => void playAll()}
					disabled={videos.length === 0}
				>
					播放全部
				</Button>
			}
		>
			<LibraryVideoList videos={videos} />
		</LibraryDetailChrome>
	)
}
