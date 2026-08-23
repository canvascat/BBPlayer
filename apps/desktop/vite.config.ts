import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { defineConfig, type Plugin } from 'vite-plus'

import pkg from './package.json' with { type: 'json' }

const root = dirname(fileURLToPath(import.meta.url))
const core = join(root, '../../packages/core/src/index.ts')
const splash = join(root, '../../packages/splash/src/index.ts')
const isProduction = process.env.NODE_ENV === 'production'
const sourcemap = !isProduction || Boolean(process.env.VSCODE_DEBUG)
const alias = {
	'@': join(root, 'src/renderer/src'),
	'@bbplayer/core': core,
	'@bbplayer/splash': splash,
}
const external = Object.keys(pkg.dependencies).filter(
	(name) => !name.startsWith('@bbplayer/'),
)

function cleanElectronDist(): Plugin {
	return {
		name: 'clean-electron-dist',
		configResolved(config) {
			const isDevOrBuild = process.argv.some((arg) =>
				['dev', 'build'].includes(arg),
			)
			if (isDevOrBuild && config.mode !== 'test') {
				rmSync(join(root, 'dist-electron'), { recursive: true, force: true })
			}
		},
	}
}

export default defineConfig({
	root: join(root, 'src/renderer'),
	resolve: { alias },
	server: {
		fs: {
			allow: [join(root, '../..')],
		},
		hmr: {
			protocol: 'ws',
			host: '127.0.0.1',
		},
	},
	plugins: [
		cleanElectronDist(),
		react(),
		electron([
			{
				entry: join(root, 'src/main/index.ts'),
				onstart(args) {
					if (process.env.VSCODE_DEBUG) {
						console.log('[startup] Electron App')
					} else {
						args.startup()
					}
				},
				vite: {
					resolve: { alias },
					build: {
						sourcemap,
						minify: isProduction,
						outDir: join(root, 'dist-electron/main'),
						rolldownOptions: {
							external,
							platform: 'node',
						},
					},
				},
			},
			{
				onstart(args) {
					args.reload()
				},
				vite: {
					build: {
						sourcemap: sourcemap ? 'inline' : undefined,
						minify: isProduction,
						outDir: join(root, 'dist-electron/preload'),
						rolldownOptions: {
							external,
							input: join(root, 'src/preload/index.ts'),
							output: {
								format: 'cjs',
								codeSplitting: false,
								entryFileNames: 'index.cjs',
								chunkFileNames: '[name].cjs',
								assetFileNames: '[name].[ext]',
							},
						},
					},
				},
			},
		]),
	],
	build: {
		outDir: join(root, 'dist'),
		emptyOutDir: true,
		rolldownOptions: {
			input: {
				index: join(root, 'src/renderer/index.html'),
				lyrics: join(root, 'src/renderer/lyrics.html'),
				mini: join(root, 'src/renderer/mini.html'),
			},
		},
	},
	clearScreen: false,
})
