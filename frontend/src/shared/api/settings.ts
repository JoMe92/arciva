import { withBase } from './base'

export type MetadataInheritanceMode = 'always' | 'ask' | 'never'

export type ImageHubSettings = {
  metadata_inheritance: MetadataInheritanceMode
}

export type DatabasePathStatus = 'ready' | 'invalid' | 'not_accessible' | 'not_writable'

export type DatabasePathSettings = {
  path: string
  status: DatabasePathStatus
  message?: string | null
  requires_restart: boolean
}

export type ExperimentalStorageRole = 'primary' | 'secondary'
export type ExperimentalStorageStatus = 'available' | 'missing' | 'not_writable'

export type ExperimentalStorageLocation = {
  id: string
  path: string
  role: ExperimentalStorageRole
  status: ExperimentalStorageStatus
  message?: string | null
}

export type ExperimentalStorageSettings = {
  enabled: boolean
  developer_only: boolean
  warning_active: boolean
  last_option?: string | null
  locations: ExperimentalStorageLocation[]
}

export type ExperimentalStorageValidationResult = {
  path: string
  valid: boolean
  message?: string | null
}

export type ExperimentalStorageMode = 'fresh' | 'load'

export async function getImageHubSettings(): Promise<ImageHubSettings> {
  const res = await fetch(withBase('/v1/settings/image-hub')!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubSettings
}

export async function updateImageHubSettings(payload: ImageHubSettings): Promise<ImageHubSettings> {
  const res = await fetch(withBase('/v1/settings/image-hub')!, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubSettings
}

export async function getDatabasePathSettings(): Promise<DatabasePathSettings> {
  const res = await fetch(withBase('/v1/settings/database-path')!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as DatabasePathSettings
}

export async function updateDatabasePath(payload: { path: string }): Promise<DatabasePathSettings> {
  const res = await fetch(withBase('/v1/settings/database-path')!, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as DatabasePathSettings
}

export async function getExperimentalStorageSettings(): Promise<ExperimentalStorageSettings> {
  const res = await fetch(withBase('/v1/settings/photo-store')!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ExperimentalStorageSettings
}

export async function validateExperimentalStoragePath(payload: { path: string; mode?: ExperimentalStorageMode }): Promise<ExperimentalStorageValidationResult> {
  const res = await fetch(withBase('/v1/settings/photo-store/validate')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ExperimentalStorageValidationResult
}

export async function applyExperimentalStorageChange(payload: {
  path: string
  mode: ExperimentalStorageMode
  acknowledge: boolean
}): Promise<ExperimentalStorageSettings> {
  const res = await fetch(withBase('/v1/settings/photo-store/apply')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ExperimentalStorageSettings
}
