import { Link, useRouterState } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { pageTitleClass } from '@/cover-ui'

const tabs = [
	{ to: '/library', label: '播放列表' },
	{ to: '/library/favorites', label: '收藏夹' },
	{ to: '/library/collections', label: '合集' },
	{ to: '/library/multipage', label: '分 p' },
] as const

function tabActive(pathname: string, to: (typeof tabs)[number]['to']) {
	if (to === '/library')
		return pathname === '/library' || pathname === '/library/'
	return pathname === to
}

export function LibraryCatalogHeader() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})

	return (
		<>
			<div className='flex items-center gap-2'>
				<h1 className={pageTitleClass}>音乐库</h1>
				<div className='flex-1' />
				<Button
					size='sm'
					variant='ghost'
					nativeButton={false}
					render={<Link to='/library/downloads' />}
				>
					下载
				</Button>
				<Tooltip>
					<TooltipTrigger render={<span className='inline-flex' />}>
						<Button
							size='sm'
							variant='ghost'
							disabled
						>
							奖杯
						</Button>
					</TooltipTrigger>
					<TooltipContent>即将推出</TooltipContent>
				</Tooltip>
			</div>
			<div className='flex gap-1 border-b pb-2'>
				{tabs.map((tab) => (
					<Button
						key={tab.to}
						size='sm'
						variant={tabActive(pathname, tab.to) ? 'secondary' : 'ghost'}
						nativeButton={false}
						render={<Link to={tab.to} />}
					>
						{tab.label}
					</Button>
				))}
			</div>
		</>
	)
}
