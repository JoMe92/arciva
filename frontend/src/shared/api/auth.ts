import { requireBase } from './base'

export type AuthUser = {
  id: string
  email: string
}

async function parseAuthResponse(res: Response): Promise<AuthUser> {
  if (!res.ok) {
    const message = (await res.text().catch(() => '')) || 'Authentication failed'
    throw new Error(message)
  }
  return (await res.json()) as AuthUser
}

export async function signup(payload: { email: string; password: string }): Promise<AuthUser> {
  const res = await fetch(requireBase('/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  return parseAuthResponse(res)
}

export async function login(payload: { email: string; password: string }): Promise<AuthUser> {
  const res = await fetch(requireBase('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  return parseAuthResponse(res)
}

export async function logout(): Promise<void> {
  const res = await fetch(requireBase('/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok && res.status !== 204) {
    const message = (await res.text().catch(() => '')) || 'Failed to log out'
    throw new Error(message)
  }
}

export async function me(): Promise<AuthUser> {
  const res = await fetch(requireBase('/auth/me'), {
    credentials: 'include',
  })
  if (!res.ok) {
    const message = (await res.text().catch(() => '')) || 'Not authenticated'
    throw new Error(message)
  }
  return (await res.json()) as AuthUser
}
