import { withBase } from './base'

export type AssetStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'DUPLICATE'
  | 'MISSING_SOURCE'
  | 'ERROR'

export type AssetListItem = {
  id: string
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
  storage_key?: string | null
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
}

type LinkResponse = {
  linked: number
  duplicates: number
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

export async function linkAssetsToProject(projectId: string, assetIds: string[]): Promise<LinkResponse> {
  const res = await fetch(withBase(`/v1/projects/${projectId}/assets:link`)!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ asset_ids: assetIds }),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as LinkResponse
}

export async function getAsset(assetId: string): Promise<AssetDetail> {
  const res = await fetch(withBase(`/v1/assets/${assetId}`)!, {
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
  options: { makePrimary?: boolean } = {},
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
