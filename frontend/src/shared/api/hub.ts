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
  camera_model?: string | null
  created_at?: string | null
  thumb_url?: string | null
  preview_url?: string | null
  is_paired?: boolean
  pair_id?: string | null
  rating?: number | null
  label?: ColorLabelValue | null
  projects?: {
    project_id: string
    title: string
    linked_at: string
    metadata_state?: unknown | null
  }[]
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

type LegacyMetadataState = {
  rating?: number | null
  color_label?: ColorLabelValue | null
}

type LegacyHubAssetProjectRef = {
  project_id: string
  title: string
  linked_at: string
  metadata_state?: LegacyMetadataState | null
}

type LegacyHubAsset = {
  asset_id: string
  format?: string | null
  mime: string
  width?: number | null
  height?: number | null
  camera_model?: string | null
  original_filename?: string | null
  taken_at?: string | null
  created_at: string
  thumb_url?: string | null
  preview_url?: string | null
  projects: LegacyHubAssetProjectRef[]
  pair_asset_id?: string | null
}

type LegacyHubProjectSummary = {
  project_id: string
  title: string
  asset_count: number
  last_linked_at?: string | null
}

type LegacyHubDateSummary = {
  date: string
  asset_count: number
}

type LegacyHubAssetsResponse = {
  assets: LegacyHubAsset[]
  projects: LegacyHubProjectSummary[]
  dates: LegacyHubDateSummary[]
}

const LEGACY_FETCH_LIMIT = 2000

let legacyMode = false
let legacyCachePromise: Promise<LegacyHubAssetsResponse> | null = null

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

export async function fetchImageHubProjects(
  params: FetchImageHubProjectParams = {}
): Promise<ImageHubProjectListResponse> {
  if (!legacyMode) {
    const search = buildQueryString({
      query: params.query,
      sort: params.sort,
      cursor: params.cursor,
      limit: params.limit,
    })
    const url = withBase(`/v1/image-hub/projects${search.toString() ? `?${search.toString()}` : ''}`)
    if (!url) throw new Error('Missing API base for ImageHub projects endpoint')
    const res = await fetch(url, { credentials: 'include' })
    if (res.status === 404) {
      legacyMode = true
    } else if (!res.ok) {
      throw new Error(await res.text())
    } else {
      return (await res.json()) as ImageHubProjectListResponse
    }
  }
  return legacyProjectsResponse(params)
}

export async function fetchImageHubAssets(
  params: FetchImageHubAssetsParams
): Promise<ImageHubAssetsPage> {
  const filters = serializeFilters(params.filters)
  if (!legacyMode) {
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
    const url = withBase(`/v1/image-hub/assets${search.toString() ? `?${search.toString()}` : ''}`)
    if (!url) throw new Error('Missing API base for ImageHub assets endpoint')
    const res = await fetch(url, { credentials: 'include' })
    if (res.status === 404) {
      legacyMode = true
    } else if (!res.ok) {
      throw new Error(await res.text())
    } else {
      return (await res.json()) as ImageHubAssetsPage
    }
  }
  return legacyAssetsResponse(params)
}

export async function fetchImageHubAssetStatus(
  assetId: string,
  currentProjectId?: string | null
): Promise<ImageHubAssetStatus> {
  if (!legacyMode) {
    const search = buildQueryString({
      asset_id: assetId,
      current_project_id: currentProjectId ?? undefined,
    })
    const url = withBase(
      `/v1/image-hub/asset-status${search.toString() ? `?${search.toString()}` : ''}`
    )
    if (!url) throw new Error('Missing API base for ImageHub asset status endpoint')
    const res = await fetch(url, { credentials: 'include' })
    if (res.status === 404) {
      legacyMode = true
    } else if (!res.ok) {
      throw new Error(await res.text())
    } else {
      return (await res.json()) as ImageHubAssetStatus
    }
  }
  return legacyAssetStatus(assetId, currentProjectId)
}

