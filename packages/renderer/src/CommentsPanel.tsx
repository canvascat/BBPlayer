import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { trpcClient } from './trpc'

export interface CommentItem {
	rpid: number
	mid: number
	like: number
	action: number
	ctime: number
	rcount: number
	uname: string
	avatar: string
	message: string
	replies: CommentItem[]
}

function formatTime(ctime: number) {
	if (!ctime) return ''
	return new Date(ctime * 1000).toLocaleString('zh-CN', {
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function CommentRow({
	item,
	onLike,
	onReplies,
}: {
	item: CommentItem
	bvid: string
	onLike: (item: CommentItem) => void
	onReplies: (item: CommentItem) => void
}) {
	return (
		<div className='flex gap-3'>
			<Avatar size='sm'>
				<AvatarImage
					src={item.avatar}
					alt=''
				/>
				<AvatarFallback>{item.uname.slice(0, 1)}</AvatarFallback>
			</Avatar>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-2 text-sm'>
					<span className='font-medium'>{item.uname}</span>
					<span className='text-muted-foreground'>
						{formatTime(item.ctime)}
					</span>
				</div>
				<p className='mt-1 text-sm leading-relaxed'>{item.message}</p>
				<div className='mt-1 flex gap-1'>
					<Button
						type='button'
						variant='ghost'
						size='xs'
						onClick={() => onLike(item)}
					>
						{item.action ? '已赞' : '赞'} {item.like || ''}
					</Button>
					{item.rcount > 0 && (
						<Button
							type='button'
							variant='ghost'
							size='xs'
							onClick={() => onReplies(item)}
						>
							回复 {item.rcount}
						</Button>
					)}
				</div>
				{item.replies.map((reply) => (
					<div
						className='text-muted-foreground mt-2 text-sm'
						key={reply.rpid}
					>
						<b className='text-foreground'>{reply.uname}</b> {reply.message}
					</div>
				))}
			</div>
		</div>
	)
}

export function CommentsPanel({
	bvid,
	onClose,
}: {
	bvid: string
	onClose: () => void
}) {
	const [mode, setMode] = useState<2 | 3>(3)
	const [items, setItems] = useState<CommentItem[]>([])
	const [next, setNext] = useState(0)
	const [isEnd, setIsEnd] = useState(false)
	const [count, setCount] = useState(0)
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	const load = async (reset: boolean) => {
		if (loading) return
		setLoading(true)
		setError('')
		try {
			const page = await trpcClient.bili.comments.query({
				bvid,
				next: reset ? 0 : next,
				mode,
			})
			setItems((prev) => (reset ? page.replies : [...prev, ...page.replies]))
			setNext(page.next)
			setIsEnd(page.isEnd)
			setCount(page.allCount)
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		setItems([])
		setNext(0)
		setIsEnd(false)
		void load(true)
	}, [bvid, mode])

	const like = async (item: CommentItem) => {
		try {
			const action = item.action ? 0 : 1
			await trpcClient.bili.commentLike.mutate({
				bvid,
				rpid: item.rpid,
				action,
			})
			setItems((prev) =>
				prev.map((row) =>
					row.rpid === item.rpid
						? {
								...row,
								action,
								like: Math.max(0, row.like + (action ? 1 : -1)),
							}
						: row,
				),
			)
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}

	const replies = async (item: CommentItem) => {
		if (item.replies.length) return
		try {
			const list = (await trpcClient.bili.commentReplies.query({
				bvid,
				rpid: item.rpid,
			})) as CommentItem[]
			setItems((prev) =>
				prev.map((row) =>
					row.rpid === item.rpid ? { ...row, replies: list } : row,
				),
			)
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		}
	}

	return (
		<aside className='bg-background/80 ring-foreground/10 absolute top-16 right-4 bottom-24 z-30 flex w-80 flex-col gap-3 rounded-xl p-3 ring-1 backdrop-blur-xl'>
			<div className='flex items-center justify-between'>
				<strong>评论 {count ? `(${count})` : ''}</strong>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					onClick={onClose}
				>
					关闭
				</Button>
			</div>
			<ToggleGroup
				value={[String(mode)]}
				onValueChange={(value) => {
					if (value[0] === '2') setMode(2)
					if (value[0] === '3') setMode(3)
				}}
				variant='outline'
				spacing={0}
			>
				<ToggleGroupItem value='3'>热度</ToggleGroupItem>
				<ToggleGroupItem value='2'>时间</ToggleGroupItem>
			</ToggleGroup>
			{error && <p className='text-destructive text-sm'>{error}</p>}
			<ScrollArea className='min-h-0 flex-1'>
				<div className='flex flex-col gap-4 pr-3'>
					{items.map((item) => (
						<CommentRow
							key={item.rpid}
							item={item}
							bvid={bvid}
							onLike={like}
							onReplies={replies}
						/>
					))}
					{!loading && !items.length && !error && (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>暂无评论</EmptyTitle>
								<EmptyDescription>这首还没有评论。</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</div>
			</ScrollArea>
			{!isEnd && items.length > 0 && (
				<Button
					type='button'
					variant='outline'
					disabled={loading}
					onClick={() => void load(false)}
				>
					{loading ? '加载中…' : '加载更多'}
				</Button>
			)}
		</aside>
	)
}
