export function compareSemver(a: string, b: string) {
	const pa = a
		.replace(/^v/i, '')
		.split('.')
		.map((n) => Number.parseInt(n, 10) || 0)
	const pb = b
		.replace(/^v/i, '')
		.split('.')
		.map((n) => Number.parseInt(n, 10) || 0)
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const ai = pa[i] ?? 0
		const bi = pb[i] ?? 0
		if (ai > bi) return 1
		if (ai < bi) return -1
	}
	return 0
}

export interface UpdateCheck {
	status: 'latest' | 'available' | 'error'
	currentVersion: string
	latestVersion?: string
	notes?: string
	forced?: boolean
	message: string
}

export function notesFromRelease(
	releaseNotes: string | Array<{ note?: string | null }> | null | undefined,
) {
	if (typeof releaseNotes === 'string') {
		const trimmed = releaseNotes.trim()
		return trimmed || undefined
	}
	if (!Array.isArray(releaseNotes)) return undefined
	const lines = releaseNotes
		.map((item) => item.note?.trim())
		.filter((line): line is string => Boolean(line))
	return lines.length > 0 ? lines.join('\n') : undefined
}

export function interpretUpdate(
	currentVersion: string,
	latestVersion?: string,
	notes?: string,
): UpdateCheck {
	if (!latestVersion) {
		return {
			status: 'error',
			currentVersion,
			message: '检查更新失败',
		}
	}
	const latest = latestVersion.replace(/^v/i, '')
	if (compareSemver(latest, currentVersion) <= 0) {
		return {
			status: 'latest',
			currentVersion,
			latestVersion: latest,
			message: '已是最新版本',
		}
	}
	return {
		status: 'available',
		currentVersion,
		latestVersion: latest,
		notes,
		message: `发现新版本 ${latest}`,
	}
}
