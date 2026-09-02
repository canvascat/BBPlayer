import type { ReactNode } from 'react'

import { CoverFace, pageTitleClass } from '@/cover-ui'

export function LibraryDetailChrome({
	back,
	title,
	subtitle,
	coverSrc,
	coverFallback,
	actions,
	children,
}: {
	back: ReactNode
	title: string
	subtitle: string
	coverSrc?: string
	coverFallback?: string
	actions: ReactNode
	children: ReactNode
}) {
	return (
		<>
			<div className='flex flex-col gap-3'>
				<h1 className={pageTitleClass}>{title}</h1>
				{back}
			</div>
			<div className='flex items-center gap-5'>
				<CoverFace
					src={coverSrc}
					fallback={coverFallback}
				/>
				<div className='flex min-w-0 flex-col gap-2'>
					<div className='text-3xl font-semibold tracking-tight'>{title}</div>
					<div className='text-muted-foreground text-sm'>{subtitle}</div>
					<div className='flex items-center gap-2'>{actions}</div>
				</div>
			</div>
			{children}
		</>
	)
}
