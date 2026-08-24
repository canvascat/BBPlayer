import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

const rendererRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	optimizeDeps: {
		exclude: ['@bbplayer/main'],
	},
	server: {
		fs: {
			allow: [join(rendererRoot, '../..')],
		},
	},
	plugins: [react()],
	build: {
		outDir: join(rendererRoot, 'dist'),
		emptyOutDir: true,
		rolldownOptions: {
			input: {
				index: join(rendererRoot, 'index.html'),
				lyrics: join(rendererRoot, 'lyrics.html'),
				mini: join(rendererRoot, 'mini.html'),
			},
		},
	},
	clearScreen: false,
})
