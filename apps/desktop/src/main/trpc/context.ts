import type { DesktopEvents } from './events'

export type TrpcContext = { events: DesktopEvents }

export function createTRPCContext(events: DesktopEvents): TrpcContext {
	return { events }
}