async function fetchLegacyHubBundle(limit = LEGACY_FETCH_LIMIT): Promise<LegacyHubAssetsResponse> {
  if (!legacyCachePromise) {
    const url = withBase(`/v1/image-hub/assets?limit=${limit}`)
    if (!url) {
      throw new Error('Missing API base for legacy ImageHub assets endpoint')
    }
    legacyCachePromise = fetch(url, { credentials: 'include' }).then(async (res) => {
      if (!res.ok) {
        legacyCachePromise = null
        throw new Error(await res.text())
      }
      return (await res.json()) as LegacyHubAssetsResponse
    })
  }
  return legacyCachePromise
}

async function legacyProjectsResponse(
  params: FetchImageHubProjectParams = {}
): Promise<ImageHubProjectListResponse> {
  const bundle = await fetchLegacyHubBundle()
  let projects = bundle.projects.map<ImageHubProject>((project) => ({
    project_id: project.project_id,
    name: project.title,
    cover_thumb: null,
    asset_count: project.asset_count,
    updated_at: project.last_linked_at ?? null,
  }))
  const query = params.query?.trim().toLowerCase()
  if (query) {
    projects = projects.filter((project) => project.name.toLowerCase().includes(query))
  }
  projects.sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
    return bTime - aTime
  })
  const offset = parseCursor(params.cursor)
  const limit = clampLimit(params.limit ?? 25, 200)
  const slice = projects.slice(offset, offset + limit)
  const next_cursor = offset + limit < projects.length ? String(offset + limit) : null
  return { projects: slice, next_cursor }
}

async function legacyAssetsResponse(
  params: FetchImageHubAssetsParams
): Promise<ImageHubAssetsPage> {
  const bundle = await fetchLegacyHubBundle()
  if (params.mode === 'project') {
    return legacyAssetsByProject(bundle, params)
  }
  return legacyAssetsByDate(bundle, params)
}

function legacyAssetsByProject(
  bundle: LegacyHubAssetsResponse,
  params: FetchImageHubAssetsParams
): ImageHubAssetsPage {
  if (!params.projectId) {
    return { assets: [], next_cursor: null }
  }
  const offset = parseCursor(params.cursor)
  const limit = clampLimit(params.limit ?? (params.view === 'list' ? 200 : 100), 400)
  const filters = params.filters
  const normalizedAssets = bundle.assets
    .map((asset) => {
      const projectRef = asset.projects.find((proj) => proj.project_id === params.projectId)
      if (!projectRef) return null
      const type = normalizeAssetType(asset.format)
      if (!matchesTypeFilter(type, filters)) return null
      if (!matchesSearchFilter(filters, asset.original_filename)) return null
      if (!matchesDateRangeFilter(asset, filters)) return null
      if (!matchesProjectRatingFilter(projectRef.metadata_state, filters)) return null
      if (!matchesProjectLabelFilter(projectRef.metadata_state, filters)) return null
      const pairId = buildPairId(asset.asset_id, asset.pair_asset_id)
      return {
        record: {
          asset_id: asset.asset_id,
          original_filename: asset.original_filename ?? 'Untitled',
          type,
          width: asset.width,
          height: asset.height,
          created_at: asset.created_at,
          thumb_url: asset.thumb_url,
          preview_url: asset.preview_url,
          is_paired: Boolean(pairId),
          pair_id: pairId,
          rating: projectRef.metadata_state?.rating ?? null,
          label: projectRef.metadata_state?.color_label ?? null,
        } as ImageHubAsset,
        linkedAt: projectRef.linked_at,
      }
    })
    .filter((entry): entry is { record: ImageHubAsset; linkedAt: string } => Boolean(entry))

  normalizedAssets.sort((a, b) => new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime())
  const slice = normalizedAssets.slice(offset, offset + limit)
  const next_cursor = offset + limit < normalizedAssets.length ? String(offset + limit) : null
  return {
    assets: slice.map((entry) => entry.record),
    next_cursor,
  }
}

