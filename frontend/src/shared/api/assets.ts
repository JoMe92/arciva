import { withBase } from './base'

export type AssetStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'DUPLICATE'
  | 'MISSING_SOURCE'
  | 'ERROR'

export type ColorLabelValue = 'None' | 'Red' | 'Green' | 'Blue' | 'Yellow' | 'Purple'

export type AssetListItem = {
  id: string
  link_id: string
  status: AssetStatus
  thumb_url?: string | null
  preview_url?: string | null
  original_filename?: string | null
  size_bytes?: number | null
  taken_at?: string | null
  metadata_warnings?: string[]
  queued_at?: string | null
  processing_started_at?: string | null
  completed_at?: string | null
  last_error?: string | null
  width?: number | null
  height?: number | null
  is_preview?: boolean
  preview_order?: number | null
  basename?: string | null
  pair_id?: string | null
  pair_role?: 'JPEG' | 'RAW' | null
  paired_asset_id?: string | null
  paired_asset_type?: 'JPEG' | 'RAW' | null
  stack_primary_asset_id?: string | null
  rating?: number
  color_label?: ColorLabelValue
  picked?: boolean
  rejected?: boolean
  metadata_state_id?: string | null
  metadata_source_project_id?: string | null
  metadata_state?: MetadataState | null
}

export type AssetDerivative = {
  variant: string
  width: number
  height: number
  url: string
}

export type AssetDetail = {
  id: string
  status: AssetStatus
  original_filename: string
  mime: string
  size_bytes: number
  width?: number | null
  height?: number | null
  taken_at?: string | null
  storage_uri?: string | null
  sha256?: string | null
  reference_count: number
  queued_at?: string | null
  processing_started_at?: string | null
  completed_at?: string | null
  last_error?: string | null
  metadata_warnings?: string[]
  thumb_url?: string | null
  preview_url?: string | null
  derivatives: AssetDerivative[]
  metadata?: Record<string, unknown> | null
  rating?: number
  color_label?: ColorLabelValue
  picked?: boolean
  rejected?: boolean
  metadata_state?: MetadataState | null
  format?: string | null
  pixel_format?: string | null
  pixel_hash?: string | null
  projects?: AssetProjectUsage[] | null
}

export type MetadataState = {
  id: string
  link_id: string
  project_id: string
  rating: number
  color_label: ColorLabelValue
  picked: boolean
  rejected: boolean
  edits?: Record<string, unknown> | null
  source_project_id?: string | null
  created_at: string
  updated_at: string
}

export type AssetProjectUsage = {
  project_id: string
  name: string
  cover_thumb?: string | null
  last_modified?: string | null
  preview_image_url?: string | null
  last_updated_label?: string | null
  is_current_project?: boolean
}

type LinkResponse = {
  linked: number
  duplicates: number
  items: AssetListItem[]
}

export type AssetInteractionUpdateResponse = {
  items: AssetListItem[]
}

export function assetThumbUrl(item: AssetListItem): string | null {
  return withBase(item.thumb_url ?? null)
}

export function assetPreviewUrl(item: AssetListItem): string | null {
  const candidate = item.preview_url ?? item.thumb_url ?? null
  return withBase(candidate)
}

