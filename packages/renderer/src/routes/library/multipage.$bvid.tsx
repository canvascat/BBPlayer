import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useApp } from '@/app-context'
import { LibraryBackButton } from '@/components/library-back-button'
import { LibraryDetailChrome } from '@/components/library-detail-chrome'
import { LibraryTrackList } from '@/components/library-track-list'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import type { TrackItem } from '@/playback'
import { trpcClient } from '@/trpc'

export const Route = createFileRoute('/library/multipage/$bvid')({
	component: MultipageDetailPage,
})

function MultipageDetailPage() {
	const { bvid } = Route.useParams()
	const { startPlay, player, filterNonSongs } = useApp()
	const [video, setVideo] = useState<{
		title: string
		cover: string
		owner: { name: string }
		pages: TrackItem[]
		filtered?: boolean
	} | null>(null)

	useEffect(() => {
		let cancelled = false
		void trpcClient.bili.video
			.query({ bvid })
			.then((result) => {
				if (!cancelled) setVideo(result)
			})
			.catch((err) => {
				player.setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [bvid, filterNonSongs])

	if (!video) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>加载中</EmptyTitle>
					<EmptyDescription>正在读取分 P。</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	if (video.filtered) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>已按设置隐藏非歌曲视频</EmptyTitle>
					<EmptyDescription>
						关闭设置中的「过滤非歌曲视频」后即可打开。
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<LibraryDetailChrome
			back={<LibraryBackButton from={Route.fullPath} />}
			title={video.title}
			subtitle={`${video.owner.name} · ${video.pages.length} 首`}
			coverSrc={video.cover}
			coverFallback='P'
			actions={
				<Button
					type='button'
					onClick={() => startPlay(video.pages, 0)}
					disabled={video.pages.length === 0}
				>
					播放全部
				</Button>
			}
		>
			<LibraryTrackList tracks={video.pages} />
		</LibraryDetailChrome>
	)
}
