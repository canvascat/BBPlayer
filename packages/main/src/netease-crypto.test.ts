import { test, assert } from 'vitest'

import {
	aesEcbEncryptHex,
	eapi,
	eapiDecrypt,
	eapiResDecrypt,
	weapi,
} from './netease-crypto.ts'

test('eapi 请求参数解密后含路径与 JSON 正文', () => {
	const { params } = eapi('/api/song/lyric/v1', { id: 123, yv: -1 })
	assert.match(params, /^[0-9A-F]+$/)
	const plain = eapiDecrypt(params)
	assert.ok(plain.includes('/api/song/lyric/v1'))
	assert.ok(plain.includes('"id":123'))
	assert.ok(plain.includes('"yv":-1'))
})

test('eapi 响应密文可还原 JSON', () => {
	const json = { code: 200, lrc: { lyric: 'hi' } }
	assert.deepEqual(eapiResDecrypt(aesEcbEncryptHex(JSON.stringify(json))), json)
})

test('weapi 产出 params 与 256 位 hex encSecKey', () => {
	const encrypted = weapi({ s: '起风了', type: 1, limit: 10, csrf_token: '' })
	assert.ok(encrypted.params.length > 0)
	assert.match(encrypted.encSecKey, /^[0-9a-f]{256}$/)
})
