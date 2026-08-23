import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite-plus'

import { alias, desktopRoot, external } from './vite.shared.ts'

const packShared = {
	platform: 'node' as const,
	dts: false,
	sourcemap: true,
	failOnWarn: false,
	deps: {
		neverBundle: external,
		alwaysBundle: ['@bbplayer/core'],
	},
}

function cleanElectronDist(): Plugin {
	return {
		name: 'clean-electron-dist',
		configResolved(config) {
			const isDevOrBuild = process.argv.some((arg) =>
				['dev', 'build'].includes(arg),
			)
			if (isDevOrBuild && config.mode !== 'test') {
				rmSync(join(desktopRoot, 'dist-electron'), {
					recursive: true,
					force: true,
				})
			}
		},
	}
}

function packElectronOnBuild(): Plugin {
	return {
		name: 'pack-electron-on-build',
		apply: 'build',
		async closeBundle() {
			if (process.env.VITEST || process.env.BBPLAYER_PACKING_ELECTRON) {
				return
			}
			process.env.BBPLAYER_PACKING_ELECTRON = '1'
			const result = spawnSync('vp', ['pack'], {
				cwd: desktopRoot,
				stdio: 'inherit',
				env: process.env,
			})
			if (result.status) {
				throw new Error(`vp pack exited with ${result.status}`)
			}
		},
	}
}

export default defineConfig({
	root: join(desktopRoot, 'src/renderer'),
	resolve: { alias },
	server: {
		fs: {
			allow: [join(desktopRoot, '../..')],
		},
		hmr: {
			protocol: 'ws',
			host: '127.0.0.1',
		},
	},
	plugins: [cleanElectronDist(), react(), packElectronOnBuild()],
	build: {
		outDir: join(desktopRoot, 'dist'),
		emptyOutDir: true,
		rolldownOptions: {
			input: {
				index: join(desktopRoot, 'src/renderer/index.html'),
				lyrics: join(desktopRoot, 'src/renderer/lyrics.html'),
				mini: join(desktopRoot, 'src/renderer/mini.html'),
			},
		},
	},
	clearScreen: false,
	pack: [
		{
			...packShared,
			entry: { index: join(desktopRoot, 'src/main/index.ts') },
			outDir: join(desktopRoot, 'dist-electron/main'),
			format: ['esm'],
			clean: true,
		},
		{
			...packShared,
			entry: { index: join(desktopRoot, 'src/preload/index.ts') },
			outDir: join(desktopRoot, 'dist-electron/preload'),
			format: ['cjs'],
			clean: false,
		},
	],
})
