import type { DesktopEvents } from './events.ts'

export type TrpcContext = { events: DesktopEvents }

export function createTRPCContext(events: DesktopEvents): TrpcContext {
	return { events }
}
