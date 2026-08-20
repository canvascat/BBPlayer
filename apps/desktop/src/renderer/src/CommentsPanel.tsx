import { useEffect, useState } from 'react'

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
		<div className='comment-item'>
			<img
				className='comment-avatar'
				src={item.avatar}
				alt=''
			/>
			<div>
				<div className='comment-name'>
					{item.uname}
					<span className='muted'>{formatTime(item.ctime)}</span>
				</div>
				<p className='comment-text'>{item.message}</p>
				<div className='comment-actions'>
					<button
						type='button'
						onClick={() => onLike(item)}
					>
						{item.action ? '已赞' : '赞'} {item.like || ''}
					</button>
					{item.rcount > 0 && (
						<button
							type='button'
							onClick={() => onReplies(item)}
						>
							回复 {item.rcount}
						</button>
					)}
				</div>
				{item.replies.map((reply) => (
					<div
						className='comment-reply'
						key={reply.rpid}
					>
						<b>{reply.uname}</b> {reply.message}
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
			const page = await window.bbplayer.getComments({
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
			await window.bbplayer.likeComment({
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
			const list = (await window.bbplayer.getReplyComments({
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
		<aside className='comments-panel'>
			<div className='queue-head'>
				<strong>评论 {count ? `(${count})` : ''}</strong>
				<button
					type='button'
					onClick={onClose}
				>
					关闭
				</button>
			</div>
			<div className='chips'>
				<button
					className={`chip ${mode === 3 ? 'on' : ''}`}
					type='button'
					onClick={() => setMode(3)}
				>
					热度
				</button>
				<button
					className={`chip ${mode === 2 ? 'on' : ''}`}
					type='button'
					onClick={() => setMode(2)}
				>
					时间
				</button>
			</div>
			{error && <p className='error'>{error}</p>}
			<div className='comment-list'>
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
					<p className='muted'>暂无评论</p>
				)}
			</div>
			{!isEnd && items.length > 0 && (
				<button
					className='chip'
					type='button'
					disabled={loading}
					onClick={() => void load(false)}
				>
					{loading ? '加载中…' : '加载更多'}
				</button>
			)}
		</aside>
	)
}
