import { withBase } from './base'

export type ProjectCreatePayload = {
  title: string
  client?: string
  note?: string
  tags?: string[]
}

export type ProjectApiResponse = {
  id: string
  title: string
  client: string | null
  note: string | null
  tags?: string[] | null
  asset_count: number
  created_at: string
  updated_at: string
  preview_images: ProjectPreviewImageApi[]
  stack_pairs_enabled?: boolean
}

export type ProjectPreviewImageApi = {
  asset_id: string
  thumb_url: string | null
  order: number
  width: number | null
  height: number | null
}

export type ProjectUpdatePayload = {
  title?: string
  client?: string | null
  note?: string | null
  tags?: string[]
  stack_pairs_enabled?: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = withBase(path)
  if (!url) {
    throw new Error(`Failed to resolve API path for ${path}`)
  }
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed with status ${res.status}`)
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

export function listProjects() {
  return request<ProjectApiResponse[]>('/v1/projects')
}

export function createProject(payload: ProjectCreatePayload) {
  return request<ProjectApiResponse>('/v1/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProject(projectId: string, payload: ProjectUpdatePayload) {
  return request<ProjectApiResponse>(`/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteProject(projectId: string, payload: { confirmTitle: string; deleteAssets: boolean }) {
  return request<void>(`/v1/projects/${projectId}`, {
    method: 'DELETE',
    body: JSON.stringify({
      confirm_title: payload.confirmTitle,
      delete_assets: payload.deleteAssets,
    }),
  })
}

export function getProject(projectId: string) {
  return request<ProjectApiResponse>(`/v1/projects/${projectId}`)
}
