import { withBase } from './base'
import type { ColorLabelValue } from './assets'

export type ImageHubProject = {
  project_id: string
  name: string
  cover_thumb?: string | null
  asset_count: number
  updated_at?: string | null
}

export type ImageHubProjectListResponse = {
  projects: ImageHubProject[]
  next_cursor?: string | null
}

export type ImageHubAssetType = 'JPEG' | 'RAW'

export type ImageHubAsset = {
  asset_id: string
  original_filename: string
  type: ImageHubAssetType
  width?: number | null
  height?: number | null
  created_at?: string | null
  thumb_url?: string | null
  preview_url?: string | null
  is_paired?: boolean
  pair_id?: string | null
  rating?: number | null
  label?: ColorLabelValue | null
}

export type ImageHubDateBucket = {
  key: string
  year: number
  month?: number | null
  day?: number | null
  label: string
  asset_count: number
}

export type ImageHubAssetsPage = {
  assets: ImageHubAsset[]
  next_cursor?: string | null
  buckets?: ImageHubDateBucket[]
}

export type ImageHubAssetFilters = {
  types?: ImageHubAssetType[]
  ratings?: number[]
  labels?: ColorLabelValue[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export type FetchImageHubProjectParams = {
  query?: string
  sort?: string
  cursor?: string | null
  limit?: number
}

export type FetchImageHubAssetsParams = {
  mode: 'project' | 'date'
  projectId?: string
  year?: number
  month?: number
  day?: number
  cursor?: string | null
  view?: 'grid' | 'list'
  limit?: number
  filters?: ImageHubAssetFilters
}

export type ImageHubAssetStatus = {
  already_linked: boolean
  other_projects: string[]
}

function buildQueryString(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  return search
}

function serializeFilters(filters?: ImageHubAssetFilters) {
  if (!filters) return undefined
  const payload: Record<string, unknown> = {}
  if (filters.types && filters.types.length) payload.types = filters.types
  if (filters.ratings && filters.ratings.length) payload.ratings = filters.ratings
  if (filters.labels && filters.labels.length) payload.labels = filters.labels
  if (filters.dateFrom) payload.dateFrom = filters.dateFrom
  if (filters.dateTo) payload.dateTo = filters.dateTo
  if (filters.search?.trim()) payload.search = filters.search.trim()
  if (!Object.keys(payload).length) return undefined
  return JSON.stringify(payload)
}

export async function fetchImageHubProjects(params: FetchImageHubProjectParams = {}): Promise<ImageHubProjectListResponse> {
  const search = buildQueryString({
    query: params.query,
    sort: params.sort,
    cursor: params.cursor,
    limit: params.limit,
  })
  const url = withBase(`/imagehub/projects${search.toString() ? `?${search.toString()}` : ''}`)
  if (!url) throw new Error('Missing API base for ImageHub projects endpoint')
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubProjectListResponse
}

export async function fetchImageHubAssets(params: FetchImageHubAssetsParams): Promise<ImageHubAssetsPage> {
  const filters = serializeFilters(params.filters)
  const search = buildQueryString({
    mode: params.mode,
    project_id: params.projectId,
    year: params.year,
    month: params.month,
    day: params.day,
    cursor: params.cursor,
    view: params.view,
    limit: params.limit,
  })
  if (filters) {
    search.set('filters', filters)
  }
  const url = withBase(`/imagehub/assets${search.toString() ? `?${search.toString()}` : ''}`)
  if (!url) throw new Error('Missing API base for ImageHub assets endpoint')
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubAssetsPage
}

export async function fetchImageHubAssetStatus(assetId: string, currentProjectId?: string | null): Promise<ImageHubAssetStatus> {
  const search = buildQueryString({
    asset_id: assetId,
    current_project_id: currentProjectId ?? undefined,
  })
  const url = withBase(`/imagehub/asset-status${search.toString() ? `?${search.toString()}` : ''}`)
  if (!url) throw new Error('Missing API base for ImageHub asset status endpoint')
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubAssetStatus
}
