import { withBase } from './base'

export type AssetListItem = {
  id: string
  status: string
  thumb_url?: string | null
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

type LinkResponse = {
  linked: number
  duplicates: number
  items: AssetListItem[]
}

export function assetThumbUrl(item: AssetListItem): string | null {
  return withBase(item.thumb_url ?? null)
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
