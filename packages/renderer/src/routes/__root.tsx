import { createRootRoute } from '@tanstack/react-router'

import { AppProvider } from '@/app-context'

import App from '../App'

export const Route = createRootRoute({
	component: RootLayout,
})

function RootLayout() {
	return (
		<AppProvider>
			<App />
		</AppProvider>
	)
}
