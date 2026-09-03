import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import {
	formatLyricOffset,
	LYRIC_OFFSET_MAX,
	LYRIC_OFFSET_MIN,
} from './lyric-offset'

export function LyricOffsetRail({
	offsetSec,
	onStep,
	onDone,
}: {
	offsetSec: number
	onStep: (direction: 1 | -1) => void
	onDone: () => void
}) {
	return (
		<div
			className='bg-popover text-popover-foreground absolute top-1/2 right-[22px] z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-3xl p-2 shadow-md ring-1 ring-foreground/10'
			data-lyric-offset-rail
		>
			<Button
				type='button'
				variant='ghost'
				size='icon'
				aria-label='歌词提前 0.5 秒'
				disabled={offsetSec <= LYRIC_OFFSET_MIN}
				onClick={() => onStep(-1)}
			>
				<ChevronUpIcon />
			</Button>
			<span className='text-foreground min-w-10 text-center text-xs font-medium tabular-nums'>
				{formatLyricOffset(offsetSec)}
			</span>
			<Button
				type='button'
				variant='ghost'
				size='icon'
				aria-label='歌词延后 0.5 秒'
				disabled={offsetSec >= LYRIC_OFFSET_MAX}
				onClick={() => onStep(1)}
			>
				<ChevronDownIcon />
			</Button>
			<Separator className='my-1 w-5' />
			<Button
				type='button'
				variant='ghost'
				size='icon'
				aria-label='完成偏移调整'
				onClick={onDone}
			>
				<CheckIcon />
			</Button>
		</div>
	)
}
