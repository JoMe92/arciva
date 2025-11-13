import { withBase } from './base'
import type { ColorLabelValue } from './assets'

export type HubMetadataState = {
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

export type HubAssetProjectRef = {
  project_id: string
  title: string
  linked_at: string
  metadata_state?: HubMetadataState | null
}

export type HubAsset = {
  asset_id: string
  format?: string | null
  mime: string
  width?: number | null
  height?: number | null
  taken_at?: string | null
  created_at: string
  thumb_url?: string | null
  preview_url?: string | null
  projects: HubAssetProjectRef[]
  pair_asset_id?: string | null
}

export type HubProjectSummary = {
  project_id: string
  title: string
  asset_count: number
  last_linked_at?: string | null
}

export type HubDateSummary = {
  date: string
  asset_count: number
}

export type HubAssetsResponse = {
  assets: HubAsset[]
  projects: HubProjectSummary[]
  dates: HubDateSummary[]
}

export async function getImageHubAssets(limit = 240): Promise<HubAssetsResponse> {
  const res = await fetch(withBase(`/v1/image-hub/assets?limit=${limit}`)!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as HubAssetsResponse
}
