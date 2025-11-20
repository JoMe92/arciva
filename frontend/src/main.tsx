import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './app/App'
import { ThemeProvider, primeTheme } from './shared/theme'

primeTheme()

if (typeof window !== 'undefined') {
  const shouldEnableSw =
    import.meta.env.PROD ||
    import.meta.env.ENABLE_PWA_DEV === 'true' ||
    import.meta.env.VITE_ENABLE_PWA_DEV === 'true'

  if (shouldEnableSw) {
    import(/* @vite-ignore */ 'virtual:pwa-register')
      .then(({ registerSW }) => {
        registerSW({
          immediate: true,
          onOfflineReady() {
            console.info('Arciva is ready to work offline.')
          },
        })
      })
      .catch((error) => {
        console.warn('Failed to register service worker', error)
      })
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
