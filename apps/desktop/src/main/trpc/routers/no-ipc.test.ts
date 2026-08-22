import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { test, assert } from 'vitest'

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function walkFiles(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === 'out' || name === 'dist') continue
		const full = join(dir, name)
		if (statSync(full).isDirectory()) walkFiles(full, acc)
		else if (/\.(ts|tsx|js|cjs)$/.test(name)) acc.push(full)
	}
	return acc
}

test('应用层不再使用 ipcMain / ipcRenderer / webContents.send', () => {
	const files = walkFiles(srcRoot)
	const hits: string[] = []
	for (const file of files) {
		if (file.includes('/trpc/routers/no-ipc.test.ts')) continue
		const text = readFileSync(file, 'utf8')
		if (
			/\bipcMain\b/.test(text) ||
			/\bipcRenderer\b/.test(text) ||
			/\bwebContents\.send\b/.test(text) ||
			/\bsendToAux\b/.test(text)
		) {
			hits.push(file.replace(`${srcRoot}/`, ''))
		}
	}
	assert.deepEqual(hits, [])
})
