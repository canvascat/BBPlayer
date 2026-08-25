import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

import { trpc } from './trpc'

export interface SkinTheme {
	name: string
	coverUrl: string
	primary: string
}

function samplePrimary(dataUrl: string) {
	return new Promise<string>((resolve) => {
		const image = new Image()
		image.onload = () => {
			const canvas = document.createElement('canvas')
			canvas.width = 24
			canvas.height = 24
			const ctx = canvas.getContext('2d')
			if (!ctx) {
				resolve('232, 92, 108')
				return
			}
			ctx.drawImage(image, 0, 0, 24, 24)
			const data = ctx.getImageData(0, 0, 24, 24).data
			let r = 0
			let g = 0
			let b = 0
			let count = 0
			for (let i = 0; i < data.length; i += 4) {
				r += data[i]
				g += data[i + 1]
				b += data[i + 2]
				count += 1
			}
			resolve(
				`${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`,
			)
		}
		image.onerror = () => resolve('232, 92, 108')
		image.src = dataUrl
	})
}

export function SkinPicker({
	value,
	onChange,
}: {
	value: SkinTheme | null
	onChange: (next: SkinTheme | null) => void
}) {
	const [keyword, setKeyword] = useState('')
	const [list, setList] = useState<
		Array<{ itemId: number; name: string; coverUrl: string }>
	>([])
	const [message, setMessage] = useState('')
	const [busy, setBusy] = useState(false)

	const search = async () => {
		const q = keyword.trim()
		if (!q) return
		setBusy(true)
		setMessage('')
		try {
			const result = await trpc.bili.garbSearch.query({ keyword: q })
			setList(result.list)
			if (!result.list.length) setMessage('没有找到装扮')
		} catch (err) {
			setMessage(err instanceof Error ? err.message : String(err))
		} finally {
			setBusy(false)
		}
	}

	const apply = async (item: { name: string; coverUrl: string }) => {
		setBusy(true)
		try {
			let primary = '232, 92, 108'
			if (item.coverUrl) {
				const dataUrl = await trpc.bili.skinCover.query({ url: item.coverUrl })
				primary = await samplePrimary(dataUrl)
			}
			onChange({ name: item.name, coverUrl: item.coverUrl, primary })
			setMessage(`已应用「${item.name}」`)
		} catch (err) {
			onChange({
				name: item.name,
				coverUrl: item.coverUrl,
				primary: '232, 92, 108',
			})
			setMessage(err instanceof Error ? err.message : String(err))
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className='flex flex-col gap-4'>
			<p className='text-muted-foreground'>
				搜索 B 站装扮，用封面和主色点缀界面。完整资源包稍后补齐。
			</p>
			{value && (
				<div className='flex items-center gap-3'>
					{value.coverUrl && (
						<img
							src={value.coverUrl}
							alt=''
							className='size-12 rounded-lg object-cover'
						/>
					)}
					<div className='min-w-0 flex-1'>
						<div className='truncate font-medium'>{value.name}</div>
						<div className='text-muted-foreground'>当前装扮</div>
					</div>
					<Button
						type='button'
						variant='outline'
						onClick={() => onChange(null)}
					>
						清除
					</Button>
				</div>
			)}
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor='skin-search'>搜索装扮</FieldLabel>
					<div className='flex gap-2'>
						<Input
							id='skin-search'
							value={keyword}
							onChange={(event) => setKeyword(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault()
									void search()
								}
							}}
							placeholder='装扮 / 收藏集名称'
						/>
						<Button
							type='button'
							variant='outline'
							disabled={busy}
							onClick={() => void search()}
						>
							{busy ? '搜索中…' : '搜索'}
						</Button>
					</div>
				</Field>
			</FieldGroup>
			<div className='grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3'>
				{list.map((item) => (
					<Button
						key={item.itemId}
						type='button'
						variant='ghost'
						className='h-auto flex-col items-stretch gap-2 p-0'
						onClick={() => void apply(item)}
					>
						<img
							src={item.coverUrl}
							alt=''
							className='aspect-square w-full rounded-xl object-cover'
						/>
						<div className='truncate px-1 text-left text-sm'>{item.name}</div>
					</Button>
				))}
			</div>
			{message && <p className='text-muted-foreground'>{message}</p>}
		</div>
	)
}
