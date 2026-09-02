import { Outlet, createFileRoute } from '@tanstack/react-router'

import { LibraryCatalogHeader } from '@/components/library-catalog-header'

export const Route = createFileRoute('/library/_catalog')({
	component: CatalogLayout,
})

function CatalogLayout() {
	return (
		<div className='flex flex-col gap-3'>
			<LibraryCatalogHeader />
			<Outlet />
		</div>
	)
}
