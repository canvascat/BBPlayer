import assert from 'node:assert/strict'

import { Subject } from 'rxjs'
import { test } from 'vitest'

import { fromObservable } from './observable'

test('转发值并在退订后停止转发', () => {
	const source = new Subject<string>()
	const seen: string[] = []
	const sub = fromObservable(source).subscribe({
		next: (value) => seen.push(value),
	})

	source.next('first')
	sub.unsubscribe()
	source.next('second')

	assert.deepEqual(seen, ['first'])
})
