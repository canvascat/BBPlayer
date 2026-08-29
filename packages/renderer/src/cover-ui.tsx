import { cn } from '@/lib/utils'

export function greeting() {
	const hour = new Date().getHours()
	if (hour < 6) return '凌晨好'
	if (hour < 12) return '早上好'
	if (hour < 18) return '下午好'
	return '晚上好'
}

export function stripHtml(input: string) {
	return input.replace(/<[^>]+>/g, '')
}

export const coverButtonClass =
	'h-auto w-32 min-w-0 flex-col items-stretch gap-2 p-0 whitespace-normal'
export const pageTitleClass = 'text-3xl font-semibold tracking-tight'
export const coverGridClass =
	'grid grid-cols-[repeat(auto-fill,128px)] justify-between gap-4'
export const navLabelClass =
	'mt-1 ml-2 text-xs font-medium text-sidebar-foreground/70'

export function CoverFace({
	src,
	fallback,
}: {
	src?: string
	fallback?: string
}) {
	if (src) {
		return (
			<img
				src={src}
				alt=''
				className='size-32 rounded-xl object-cover'
			/>
		)
	}
	return (
		<div className='bg-muted text-muted-foreground flex size-32 items-center justify-center rounded-xl text-2xl'>
			{fallback}
		</div>
	)
}

export function CoverMeta({
	title,
	subtitle,
	active,
}: {
	title: string
	subtitle: string
	active?: boolean
}) {
	return (
		<>
			<span
				className={cn(
					'line-clamp-2 text-left text-sm',
					active && 'text-primary',
				)}
			>
				{title}
			</span>
			<span className='text-muted-foreground line-clamp-1 text-left text-xs'>
				{subtitle}
			</span>
		</>
	)
}
