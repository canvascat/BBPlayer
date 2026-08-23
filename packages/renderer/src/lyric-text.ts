export function currentLyricText(
	lines: Array<{ startTime: number; words: Array<{ word: string }> }>,
	timeMs: number,
) {
	if (!lines.length) return ''
	let active = lines[0]
	for (const line of lines) {
		if (timeMs >= line.startTime) active = line
		else break
	}
	return active.words.map((word) => word.word).join('')
}
