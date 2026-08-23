import './lyrics.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import LyricsApp from './LyricsApp'

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<LyricsApp />
	</StrictMode>,
)
