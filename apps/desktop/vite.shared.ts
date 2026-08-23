import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pkg from './package.json' with { type: 'json' }

export const desktopRoot = dirname(fileURLToPath(import.meta.url))

export const alias = {
	'@': join(desktopRoot, 'src/renderer/src'),
	'@bbplayer/core': join(desktopRoot, '../../packages/core/src/index.ts'),
}

export const external = [
	'electron',
	...Object.keys(pkg.dependencies).filter(
		(name) => !name.startsWith('@bbplayer/'),
	),
]
