export type LyricBgRendererKind = 'mesh' | 'pixi'

export const LYRIC_BG_STORAGE_KEY = 'bbplayer.lyric-bg-renderer'

export function parseLyricBgRenderer(
	raw: string | null | undefined,
): LyricBgRendererKind {
	return raw === 'pixi' ? 'pixi' : 'mesh'
}

export function lyricBgRendererLabel(kind: LyricBgRendererKind) {
	return kind === 'pixi' ? 'Pixi' : '流体网格'
}
