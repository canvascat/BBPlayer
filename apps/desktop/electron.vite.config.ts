import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		resolve: {
			alias: {
				'@bbplayer/core': resolve('../../packages/core/src/index.ts'),
				'@bbplayer/player-api': resolve('../../packages/player-api/src/index.ts'),
				'@bbplayer/splash': resolve('../../packages/splash/src/index.ts'),
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
	},
	renderer: {
		resolve: {
			alias: {
				'@': resolve('src/renderer/src'),
				'@bbplayer/core': resolve('../../packages/core/src/index.ts'),
				'@bbplayer/player-api': resolve('../../packages/player-api/src/index.ts'),
				'@bbplayer/splash': resolve('../../packages/splash/src/index.ts'),
			},
		},
		plugins: [react()],
	},
})
