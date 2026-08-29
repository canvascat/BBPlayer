import { Link, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'

export const Route = createFileRoute('/$')({
	component: NotFoundPage,
})

function NotFoundPage() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>404</EmptyTitle>
				<EmptyDescription>你正在找的页面不见了！</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button
					nativeButton={false}
					render={<Link to='/' />}
				>
					回到主页
				</Button>
			</EmptyContent>
		</Empty>
	)
}
