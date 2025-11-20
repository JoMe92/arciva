import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './app/App'
import { ThemeProvider, primeTheme } from './shared/theme'
import { registerSW } from 'virtual:pwa-register'

primeTheme()

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('Arciva is ready to work offline.')
    },
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
