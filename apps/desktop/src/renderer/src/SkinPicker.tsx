import { useState } from 'react'

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
		<div className='skin-picker'>
			<p className='muted'>
				搜索 B 站装扮，用封面和主色点缀界面。完整资源包稍后补齐。
			</p>
			{value && (
				<div className='account-row'>
					{value.coverUrl && (
						<img
							src={value.coverUrl}
							alt=''
						/>
					)}
					<div>
						<div className='title'>{value.name}</div>
						<div className='muted'>当前装扮</div>
					</div>
					<button
						className='chip'
						type='button'
						onClick={() => onChange(null)}
					>
						清除
					</button>
				</div>
			)}
			<label className='field'>
				搜索装扮
				<input
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
			</label>
			<div className='chips'>
				<button
					className='chip'
					type='button'
					disabled={busy}
					onClick={() => void search()}
				>
					{busy ? '搜索中…' : '搜索'}
				</button>
			</div>
			<div className='skin-grid'>
				{list.map((item) => (
					<button
						className='cover-card'
						key={item.itemId}
						type='button'
						onClick={() => void apply(item)}
					>
						<img
							src={item.coverUrl}
							alt=''
						/>
						<div className='name'>{item.name}</div>
					</button>
				))}
			</div>
			{message && <p className='muted'>{message}</p>}
		</div>
	)
}
