export const MUSIC_TIDS: ReadonlySet<number> = new Set([
	3, 28, 31, 30, 59, 193, 29, 130, 243, 244,
])

export type SongVideoHint = {
	tid?: number | null
	title: string
}

const TITLE_HTML = /<[^>]+>/g

const SONG_TITLE_RE =
	/翻唱|cover|原创曲|official\s*audio|【mv】|\[mv\]|\bmv\b|歌ってみた|vocaloid|ボカロ|歌切|纯享|官方音频/i

export function isSongVideo(input: SongVideoHint): boolean {
	if (input.tid != null && MUSIC_TIDS.has(input.tid)) return true
	const title = input.title.replace(TITLE_HTML, '')
	return SONG_TITLE_RE.test(title)
}
