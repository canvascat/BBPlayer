import { assert, test } from 'vitest'

import { redact } from './redact.ts'

test('对象键 cookie 与 musicAiApiKey 被替换', () => {
	assert.deepEqual(
		redact({ cookie: 'SESSDATA=abc', musicAiApiKey: 'sk-1', title: '歌' }),
		{ cookie: '[redacted]', musicAiApiKey: '[redacted]', title: '歌' },
	)
})

test('嵌套对象与数组被递归处理', () => {
	assert.deepEqual(
		redact({ wrap: { SESSDATA: 'x' }, list: [{ bili_jct: 'y' }] }),
		{
			wrap: { SESSDATA: '[redacted]' },
			list: [{ bili_jct: '[redacted]' }],
		},
	)
})

test('字符串里的 Cookie 片段被替换', () => {
	const out = redact('SESSDATA=secret; bili_jct=tok; other=1')
	assert.equal(typeof out, 'string')
	assert.ok(String(out).includes('SESSDATA=[redacted]'))
	assert.ok(String(out).includes('bili_jct=[redacted]'))
	assert.ok(String(out).includes('other=1'))
	assert.ok(!String(out).includes('secret'))
})

test('Error.stack 中的 Cookie 被替换', () => {
	const err = new Error('oops')
	err.stack = 'Error: oops\n    at foo (SESSDATA=secret)'
	const out = redact(err)
	assert.ok(out instanceof Error)
	assert.ok(String(out.stack).includes('SESSDATA=[redacted]'))
	assert.ok(!String(out.stack).includes('SESSDATA=secret'))
})

test('循环引用对象不抛错', () => {
	const obj: Record<string, unknown> = { title: '歌' }
	obj.self = obj
	const out = redact(obj) as Record<string, unknown>
	assert.equal(out.title, '歌')
	assert.equal(out.self, '[Circular]')
})