function legacyAssetsByDate(
  bundle: LegacyHubAssetsResponse,
  params: FetchImageHubAssetsParams
): ImageHubAssetsPage {
  const filters = params.filters
  const filteredAssets = bundle.assets.filter(
    (asset) =>
      matchesTypeFilter(normalizeAssetType(asset.format), filters) &&
      matchesSearchFilter(filters, asset.original_filename) &&
      matchesDateRangeFilter(asset, filters) &&
      matchesAnyRatingFilter(asset, filters) &&
      matchesAnyLabelFilter(asset, filters)
  )

  if (!params.year) {
    return { assets: [], buckets: buildDateBuckets(filteredAssets, 'year') }
  }
  if (params.year && !params.month) {
    return { assets: [], buckets: buildDateBuckets(filteredAssets, 'month', params.year) }
  }
  if (params.year && params.month && !params.day) {
    return {
      assets: [],
      buckets: buildDateBuckets(filteredAssets, 'day', params.year, params.month),
    }
  }

  const offset = parseCursor(params.cursor)
  const limit = clampLimit(params.limit ?? (params.view === 'list' ? 200 : 100), 400)
  const matchingAssets = filteredAssets.filter((asset) =>
    assetMatchesExactDate(asset, params.year!, params.month!, params.day!)
  )

  const enriched = matchingAssets.map<ImageHubAsset>((asset) => {
    const aggregate = aggregateMetadata(asset)
    const pairId = buildPairId(asset.asset_id, asset.pair_asset_id)
    return {
      asset_id: asset.asset_id,
      original_filename: asset.original_filename ?? 'Untitled',
      type: normalizeAssetType(asset.format),
      width: asset.width,
      height: asset.height,
      created_at: asset.created_at,
      thumb_url: asset.thumb_url,
      preview_url: asset.preview_url,
      is_paired: Boolean(pairId),
      pair_id: pairId,
      rating: aggregate.rating,
      label: aggregate.label,
    }
  })

  enriched.sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )
  const slice = enriched.slice(offset, offset + limit)
  const next_cursor = offset + limit < enriched.length ? String(offset + limit) : null
  return { assets: slice, next_cursor }
}

async function legacyAssetStatus(
  assetId: string,
  currentProjectId?: string | null
): Promise<ImageHubAssetStatus> {
  const bundle = await fetchLegacyHubBundle()
  const asset = bundle.assets.find((item) => item.asset_id === assetId)
  if (!asset) {
    return { already_linked: false, other_projects: [] }
  }
  const projectIds = asset.projects.map((proj) => proj.project_id)
  const already_linked = currentProjectId ? projectIds.includes(currentProjectId) : false
  const other_projects = currentProjectId
    ? projectIds.filter((id) => id !== currentProjectId)
    : projectIds
  return { already_linked, other_projects }
}

function parseCursor(cursor?: string | null): number {
  if (!cursor) return 0
  const value = Number(cursor)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function clampLimit(value: number, max: number): number {
  return Math.max(1, Math.min(value, max))
}

function normalizeAssetType(format?: string | null): ImageHubAssetType {
  return (format ?? '').toUpperCase() === 'RAW' ? 'RAW' : 'JPEG'
}

function buildPairId(assetId: string, pairAssetId?: string | null): string | null {
  if (!pairAssetId) return null
  return [assetId, pairAssetId].sort().join(':')
}

function matchesTypeFilter(type: ImageHubAssetType, filters?: ImageHubAssetFilters): boolean {
  if (!filters?.types?.length) return true
  return filters.types.includes(type)
}

function matchesSearchFilter(
  filters: ImageHubAssetFilters | undefined,
  filename?: string | null
): boolean {
  const term = filters?.search?.trim()
  if (!term) return true
  return (filename ?? '').toLowerCase().includes(term.toLowerCase())
}

function getAssetDateMs(asset: LegacyHubAsset): number | null {
  const iso = asset.taken_at ?? asset.created_at
  if (!iso) return null
  const value = new Date(iso).getTime()
  return Number.isFinite(value) ? value : null
}

function matchesDateRangeFilter(asset: LegacyHubAsset, filters?: ImageHubAssetFilters): boolean {
  if (!filters?.dateFrom && !filters?.dateTo) return true
  const value = getAssetDateMs(asset)
  if (value === null) return false
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom).getTime()
    if (Number.isFinite(from) && value < from) return false
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo).getTime()
    if (Number.isFinite(to) && value > to) return false
  }
  return true
}

