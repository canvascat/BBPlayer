import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, shell } from 'electron'

import { initLogger, getLogFilePath } from './logger/runtime.ts'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function isPackagedApp() {
	try {
		return app.isPackaged
	} catch {
		return false
	}
}

function defaultLogFile() {
	try {
		if (app.isPackaged) {
			return join(app.getPath('userData'), 'logs', 'bbplayer.log')
		}
	} catch {
		// app 尚未 ready
	}
	return join(repoRoot, '.data', 'logs', 'bbplayer.log')
}

export function initDesktopLogger() {
	initLogger({
		defaultFilePath: defaultLogFile(),
		isPackaged: isPackagedApp(),
	})
}

export async function openDesktopLogsFolder() {
	const file = getLogFilePath()
	const dir = dirname(file)
	mkdirSync(dir, { recursive: true })
	if (existsSync(file)) {
		shell.showItemInFolder(file)
		return
	}
	const error = await shell.openPath(dir)
	if (error) throw new Error(error)
}
