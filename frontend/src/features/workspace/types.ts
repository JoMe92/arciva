import type { PlaceholderRatio } from '../../shared/placeholder'

export type ImgType = 'JPEG' | 'RAW'
export type ColorTag = 'None' | 'Red' | 'Green' | 'Blue' | 'Yellow' | 'Purple'

export type Photo = {
  id: string
  name: string
  type: ImgType
  date: string // ISO
  rating: 0 | 1 | 2 | 3 | 4 | 5
  picked: boolean
  rejected: boolean
  tag: ColorTag
  thumbSrc?: string | null
  previewSrc?: string | null
  placeholderRatio: PlaceholderRatio
  isPreview: boolean
  previewOrder: number | null
  metadataWarnings: string[]
}
