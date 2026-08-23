export interface BbplayerAccount {
	id: string
	username: string
	name: string
	face: string | null
}

export function validateCredentials(username: string, password: string) {
	if (!username.trim() || password.length < 8) {
		return '用户名不能为空，密码至少 8 位'
	}
	return ''
}

export function mapAuthError(
	status: number,
	body: { error?: string; summary?: string } | null,
	fallback: string,
) {
	if (body?.error === 'username_already_exists') return '用户名已被占用'
	if (body?.error === 'invalid_credentials') return '用户名或密码错误'
	if (status === 401) return '请先登录 BBPlayer 账号'
	if (status === 404) {
		if (body?.error === 'account_not_found') return '请先登录 BBPlayer 账号'
		return '共享歌单不存在或已删除'
	}
	if (status === 403) return '共享歌单已被删除或无权限访问'
	if (body?.summary) return body.summary
	if (body?.error) return body.error
	return fallback
}
