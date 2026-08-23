#!/usr/bin/env node
/**
 * 桌面开发编排：渲染进程 Vite + vp pack --watch + Electron。
 * 退出应用或 Ctrl-C 时关掉本脚本拉起的全部进程。
 */
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseViteLocalUrl } from '../src/vite-local-url.ts'

const mainRoot = dirname(fileURLToPath(new URL('.', import.meta.url)))
const rendererRoot = join(mainRoot, '../renderer')
const DEBOUNCE_MS = 400
const WEB_READY_TIMEOUT_MS = 60_000
const useProcessGroups = process.platform !== 'win32'
const electronBin = createRequire(import.meta.url)('electron') as string

let webUrl: string | null = null
let webChild: ChildProcess | null = null
let packChild: ChildProcess | null = null
let electronChild: ChildProcess | null = null
let shuttingDown = false
let restartingElectron = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function log(message: string): void {
	console.log(`[main:dev] ${message}`)
}

function envWithoutFspy(
	base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env = { ...base }
	delete env.FSPY
	delete env.FSPY_PAYLOAD
	delete env.LD_PRELOAD
	return env
}

function spawnChild(
	command: string,
	args: string[],
	options: SpawnOptions = {},
): ChildProcess {
	const child = spawn(command, args, {
		stdio: 'inherit',
		env: process.env,
		detached: useProcessGroups,
		...options,
	})
	child.on('error', (error) => {
		console.error(`[main:dev] failed to spawn ${command}:`, error)
		void cleanup(1)
	})
	return child
}

function waitForExit(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) {
		return Promise.resolve()
	}
	return new Promise((resolve) => {
		child.once('exit', () => resolve())
	})
}

async function stopChild(
	child: ChildProcess | null,
	signal: NodeJS.Signals = 'SIGTERM',
): Promise<void> {
	if (
		!child?.pid ||
		child.killed ||
		child.exitCode !== null ||
		child.signalCode !== null
	) {
		return
	}

	const pid = child.pid
	const exited = waitForExit(child)
	try {
		if (useProcessGroups) {
			process.kill(-pid, signal)
		} else {
			child.kill(signal)
		}
	} catch {
		try {
			child.kill(signal)
		} catch {
			// 仍等 exit
		}
	}

	const forceTimer = setTimeout(() => {
		try {
			if (child.exitCode === null && child.signalCode === null) {
				if (useProcessGroups) {
					process.kill(-pid, 'SIGKILL')
				} else {
					child.kill('SIGKILL')
				}
			}
		} catch {
			// ignore
		}
	}, 3_000)

	await exited
	clearTimeout(forceTimer)
}

function startWebAndWaitForUrl(): Promise<string> {
	const urlOverride = process.env.VITE_DEV_SERVER_URL?.trim() || null
	log(
		urlOverride
			? `starting renderer (VITE_DEV_SERVER_URL=${urlOverride})`
			: 'starting renderer; waiting for Vite Local URL',
	)

	return new Promise((resolve, reject) => {
		const child = spawn('vp', ['dev'], {
			cwd: rendererRoot,
			env: process.env,
			detached: useProcessGroups,
			stdio: ['inherit', 'pipe', 'pipe'],
		})
		webChild = child

		let settled = false
		const timer = setTimeout(() => {
			if (!settled) {
				reject(
					new Error(
						`renderer did not print a Local URL within ${WEB_READY_TIMEOUT_MS}ms`,
					),
				)
			}
		}, WEB_READY_TIMEOUT_MS)

		const settle = (url: string) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			log(`renderer is ready at ${url}`)
			resolve(url)
		}

		const onChunk = (buf: Buffer, stream: NodeJS.WriteStream) => {
			stream.write(buf)
			if (settled) return
			const parsed = parseViteLocalUrl(buf.toString('utf8'))
			if (!parsed) return
			settle(urlOverride ?? parsed)
		}

		child.stdout?.on('data', (buf: Buffer) => onChunk(buf, process.stdout))
		child.stderr?.on('data', (buf: Buffer) => onChunk(buf, process.stderr))
		child.on('error', (error) => {
			clearTimeout(timer)
			if (!settled) reject(error)
		})
	})
}

function scheduleElectronRestart(): void {
	if (shuttingDown) return
	if (debounceTimer) clearTimeout(debounceTimer)
	debounceTimer = setTimeout(() => {
		debounceTimer = null
		void restartElectron()
	}, DEBOUNCE_MS)
}

async function restartElectron(): Promise<void> {
	if (shuttingDown) return
	if (process.env.VSCODE_DEBUG) {
		log('[startup] Electron App')
		return
	}
	if (!webUrl) {
		log('skip Electron start: renderer URL not ready')
		return
	}

	restartingElectron = true
	try {
		if (electronChild) {
			log('restarting Electron')
			const previous = electronChild
			electronChild = null
			await stopChild(previous)
		} else {
			log('starting Electron')
		}

		if (shuttingDown) return

		electronChild = spawnChild(electronBin, ['.'], {
			cwd: mainRoot,
			env: {
				...envWithoutFspy(),
				NODE_ENV: process.env.NODE_ENV ?? 'development',
				VITE_DEV_SERVER_URL: `${webUrl}/`,
			},
		})

		electronChild.once('exit', (code, signal) => {
			electronChild = null
			if (restartingElectron || shuttingDown) return
			log(`Electron exited code=${code} signal=${signal}`)
			void cleanup(0)
		})
	} finally {
		setTimeout(() => {
			restartingElectron = false
		}, 100)
	}
}

async function cleanup(exitCode = 0): Promise<void> {
	if (shuttingDown) return
	shuttingDown = true
	if (debounceTimer) {
		clearTimeout(debounceTimer)
		debounceTimer = null
	}

	log('shutting down dev processes')
	await Promise.all([
		stopChild(electronChild),
		stopChild(packChild),
		stopChild(webChild),
	])
	electronChild = null
	packChild = null
	webChild = null
	process.exit(exitCode)
}

async function main(): Promise<void> {
	process.env.BBPLAYER_DESKTOP_DEV_PID = String(process.pid)

	process.on('SIGINT', () => void cleanup(0))
	process.on('SIGTERM', () => void cleanup(0))
	process.on('SIGUSR2', () => {
		scheduleElectronRestart()
	})

	webUrl = await startWebAndWaitForUrl()
	webChild?.once('exit', (code, signal) => {
		if (shuttingDown) return
		log(`renderer exited unexpectedly code=${code} signal=${signal}`)
		void cleanup(code ?? 1)
	})

	log('starting pack --watch')
	packChild = spawnChild(
		'vp',
		['pack', '--watch', '--on-success', 'node ./scripts/signal-rebuild.ts'],
		{
			cwd: mainRoot,
			env: {
				...process.env,
				BBPLAYER_DESKTOP_DEV_PID: String(process.pid),
			},
		},
	)
	packChild.once('exit', (code, signal) => {
		if (shuttingDown) return
		log(`pack exited unexpectedly code=${code} signal=${signal}`)
		void cleanup(code ?? 1)
	})
}

main().catch((error: unknown) => {
	console.error('[main:dev]', error)
	void cleanup(1)
})