function matchesProjectRatingFilter(
  metadata: LegacyMetadataState | null | undefined,
  filters?: ImageHubAssetFilters
): boolean {
  if (!filters?.ratings?.length) return true
  const threshold = filters.ratings[0]
  return (metadata?.rating ?? 0) >= threshold
}

function matchesProjectLabelFilter(
  metadata: LegacyMetadataState | null | undefined,
  filters?: ImageHubAssetFilters
): boolean {
  if (!filters?.labels?.length) return true
  const required = filters.labels[0]
  const value = metadata?.color_label ?? 'None'
  return value === required
}

function matchesAnyRatingFilter(asset: LegacyHubAsset, filters?: ImageHubAssetFilters): boolean {
  if (!filters?.ratings?.length) return true
  const threshold = filters.ratings[0]
  return asset.projects.some((proj) => (proj.metadata_state?.rating ?? 0) >= threshold)
}

function matchesAnyLabelFilter(asset: LegacyHubAsset, filters?: ImageHubAssetFilters): boolean {
  if (!filters?.labels?.length) return true
  const label = filters.labels[0]
  return asset.projects.some((proj) => (proj.metadata_state?.color_label ?? 'None') === label)
}

function buildDateBuckets(
  assets: LegacyHubAsset[],
  level: 'year' | 'month' | 'day',
  year?: number,
  month?: number
): ImageHubDateBucket[] {
  const map = new Map<
    string,
    { key: string; year: number; month?: number; day?: number; label: string; asset_count: number }
  >()
  assets.forEach((asset) => {
    const parts = extractDateParts(asset)
    if (!parts) return
    if (level === 'month' && parts.year !== year) return
    if (level === 'day' && (parts.year !== year || parts.month !== month)) return
    const bucketKey = buildBucketKey(parts, level)
    const existing = map.get(bucketKey)
    if (existing) {
      existing.asset_count += 1
      return
    }
    if (level === 'year') {
      map.set(bucketKey, {
        key: bucketKey,
        year: parts.year,
        label: String(parts.year),
        asset_count: 1,
      })
    } else if (level === 'month') {
      map.set(bucketKey, {
        key: bucketKey,
        year: parts.year,
        month: parts.month,
        label: monthLabel(parts.year, parts.month),
        asset_count: 1,
      })
    } else {
      map.set(bucketKey, {
        key: bucketKey,
        year: parts.year,
        month: parts.month,
        day: parts.day,
        label: dayLabel(parts.year, parts.month, parts.day),
        asset_count: 1,
      })
    }
  })

  return Array.from(map.values())
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((item) => ({
      key: item.key,
      year: item.year,
      month: item.month,
      day: item.day,
      label: item.label,
      asset_count: item.asset_count,
    }))
}

function extractDateParts(
  asset: LegacyHubAsset
): { year: number; month: number; day: number } | null {
  const iso = asset.taken_at ?? asset.created_at
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

function buildBucketKey(
  parts: { year: number; month: number; day: number },
  level: 'year' | 'month' | 'day'
) {
  if (level === 'year') return `${parts.year}`
  if (level === 'month') return `${parts.year}-${String(parts.month).padStart(2, '0')}`
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function dayLabel(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function assetMatchesExactDate(
  asset: LegacyHubAsset,
  year: number,
  month: number,
  day: number
): boolean {
  const parts = extractDateParts(asset)
  if (!parts) return false
  return parts.year === year && parts.month === month && parts.day === day
}

function aggregateMetadata(asset: LegacyHubAsset): {
  rating?: number | null
  label?: ColorLabelValue | null
} {
  let rating: number | null = null
  let label: ColorLabelValue | null = null
  asset.projects.forEach((proj) => {
    const meta = proj.metadata_state
    if (!meta) return
    if (typeof meta.rating === 'number') {
      if (rating === null || meta.rating > rating) {
        rating = meta.rating
      }
    }
    if (meta.color_label && meta.color_label !== 'None' && !label) {
      label = meta.color_label
    }
  })
  return { rating, label }
}
