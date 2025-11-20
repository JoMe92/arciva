const API_BASE = (() => {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (configuredBase) {
    return configuredBase.replace(/\/+$/, '')
  }
  if (typeof window === 'undefined') {
    return ''
  }
  const apiPort = (import.meta.env.VITE_API_PORT ?? '8000').toString()
  const protocol = window.location.protocol || 'http:'
  const hostname = window.location.hostname || 'localhost'
  const inferredBase = `${protocol}//${hostname}:${apiPort}`
  return inferredBase.replace(/\/+$/, '')
})()

export function withBase(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const trimmedBase = API_BASE.replace(/\/+$/, '')
  const trimmedPath = path.startsWith('/') ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

export function requireBase(path: string): string {
  const result = withBase(path)
  if (!result) {
    throw new Error(`Failed to resolve API path for ${path}`)
  }
  return result
}

export { API_BASE }
