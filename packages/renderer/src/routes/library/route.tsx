import { Outlet, createFileRoute } from '@tanstack/react-router'

import { useApp } from '@/app-context'

export const Route = createFileRoute('/library')({
	component: LibraryLayout,
})

function LibraryLayout() {
	const { player } = useApp()
	return (
		<div className='flex flex-col gap-3'>
			<Outlet />
			{player.error ? <p className='text-destructive'>{player.error}</p> : null}
		</div>
	)
}
