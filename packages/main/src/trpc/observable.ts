import { observable } from '@trpc/server/observable'
import type { Observable } from 'rxjs'

export function fromObservable<T>(source: Observable<T>) {
	return observable<T>((emit) => {
		const sub = source.subscribe({
			next: (value) => emit.next(value),
			error: (err) => emit.error(err),
			complete: () => emit.complete(),
		})
		return () => sub.unsubscribe()
	})
}
