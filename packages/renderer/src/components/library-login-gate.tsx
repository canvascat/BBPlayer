import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'

export function LibraryLoginGate() {
	return (
		<Empty className='border'>
			<EmptyHeader>
				<EmptyTitle>登录 bilibili 账号后才能查看合集</EmptyTitle>
				<EmptyDescription>收藏夹、合集、分 p 需要 B 站登录。</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button
					nativeButton={false}
					render={<Link to='/settings' />}
				>
					登录
				</Button>
			</EmptyContent>
		</Empty>
	)
}
