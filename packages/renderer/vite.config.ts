import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	input: {
		index: resolve(import.meta.dirname, 'index.html'),
		lyrics: resolve(import.meta.dirname, 'lyrics.html'),
		mini: resolve(import.meta.dirname, 'mini.html'),
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [tailwindcss(), react()],
	clearScreen: false,
})
