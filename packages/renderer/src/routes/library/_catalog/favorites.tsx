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
import { nonMultipageFavorites } from '@/library-nav'

export const Route = createFileRoute('/library/_catalog/favorites')({
	component: FavoritesPage,
})

function FavoritesPage() {
	const { account, favorites } = useApp()
	const [query, setQuery] = useState('')
	const folders = nonMultipageFavorites(favorites)
	const q = query.trim().toLowerCase()
	const filtered = useMemo(() => {
		if (!q) return folders
		return folders.filter((folder) => folder.title.toLowerCase().includes(q))
	}, [folders, q])

	if (!account) return <LibraryLoginGate />

	return (
		<>
			<div className='flex items-center justify-between'>
				<div className='text-sm font-medium'>我的收藏夹</div>
				<div className='text-muted-foreground text-sm'>
					{folders.length} 个收藏夹
				</div>
			</div>
			<InputGroup>
				<InputGroupInput
					value={query}
					placeholder='搜索我的收藏夹内容'
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
									to='/library/favorites/$id'
									params={{ id: folder.id }}
								/>
							}
						>
							<CoverFace
								src={folder.coverUrl}
								fallback='藏'
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
						<EmptyTitle>没有收藏夹</EmptyTitle>
						<EmptyDescription>登录后可从 B 站同步收藏夹。</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</>
	)
}
