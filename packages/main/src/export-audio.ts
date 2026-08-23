import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { CachedTrack } from './downloads'

const execFileAsync = promisify(execFile)

export function safeExportName(artist: string, title: string) {
	const raw = [artist, title].filter(Boolean).join(' - ') || '未命名'
	return raw
		.replace(/[\\/:*?"<>|]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 120)
}

export function uniquePath(directory: string, base: string, ext: string) {
	let name = `${base}${ext}`
	let index = 2
	while (existsSync(join(directory, name))) {
		name = `${base} (${index})${ext}`
		index += 1
	}
	return join(directory, name)
}

export async function findFfmpeg() {
	for (const candidate of [
		'ffmpeg',
		'/opt/homebrew/bin/ffmpeg',
		'/usr/local/bin/ffmpeg',
	]) {
		try {
			if (candidate.startsWith('/')) {
				if (existsSync(candidate)) return candidate
				continue
			}
			const { stdout } = await execFileAsync('/usr/bin/which', [candidate])
			const found = stdout.trim()
			if (found) return found
		} catch {
			// try next
		}
	}
	return null
}

async function downloadCover(url: string) {
	const res = await fetch(url, {
		headers: {
			Referer: 'https://www.bilibili.com/',
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
		},
	})
	if (!res.ok) throw new Error('封面下载失败')
	return Buffer.from(await res.arrayBuffer())
}

export async function embedCover(options: {
	source: string
	dest: string
	coverUrl?: string
	sidecarDir: string
	base: string
	ffmpegPath?: string | null
}) {
	if (!options.coverUrl) {
		copyFileSync(options.source, options.dest)
		return { embedded: false }
	}
	let coverBytes: Buffer
	try {
		coverBytes = await downloadCover(options.coverUrl)
	} catch {
		copyFileSync(options.source, options.dest)
		return { embedded: false }
	}
	const ffmpeg =
		options.ffmpegPath === undefined ? await findFfmpeg() : options.ffmpegPath
	if (!ffmpeg) {
		copyFileSync(options.source, options.dest)
		writeFileSync(
			uniquePath(options.sidecarDir, options.base, '.jpg'),
			coverBytes,
		)
		return { embedded: false }
	}
	const coverPath = join(tmpdir(), `bbplayer-cover-${Date.now()}.jpg`)
	writeFileSync(coverPath, coverBytes)
	try {
		await execFileAsync(ffmpeg, [
			'-y',
			'-i',
			options.source,
			'-i',
			coverPath,
			'-map',
			'0:a',
			'-map',
			'1',
			'-c:a',
			'copy',
			'-c:v',
			'mjpeg',
			'-disposition:v:0',
			'attached_pic',
			options.dest,
		])
		return { embedded: true }
	} catch {
		copyFileSync(options.source, options.dest)
		writeFileSync(
			uniquePath(options.sidecarDir, options.base, '.jpg'),
			coverBytes,
		)
		return { embedded: false }
	} finally {
		if (existsSync(coverPath)) unlinkSync(coverPath)
	}
}

export async function exportCachedTracks(options: {
	directory: string
	records: CachedTrack[]
	filePath: (id: string) => string
	ffmpegPath?: string | null
}) {
	let exported = 0
	const failed: string[] = []
	for (const track of options.records) {
		const source = options.filePath(track.id)
		if (!existsSync(source)) {
			failed.push(track.title)
			continue
		}
		try {
			const base = safeExportName(track.artist, track.title)
			await embedCover({
				source,
				dest: uniquePath(options.directory, base, '.m4a'),
				coverUrl: track.artwork,
				sidecarDir: options.directory,
				base,
				ffmpegPath: options.ffmpegPath,
			})
			if (track.lyrics?.lrc) {
				writeFileSync(
					uniquePath(options.directory, base, '.lrc'),
					track.lyrics.lrc,
					'utf8',
				)
			}
			if (track.lyrics?.tlyric) {
				writeFileSync(
					uniquePath(options.directory, base, '.zh.lrc'),
					track.lyrics.tlyric,
					'utf8',
				)
			}
			exported += 1
		} catch {
			failed.push(track.title)
		}
	}
	return { exported, failed }
}

export function exportSummary(exported: number, failed: string[]) {
	if (exported === 0 && failed.length === 0) return '没有可导出的歌曲'
	if (failed.length === 0) return `导出完成，${exported} 个成功`
	return `导出完成，${exported} 个成功，${failed.length} 个失败`
}
