import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './app/App'
import { ThemeProvider, primeTheme } from './shared/theme'

primeTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
