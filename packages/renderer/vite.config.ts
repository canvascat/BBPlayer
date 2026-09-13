import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig({
	input: {
		index: resolve(import.meta.dirname, 'index.html'),
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tanstackRouter({
			target: 'react',
			autoCodeSplitting: true,
			quoteStyle: 'single',
			semicolons: false,
		}),
		tailwindcss(),
		react({ compiler: true }),
	],
	clearScreen: false,
})
