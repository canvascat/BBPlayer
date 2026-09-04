export function trackMatchesQuery(
	track: {
		title: string
		artist: string
		musicTitle?: string
		musicArtist?: string
	},
	q: string,
) {
	const hay = [track.title, track.artist, track.musicTitle, track.musicArtist]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()
	return hay.includes(q)
}
