import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { useApp } from '@/app-context'
import { LibraryLoginGate } from '@/components/library-login-gate'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import {
	CoverFace,
	CoverMeta,
	coverButtonClass,
	coverGridClass,
} from '@/cover-ui'

export const Route = createFileRoute('/library/_catalog/collections')({
	component: CollectionsPage,
})

function CollectionsPage() {
	const { account, collections } = useApp()
	const [query, setQuery] = useState('')
	const q = query.trim().toLowerCase()
	const filtered = useMemo(() => {
		if (!q) return collections
		return collections.filter((folder) =>
			folder.title.toLowerCase().includes(q),
		)
	}, [collections, q])

	if (!account) return <LibraryLoginGate />

	return (
		<>
			<div className='flex items-center justify-between'>
				<div className='text-sm font-medium'>我的合集</div>
				<div className='text-muted-foreground text-sm'>
					{collections.length} 个合集
				</div>
			</div>
			<InputGroup>
				<InputGroupInput
					value={query}
					placeholder='搜索合集'
					onChange={(e) => setQuery(e.target.value)}
				/>
			</InputGroup>
			{filtered.length > 0 ? (
				<div className={coverGridClass}>
					{filtered.map((folder) => (
						<Button
							className={coverButtonClass}
							key={folder.id}
							variant='ghost'
							nativeButton={false}
							render={
								<Link
									to='/library/collections/$id'
									params={{ id: folder.id }}
								/>
							}
						>
							<CoverFace
								src={folder.coverUrl}
								fallback='集'
							/>
							<CoverMeta
								title={folder.title}
								subtitle={`${folder.itemCount} 首`}
							/>
						</Button>
					))}
				</div>
			) : (
				<Empty className='border'>
					<EmptyHeader>
						<EmptyTitle>没有合集</EmptyTitle>
						<EmptyDescription>订阅的合集会显示在这里。</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</>
	)
}
