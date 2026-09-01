import {
	constants,
	createCipheriv,
	createDecipheriv,
	createHash,
	publicEncrypt,
} from 'node:crypto'

const iv = '0102030405060708'
const presetKey = '0CoJUm6Qyw8W8jud'
const base62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`
const eapiKey = 'e82ckenh8dichen8'

function aesCbcEncryptBase64(text: string, key: string) {
	const cipher = createCipheriv('aes-128-cbc', key, iv)
	return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString(
		'base64',
	)
}

export function aesEcbEncryptHex(text: string) {
	const cipher = createCipheriv('aes-128-ecb', eapiKey, null)
	return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
		.toString('hex')
		.toUpperCase()
}

export function eapiDecrypt(hex: string) {
	const decipher = createDecipheriv('aes-128-ecb', eapiKey, null)
	return Buffer.concat([
		decipher.update(Buffer.from(hex, 'hex')),
		decipher.final(),
	]).toString('utf8')
}

function rsaEncrypt(text: string) {
	const buffer = Buffer.from(text)
	const padded = Buffer.concat([Buffer.alloc(128 - buffer.length), buffer])
	return publicEncrypt(
		{ key: publicKey, padding: constants.RSA_NO_PADDING },
		padded,
	).toString('hex')
}

function randomSecretKey() {
	let secretKey = ''
	for (let i = 0; i < 16; i++) {
		secretKey += base62.charAt(Math.round(Math.random() * 61))
	}
	return secretKey
}

export function weapi(object: object): { params: string; encSecKey: string } {
	const text = JSON.stringify(object)
	const secretKey = randomSecretKey()
	return {
		params: aesCbcEncryptBase64(
			aesCbcEncryptBase64(text, presetKey),
			secretKey,
		),
		encSecKey: rsaEncrypt(secretKey.split('').toReversed().join('')),
	}
}

export function eapi(url: string, object: object | string): { params: string } {
	const text = typeof object === 'object' ? JSON.stringify(object) : object
	const message = `nobody${url}use${text}md5forencrypt`
	const digest = createHash('md5').update(message).digest('hex')
	const data = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
	return { params: aesEcbEncryptHex(data) }
}

export function eapiResDecrypt(encryptedParams: string) {
	try {
		return JSON.parse(eapiDecrypt(encryptedParams)) as unknown
	} catch {
		return null
	}
}
