import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assert, test } from 'vitest'

const src = dirname(fileURLToPath(import.meta.url))

function read(name: string) {
	return readFileSync(join(src, name), 'utf8')
}

test('main.tsx 在 createRoot 之前安装全局错误处理', () => {
	const text = read('main.tsx')
	const installAt = text.indexOf('installRendererErrorHandlers()')
	const createAt = text.indexOf('createRoot(')
	assert.ok(installAt >= 0, '应调用 installRendererErrorHandlers')
	assert.ok(createAt >= 0, '应调用 createRoot')
	assert.ok(installAt < createAt, '全局错误处理须在 createRoot 之前')
})

test('__root.tsx 用 ErrorBoundary 包裹 AppProvider', () => {
	const text = read('routes/__root.tsx')
	assert.match(text, /<ErrorBoundary>/)
	assert.match(text, /<AppProvider>/)
	assert.ok(
		text.indexOf('<ErrorBoundary>') < text.indexOf('<AppProvider>'),
		'ErrorBoundary 应包在 AppProvider 外层',
	)
})

test('app-context 从 settings.get 读取 logLevel / logPath 并持久化级别', () => {
	const text = read('app-context.tsx')
	assert.match(text, /setLogLevelState\(settings\.logLevel \?\? 'warn'\)/)
	assert.match(text, /setLogPath\(settings\.logPath \?\? ''\)/)
	assert.match(text, /settings\.set\.mutate\(\{ logLevel/)
	assert.match(text, /logLevel,/)
	assert.match(text, /logPath,/)
	assert.match(text, /setLogLevel:/)
})

test('设置页诊断区文案与打开日志目录按钮', () => {
	const text = read('routes/settings.tsx')
	assert.match(text, /<FieldLegend variant='label'>诊断<\/FieldLegend>/)
	assert.match(text, /启动时设置了 BBPLAYER_LOG_LEVEL 则以环境变量为准。/)
	assert.match(text, /在文件夹中显示/)
	assert.match(text, /trpcClient\.desktop\.openLogsFolder\.mutate\(\)/)
	assert.match(text, /setSaved\('已打开日志目录'\)/)
	const fieldSetAt = text.indexOf(
		"<FieldLegend variant='label'>诊断</FieldLegend>",
	)
	const checkUpdateAt = text.indexOf('检查更新')
	assert.ok(fieldSetAt >= 0 && checkUpdateAt >= 0)
	assert.ok(fieldSetAt < checkUpdateAt, '诊断 FieldSet 应在检查更新之前')
})
