import { TRPCError } from '@trpc/server'
import { z } from 'zod'

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
})
