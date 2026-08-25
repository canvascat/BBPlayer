import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	input: {
		index: resolve(import.meta.dirname, 'index.html'),
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [tailwindcss(), react()],
	clearScreen: false,
})
