import { startTrpcDevServer } from './server'

const port = Number(process.env.PORT) || 4000
const { url } = await startTrpcDevServer({ port })

console.log(`BBPlayer tRPC Panel  ${url}`)
console.log(`tRPC                 ${url}/trpc`)
if (process.env.BILI_COOKIE?.trim()) {
	console.log('已从 BILI_COOKIE 注入登录态')
} else {
	console.log('未设置 BILI_COOKIE，需登录的 bili.* 接口会失败')
}