export async function listProjectAssets(projectId: string): Promise<AssetListItem[]> {
  const res = await fetch(withBase(`/v1/projects/${projectId}/assets`)!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetListItem[]
}

export async function linkAssetsToProject(
  projectId: string,
  payload: { assetIds: string[]; inheritance?: Record<string, string | null | undefined> }
): Promise<LinkResponse> {
  const body: Record<string, unknown> = { asset_ids: payload.assetIds }
  if (payload.inheritance) {
    const entries = Object.entries(payload.inheritance).filter(
      ([, value]) => typeof value === 'string' && value
    )
    if (entries.length) {
      body.inheritance = Object.fromEntries(entries)
    }
  }
  const res = await fetch(withBase(`/v1/projects/${projectId}/assets:link`)!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as LinkResponse
}

export async function getAsset(
  assetId: string,
  options: { projectId?: string } = {}
): Promise<AssetDetail> {
  const query = options.projectId ? `?project_id=${encodeURIComponent(options.projectId)}` : ''
  const res = await fetch(withBase(`/v1/assets/${assetId}${query}`)!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetDetail
}

export async function updateAssetPreview(
  projectId: string,
  assetId: string,
  isPreview: boolean,
  options: { makePrimary?: boolean } = {}
): Promise<AssetListItem> {
  const res = await fetch(withBase(`/v1/projects/${projectId}/assets/${assetId}/preview`)!, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ is_preview: isPreview, make_primary: Boolean(options.makePrimary) }),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetListItem
}

export async function updateAssetInteractions(
  projectId: string,
  payload: {
    assetIds: string[]
    rating?: number
    colorLabel?: ColorLabelValue
    picked?: boolean
    rejected?: boolean
  }
): Promise<AssetInteractionUpdateResponse> {
  if (!payload.assetIds.length) {
    throw new Error('At least one asset id is required')
  }
  const body: Record<string, unknown> = {
    asset_ids: payload.assetIds,
  }
  if (typeof payload.rating === 'number') body.rating = payload.rating
  if (typeof payload.colorLabel === 'string') body.color_label = payload.colorLabel
  if (typeof payload.picked === 'boolean') body.picked = payload.picked
  if (typeof payload.rejected === 'boolean') body.rejected = payload.rejected

  const res = await fetch(withBase(`/v1/projects/${projectId}/assets/interactions:apply`)!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetInteractionUpdateResponse
}

export async function listAssetProjects(assetId: string): Promise<AssetProjectUsage[]> {
  const res = await fetch(withBase(`/v1/assets/${assetId}/projects`)!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetProjectUsage[]
}

export type LoadMetadataFromProjectPayload = {
  assetId: string
  sourceProjectId: string
  targetProjectId: string
}

export type LoadMetadataFromProjectResponse = {
  asset: AssetListItem
  metadata_state: MetadataState
}

export async function loadMetadataFromProject(
  payload: LoadMetadataFromProjectPayload
): Promise<LoadMetadataFromProjectResponse> {
  const res = await fetch(withBase(`/v1/imagehub/asset/${payload.assetId}/load-metadata`)!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      source_project_id: payload.sourceProjectId,
      target_project_id: payload.targetProjectId,
    }),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as LoadMetadataFromProjectResponse
}

export type QuickFixCropSettingsPayload = {
  aspect_ratio?: number | string | null
  rotation?: number | null
}

export type QuickFixExposureSettingsPayload = {
  exposure?: number | null
  contrast?: number | null
  highlights?: number | null
  shadows?: number | null
}

export type QuickFixColorSettingsPayload = {
  temperature?: number | null
  tint?: number | null
}

export type QuickFixGrainSettingsPayload = {
  amount?: number | null
  size?: 'fine' | 'medium' | 'coarse'
}

export type QuickFixGeometrySettingsPayload = {
  vertical?: number | null
  horizontal?: number | null
}

export type QuickFixAdjustmentsPayload = {
  crop?: QuickFixCropSettingsPayload | null
  exposure?: QuickFixExposureSettingsPayload | null
  color?: QuickFixColorSettingsPayload | null
  grain?: QuickFixGrainSettingsPayload | null
  geometry?: QuickFixGeometrySettingsPayload | null
  // New v0.3.0
  curves?: any | null // Simplified for shared type, ideally strict
  hsl?: any | null
  splitToning?: any | null
  vignette?: any | null
  sharpen?: any | null
  clarity?: any | null
  dehaze?: any | null
  denoise?: any | null
  distortion?: any | null
}

export async function previewQuickFix(
  assetId: string,
  payload: QuickFixAdjustmentsPayload,
  options: { signal?: AbortSignal } = {}
): Promise<Blob> {
  const res = await fetch(withBase(`/v1/assets/${assetId}/quick-fix/preview`)!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload ?? {}),
    signal: options.signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return await res.blob()
}

export async function saveQuickFixAdjustments(
  projectId: string,
  assetId: string,
  payload: QuickFixAdjustmentsPayload
): Promise<AssetDetail> {
  const res = await fetch(
    withBase(`/v1/projects/${projectId}/assets/${assetId}/quick-fix`)!,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload ?? {}),
    }
  )
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetDetail
}

export type QuickFixBatchApplyPayload = {
  assetIds: string[]
  autoExposure?: boolean
  autoWhiteBalance?: boolean
  autoCrop?: boolean
}

export async function applyQuickFixBatch(
  projectId: string,
  payload: QuickFixBatchApplyPayload
): Promise<AssetInteractionUpdateResponse> {
  const body = {
    asset_ids: payload.assetIds,
    auto_exposure: payload.autoExposure,
    auto_white_balance: payload.autoWhiteBalance,
    auto_crop: payload.autoCrop,
  }
  const res = await fetch(
    withBase(`/v1/projects/${projectId}/assets/quick-fix:apply`)!,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as AssetInteractionUpdateResponse
}
