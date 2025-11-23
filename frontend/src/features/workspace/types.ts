import type { PlaceholderRatio } from '../../shared/placeholder'
import type { AssetStatus } from '../../shared/api/assets'

export type ImgType = 'JPEG' | 'RAW'
export type ColorTag = 'None' | 'Red' | 'Green' | 'Blue' | 'Yellow' | 'Purple'

export type Photo = {
  id: string
  name: string
  basename?: string | null
  type: ImgType
  date: string | null // Effective date used for grouping
  capturedAt?: string | null
  uploadedAt?: string | null
  rating: 0 | 1 | 2 | 3 | 4 | 5
  picked: boolean
  rejected: boolean
  tag: ColorTag
  status: AssetStatus
  thumbSrc?: string | null
  previewSrc?: string | null
  placeholderRatio: PlaceholderRatio
  isPreview: boolean
  previewOrder: number | null
  metadataWarnings: string[]
  pairId?: string | null
  pairedAssetId?: string | null
  pairedAssetType?: ImgType | null
  stackPrimaryAssetId?: string | null
  displayType?: string
  isStacked?: boolean
  metadataSourceProjectId?: string | null
}
