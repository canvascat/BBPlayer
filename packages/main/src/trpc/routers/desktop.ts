import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { redact } from '../../logger/redact.ts'
import { getLogger } from '../../logger/runtime.ts'
import { publicProcedure, router } from '../trpc'

export const desktopRouter = router({
	openExternal: publicProcedure
		.input(z.object({ url: z.url() }))
		.mutation(async ({ ctx, input }) => {
			const { protocol } = new URL(input.url)
			if (protocol !== 'http:' && protocol !== 'https:') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: '仅允许 http/https 链接',
				})
			}
			await ctx.openExternal(input.url)
			return true
		}),
	copyText: publicProcedure
		.input(z.object({ text: z.string() }))
		.mutation(({ ctx, input }) => {
			ctx.copyText(input.text)
			return true
		}),
	checkUpdate: publicProcedure.mutation(({ ctx }) => ctx.checkUpdate()),
	reportLog: publicProcedure
		.input(
			z.object({
				level: z.enum(['error', 'warn', 'info', 'debug', 'trace']),
				message: z.string(),
				context: z.record(z.string(), z.unknown()).optional(),
				stack: z.string().optional(),
			}),
		)
		.mutation(({ input }) => {
			const payload = redact({
				...input.context,
				stack: input.stack,
			}) as Record<string, unknown>
			getLogger('renderer')[input.level](payload, input.message)
		}),
	openLogsFolder: publicProcedure.mutation(async ({ ctx }) => {
		await ctx.openLogsFolder()
	}),
})
