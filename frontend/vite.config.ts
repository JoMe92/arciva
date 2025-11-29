import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const manifest = JSON.parse(
  readFileSync(new URL('./public/manifest.webmanifest', import.meta.url), 'utf-8')
)

const resolveKeyPath = (value?: string) => {
  if (!value) return undefined
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enableHttps = env.DEV_SERVER_HTTPS === 'true' || env.DEV_SERVER_HTTPS === '1'
  const httpsKeyPath = resolveKeyPath(env.DEV_SERVER_HTTPS_KEY)
  const httpsCertPath = resolveKeyPath(env.DEV_SERVER_HTTPS_CERT)
  const https =
    enableHttps && httpsKeyPath && httpsCertPath
      ? {
          key: readFileSync(httpsKeyPath),
          cert: readFileSync(httpsCertPath),
        }
      : enableHttps
        ? true
        : undefined

  const enableDevSw =
    mode === 'development' && (env.ENABLE_PWA_DEV === 'true' || env.VITE_ENABLE_PWA_DEV === 'true')

  const plugins = [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest,
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'arciva-pages',
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'style' || request.destination === 'script',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'arciva-assets',
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/icons/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'arciva-icons',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: enableDevSw,
        suppressWarnings: true,
        navigateFallback: 'index.html',
      },
    }),
  ]

  return {
    plugins,
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      https,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
      https,
    },
  }
})
