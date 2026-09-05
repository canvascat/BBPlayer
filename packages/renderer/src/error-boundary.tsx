import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

import { log } from './logger'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false }

	static getDerivedStateFromError() {
		return { hasError: true }
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		log.error(error.message, {
			stack: error.stack,
			componentStack: info.componentStack,
		})
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6'>
					<p>界面出错了</p>
					<Button
						type='button'
						onClick={() => {
							window.location.reload()
						}}
					>
						重新加载
					</Button>
				</div>
			)
		}
		return this.props.children
	}
}
