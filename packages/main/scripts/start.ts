#!/usr/bin/env node
/**
 * 生产启动：假定 pack 已完成，拉起 Electron。
 */
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const mainRoot = dirname(fileURLToPath(new URL('.', import.meta.url)))

const child = spawn('electron', ['.'], {
	cwd: mainRoot,
	stdio: 'inherit',
	env: { ...process.env },
})

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal)
		return
	}
	process.exit(code ?? 0)
})
