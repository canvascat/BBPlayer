import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/player')({
	component: PlayerPage,
})

function PlayerPage() {
	return null
}
