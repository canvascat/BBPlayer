import { createRootRoute } from '@tanstack/react-router'

import { AppProvider } from '@/app-context'
import { ErrorBoundary } from '@/error-boundary'

import App from '../App'

export const Route = createRootRoute({
	component: RootLayout,
})

function RootLayout() {
	return (
		<ErrorBoundary>
			<AppProvider>
				<App />
			</AppProvider>
		</ErrorBoundary>
	)
}
