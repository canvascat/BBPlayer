import { Link, type LinkProps } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export function LibraryBackButton({ from }: { from: LinkProps['from'] }) {
	return (
		<Button
			size='sm'
			variant='ghost'
			className='w-fit'
			nativeButton={false}
			render={
				<Link
					from={from}
					to='..'
				/>
			}
		>
			← 返回
		</Button>
	)
}
