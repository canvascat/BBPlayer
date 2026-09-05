import {
	createWriteStream,
	existsSync,
	mkdirSync,
	renameSync,
	statSync,
	unlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { getLogger } from './logger/runtime.ts'

export type DownloadTaskState =
	| 'queued'
	| 'downloading'
	| 'completed'
	| 'failed'

export interface CachedTrack {
	id: string
	bvid: string
	cid: number
	title: string
	artist: string
	artwork: string
	duration: number
	size: number
	cachedAt: number
	lyrics?: {
		lrc: string
		tlyric?: string
		romalrc?: string
	}
}

export interface DownloadJob {
	track: CachedTrack
	url: string
	cookie: string
}

const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export function cacheFileName(id: string) {
	return `${id.replace(/[^A-Za-z0-9._-]+/g, '_')}.m4a`
}

export class DownloadManager {
	dir = ''
	concurrency = 1
	private records: CachedTrack[] = []
	private queue: DownloadJob[] = []
	private active = 0
	private tasks = new Map<string, DownloadTaskState>()
	private onChange:
		| ((
				records: CachedTrack[],
				tasks: Record<string, DownloadTaskState>,
		  ) => void)
		| null = null
	private pendingLyrics = new Map<string, CachedTrack['lyrics']>()

	configure(options: {
		dir: string
		records: CachedTrack[]
		concurrency?: number
		onChange?: (
			records: CachedTrack[],
			tasks: Record<string, DownloadTaskState>,
		) => void
	}) {
		this.dir = options.dir
		this.concurrency = options.concurrency ?? 1
		this.onChange = options.onChange ?? null
		mkdirSync(this.dir, { recursive: true })
		this.records = options.records.filter((item) =>
			existsSync(this.filePath(item.id)),
		)
		for (const item of this.records) this.tasks.set(item.id, 'completed')
		this.emit()
	}

	list() {
		return this.records
	}

	isComplete(id: string) {
		return this.tasks.get(id) === 'completed' && existsSync(this.filePath(id))
	}

	filePath(id: string) {
		return join(this.dir, cacheFileName(id))
	}

	statusMap() {
		return Object.fromEntries(this.tasks)
	}

	enqueue(job: DownloadJob) {
		if (this.isComplete(job.track.id)) return
		const current = this.tasks.get(job.track.id)
		if (current === 'queued' || current === 'downloading') return
		this.tasks.set(job.track.id, 'queued')
		this.queue.push(job)
		this.emit()
		this.pump()
	}

	remove(id: string) {
		this.queue = this.queue.filter((job) => job.track.id !== id)
		this.records = this.records.filter((item) => item.id !== id)
		this.tasks.delete(id)
		const path = this.filePath(id)
		if (existsSync(path)) unlinkSync(path)
		const part = `${path}.part`
		if (existsSync(part)) unlinkSync(part)
		this.emit()
	}

	saveLyrics(id: string, lyrics: CachedTrack['lyrics']) {
		this.pendingLyrics.set(id, lyrics)
		const index = this.records.findIndex((item) => item.id === id)
		if (index < 0) return
		this.records[index] = { ...this.records[index], lyrics }
		this.emit()
	}

	private emit() {
		this.onChange?.(this.records, this.statusMap())
	}

	private pump() {
		while (this.active < this.concurrency && this.queue.length > 0) {
			const job = this.queue.shift()
			if (!job) return
			this.active += 1
			this.tasks.set(job.track.id, 'downloading')
			this.emit()
			void this.run(job).finally(() => {
				this.active -= 1
				this.pump()
			})
		}
	}

	private async run(job: DownloadJob) {
		const dest = this.filePath(job.track.id)
		const part = `${dest}.part`
		try {
			const response = await fetch(job.url, {
				headers: {
					'User-Agent': UA,
					Referer: 'https://www.bilibili.com/',
					Origin: 'https://www.bilibili.com',
					Cookie: job.cookie,
				},
			})
			if (!response.ok || !response.body) {
				throw new Error(`下载失败 ${response.status}`)
			}
			await pipeline(
				Readable.fromWeb(response.body as never),
				createWriteStream(part),
			)
			if (existsSync(dest)) unlinkSync(dest)
			renameSync(part, dest)
			const size = statSync(dest).size
			const next: CachedTrack = {
				...job.track,
				lyrics: this.pendingLyrics.get(job.track.id) ?? job.track.lyrics,
				size,
				cachedAt: Date.now(),
			}
			this.pendingLyrics.delete(job.track.id)
			this.records = [
				next,
				...this.records.filter((item) => item.id !== next.id),
			]
			this.tasks.set(job.track.id, 'completed')
		} catch (error) {
			getLogger('downloads').warn({ err: error }, 'download task failed')
			if (existsSync(part)) unlinkSync(part)
			this.tasks.set(job.track.id, 'failed')
		}
		this.emit()
	}
}

export const downloadManager = new DownloadManager()
