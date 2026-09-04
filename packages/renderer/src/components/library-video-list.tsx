import type { SearchHit } from '@/app-context'
import { useApp } from '@/app-context'
import { Button } from '@/components/ui/button'
import { OverflowText } from '@/cover-ui'
import { trpcClient } from '@/trpc'

export function LibraryVideoList({ videos }: { videos: SearchHit[] }) {
	const { startPlay, player } = useApp()

	const playAt = async (index: number) => {
		const hit = videos[index]
		if (!hit) return
		try {
			const video = await trpcClient.bili.video.query({ bvid: hit.bvid })
			startPlay(video.pages, 0)
		} catch (err) {
			player.setError(err instanceof Error ? err.message : String(err))
		}
	}

	return (
		<div className='flex flex-col gap-1'>
			{videos.map((video, i) => (
				<Button
					key={video.bvid}
					className='grid h-auto w-full grid-cols-[28px_48px_1fr_auto] items-center gap-3 rounded-lg px-2.5 py-2 whitespace-normal'
					type='button'
					variant='ghost'
					onClick={() => void playAt(i)}
				>
					<span className='text-muted-foreground text-right text-[13px]'>
						{String(i + 1).padStart(2, '0')}
					</span>
					<img
						className='size-12 rounded-lg object-cover'
						src={video.pic}
						alt=''
					/>
					<div className='min-w-0 text-left'>
						<OverflowText text={video.title} />
						<OverflowText
							className='text-muted-foreground text-xs'
							text={video.author}
						/>
					</div>
					<span className='text-muted-foreground text-xs'>
						{video.duration}
					</span>
				</Button>
			))}
		</div>
	)
}
