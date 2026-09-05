import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite-plus'

import pkg from './package.json' with { type: 'json' }

const mainRoot = dirname(fileURLToPath(import.meta.url))
const external = [
	'electron',
	...Object.keys(pkg.dependencies).filter(
		(name) => !name.startsWith('@bbplayer/'),
	),
]

const packShared = {
	platform: 'node' as const,
	dts: false,
	sourcemap: true,
	failOnWarn: false,
	deps: {
		neverBundle: external,
		alwaysBundle: ['@bbplayer/core', '@bbplayer/common', 'pino', 'pino-pretty'],
	},
}

export default defineConfig({
	pack: [
		{
			...packShared,
			entry: { main: join(mainRoot, 'src/index.ts') },
			outDir: join(mainRoot, 'dist'),
			format: ['esm'],
			clean: true,
		},
		{
			...packShared,
			entry: { preload: join(mainRoot, 'src/preload.ts') },
			outDir: join(mainRoot, 'dist'),
			format: ['cjs'],
			clean: false,
		},
	],
})
