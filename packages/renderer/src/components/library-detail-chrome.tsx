import type { ReactNode } from 'react'

import { CoverFace, OverflowText, pageTitleClass } from '@/cover-ui'

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
			<div className='flex min-w-0 flex-col gap-3'>
				<OverflowText
					as='h1'
					className={pageTitleClass}
					text={title}
				/>
				{back}
			</div>
			<div className='flex min-w-0 items-center gap-5'>
				<div className='shrink-0'>
					<CoverFace
						src={coverSrc}
						fallback={coverFallback}
					/>
				</div>
				<div className='flex min-w-0 flex-col gap-2'>
					<OverflowText
						className='text-3xl font-semibold tracking-tight'
						text={title}
					/>
					<OverflowText
						className='text-muted-foreground text-sm'
						text={subtitle}
					/>
					<div className='flex items-center gap-2'>{actions}</div>
				</div>
			</div>
			{children}
		</>
	)
}
