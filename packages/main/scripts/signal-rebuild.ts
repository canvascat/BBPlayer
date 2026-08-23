#!/usr/bin/env node
/**
 * 通知桌面开发编排进程：main/preload 已重新打包。
 * 期望环境变量：BBPLAYER_DESKTOP_DEV_PID=<编排进程 pid>
 */
const pid = Number(process.env.BBPLAYER_DESKTOP_DEV_PID)
if (!Number.isInteger(pid) || pid <= 0) {
	process.exit(0)
}

try {
	process.kill(pid, 'SIGUSR2')
} catch {
	// 编排进程已退出 — 忽略
}
