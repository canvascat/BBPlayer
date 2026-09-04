function present(value?: string | null) {
	const text = value?.trim()
	return text ? text : undefined
}

export function displayTitle(track: {
	title: string
	musicTitle?: string | null
}) {
	return present(track.musicTitle) ?? track.title
}

export function displayArtist(track: {
	artist: string
	musicArtist?: string | null
}) {
	return present(track.musicArtist) ?? track.artist
}
