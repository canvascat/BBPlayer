export const phoneFormModel = {
	tel: {
		validate(value: string) {
			const trimmed = value.trim()
			if (!trimmed) return '请输入手机号'
			if (!/^\d{5,15}$/.test(trimmed)) return '手机号格式不正确'
			return ''
		},
	},
	smsCode: {
		validate(value: string) {
			const trimmed = value.trim()
			if (!trimmed) return '请输入验证码'
			if (!/^\d{4,8}$/.test(trimmed)) return '验证码格式不正确'
			return ''
		},
	},
}

export function phoneLoginError(
	json: { code: number; message?: string },
	fallback: string,
) {
	if (json.code === 86211 || json.code === -105) {
		return '图形验证已过期，请重新获取验证码'
	}
	return json.message || fallback
}
