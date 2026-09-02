import { createFileRoute, notFound } from '@tanstack/react-router'
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

export const Route = createFileRoute('/library/playlists/$id')({
	component: PlaylistDetailPage,
})

function PlaylistDetailPage() {
	const { id } = Route.useParams()
	const { libraryTick } = useApp()
	return (
		<PlaylistDetail
			key={`${id}:${libraryTick}`}
			id={id}
		/>
	)
}

function PlaylistDetail({ id }: { id: string }) {
	const { startPlay } = useApp()
	const [playlist, setPlaylist] = useState<{
		id: string
		title: string
		coverUrl: string
		tracks: TrackItem[]
	} | null>(null)
	const [missing, setMissing] = useState(false)

	useEffect(() => {
		let cancelled = false
		void trpcClient.library.get.query({ id }).then((result) => {
			if (cancelled) return
			if (!result) {
				setMissing(true)
				return
			}
			setPlaylist(result)
		})
		return () => {
			cancelled = true
		}
	}, [id])

	if (missing) throw notFound()

	if (!playlist) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>加载中</EmptyTitle>
					<EmptyDescription>正在读取本地歌单。</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<LibraryDetailChrome
			back={<LibraryBackButton from={Route.fullPath} />}
			title={playlist.title}
			subtitle={`${playlist.tracks.length} 首歌曲`}
			coverSrc={playlist.coverUrl}
			coverFallback={playlist.title.slice(0, 1)}
			actions={
				<Button
					type='button'
					onClick={() => startPlay(playlist.tracks, 0)}
					disabled={playlist.tracks.length === 0}
				>
					播放全部
				</Button>
			}
		>
			<LibraryTrackList
				tracks={playlist.tracks}
				playlistId={playlist.id}
				onRemoved={() => {
					void trpcClient.library.get.query({ id }).then((result) => {
						if (result) setPlaylist(result)
					})
				}}
			/>
		</LibraryDetailChrome>
	)
}
