export function isLibraryPath(pathname: string) {
	return pathname === '/library' || pathname.startsWith('/library/')
}

export function nonMultipageFavorites<T extends { title: string }>(
	folders: T[],
) {
	return folders.filter((folder) => !folder.title.startsWith('[mp]'))
}

export function multipageFavorite<T extends { title: string }>(folders: T[]) {
	return folders.find((folder) => folder.title.startsWith('[mp]'))
}
