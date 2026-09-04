export interface LibraryTrack {
	id: string
	bvid: string
	cid: number
	title: string
	artist: string
	artwork: string
	duration: number
	tid?: number
	musicTitle?: string
	musicArtist?: string
}

export type ShareRole = 'owner' | 'editor' | 'subscriber'

export interface ShareTrackPayload {
	unique_key: string
	title: string
	artist_name?: string
	artist_id?: string
	cover_url?: string
	duration?: number
	bilibili_bvid: string
	bilibili_cid?: string
}

export type SharePullTrack =
	| {
			op: 'upsert'
			track: ShareTrackPayload
			sort_key: string
	  }
	| {
			op: 'delete'
			track_unique_key: string
	  }

export interface SharePullData {
	metadata?: {
		title?: string | null
		description?: string | null
		cover_url?: string | null
	} | null
	tracks: SharePullTrack[]
}

export interface ShareUploadTrack {
	track: ShareTrackPayload
	sort_key: string
}

export interface LocalPlaylist {
	id: string
	title: string
	description: string
	coverUrl: string
	createdAt: number
	updatedAt: number
	shareId: string | null
	shareRole: ShareRole | null
	lastShareSyncAt: number | null
	tracks: LibraryTrack[]
}

export interface PlaylistSummary {
	id: string
	title: string
	description: string
	coverUrl: string
	itemCount: number
	updatedAt: number
	shareId: string | null
	shareRole: ShareRole | null
}
