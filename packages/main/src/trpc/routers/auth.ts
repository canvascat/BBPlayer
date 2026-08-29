import { filter } from 'rxjs'
import { z } from 'zod'

import { generateLoginQr, pollLoginQr, QrStatusCode } from '../../auth'
import { clearWbiCache } from '../../bili'
import { phoneFormModel } from '../../phone-form'
import {
	getPhoneLoginCaptcha,
	loginWithPhoneSms,
	sendPhoneLoginSms,
} from '../../phone-login'
import { cookieFrom } from '../context'
import type { QrUpdate } from '../events'
import { fromObservable } from '../observable'
import { publicProcedure, router } from '../trpc'

let qrTimer: ReturnType<typeof setInterval> | null = null
let qrKey = ''

export function stopQrLogin() {
	stopQr()
}

function stopQr() {
	if (qrTimer) {
		clearInterval(qrTimer)
		qrTimer = null
	}
	qrKey = ''
}

export const authRouter = router({
	me: publicProcedure.query(({ ctx }) => ctx.store.get('account') ?? null),
	refresh: publicProcedure.mutation(({ ctx }) => ctx.refreshAccount()),
	logout: publicProcedure.mutation(async ({ ctx }) => {
		stopQr()
		ctx.store.set('cookie', '')
		ctx.store.set('account', null)
		clearWbiCache()
		await ctx.clearBiliLoginSession()
		return true
	}),
	webStart: publicProcedure.mutation(async ({ ctx }) => {
		const cookieHeader = await ctx.openWebLogin()
		ctx.store.set('cookie', cookieHeader)
		await ctx.refreshAccount()
		return {
			cookie: cookieFrom(ctx.store),
			account: ctx.store.get('account') ?? null,
		}
	}),
	qrCancel: publicProcedure.mutation(() => {
		stopQr()
		return true
	}),
	qrStart: publicProcedure.mutation(async ({ ctx }) => {
		stopQr()
		ctx.events.qr$.next({
			status: 'generating',
			statusText: '正在生成二维码...',
		})
		try {
			const qr = await generateLoginQr()
			qrKey = qr.qrcodeKey
			ctx.events.qr$.next({
				status: 'polling',
				statusText: '等待扫码',
				url: qr.url,
				dataUrl: qr.dataUrl,
			})
			qrTimer = setInterval(() => {
				void (async () => {
					if (!qrKey) return
					try {
						const poll = await pollLoginQr(qrKey)
						if (
							poll.status === QrStatusCode.WAIT ||
							poll.status === QrStatusCode.SCANNED
						) {
							ctx.events.qr$.next({
								status: 'polling',
								statusText: poll.statusText,
								url: qr.url,
								dataUrl: qr.dataUrl,
							})
							return
						}
						if (poll.status === QrStatusCode.EXPIRED) {
							stopQr()
							ctx.events.qr$.next({
								status: 'expired',
								statusText: poll.statusText,
							})
							return
						}
						if (poll.status === QrStatusCode.SUCCESS) {
							stopQr()
							ctx.store.set('cookie', poll.cookie)
							await ctx.refreshAccount()
							ctx.events.qr$.next({
								status: 'success',
								statusText: '登录成功',
							})
						}
					} catch (error) {
						stopQr()
						ctx.events.qr$.next({
							status: 'error',
							statusText:
								error instanceof Error ? error.message : String(error),
						})
					}
				})()
			}, 2000)
			return { url: qr.url, dataUrl: qr.dataUrl }
		} catch (error) {
			ctx.events.qr$.next({
				status: 'error',
				statusText: error instanceof Error ? error.message : String(error),
			})
			throw error
		}
	}),
	qrUpdates: publicProcedure.subscription(({ ctx }) =>
		fromObservable(
			ctx.events.qr$.pipe(filter((value): value is QrUpdate => value !== null)),
		),
	),
	phoneStart: publicProcedure
		.input(z.object({ tel: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const telError = phoneFormModel.tel.validate(input.tel)
			if (telError) throw new Error(telError)
			const captcha = await getPhoneLoginCaptcha()
			const geetest = await ctx.openGeetest({
				gt: captcha.gt,
				challenge: captcha.challenge,
			})
			return sendPhoneLoginSms({
				tel: input.tel,
				token: captcha.token,
				challenge: geetest.challenge,
				validate: geetest.validate,
				seccode: geetest.seccode,
			})
		}),
	phoneLogin: publicProcedure
		.input(
			z.object({
				tel: z.string(),
				code: z.string(),
				captchaKey: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const codeError = phoneFormModel.smsCode.validate(input.code)
			if (codeError) throw new Error(codeError)
			const cookieHeader = await loginWithPhoneSms(input)
			ctx.store.set('cookie', cookieHeader)
			await ctx.refreshAccount()
			return {
				cookie: cookieFrom(ctx.store),
				account: ctx.store.get('account') ?? null,
			}
		}),
	completeGeetest: publicProcedure
		.input(
			z.object({
				validate: z.string(),
				seccode: z.string(),
				challenge: z.string(),
			}),
		)
		.mutation(({ ctx, input }) => {
			ctx.events.geetest$.next(input)
			return true
		}),
})
