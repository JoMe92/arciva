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
  hasEdits?: boolean
}

export type DateTreeDayNode = {
  id: string
  label: string
  count: number
  year: string
  month: string
  day: string
  parentYearId: string
  parentMonthId: string
}

export type DateTreeMonthNode = {
  id: string
  label: string
  count: number
  year: string
  month: string
  parentYearId: string
  days: DateTreeDayNode[]
}

export type DateTreeYearNode = {
  id: string
  label: string
  count: number
  year: string
  months: DateTreeMonthNode[]
}

export type GridSelectOptions = {
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
}

export const CURRENT_CONFIG_SOURCE_ID = 'current-config' as const
export type MetadataSourceId = typeof CURRENT_CONFIG_SOURCE_ID | string

export type InspectorViewportRect = {
  x: number
  y: number
  width: number
  height: number
}

export type InspectorPreviewPanCommand = {
  x: number
  y: number
  token: number
}

export type WorkspaceFilterControls = {
  minStars: 0 | 1 | 2 | 3 | 4 | 5
  setMinStars: (value: 0 | 1 | 2 | 3 | 4 | 5) => void
  filterColor: 'Any' | ColorTag
  setFilterColor: (value: 'Any' | ColorTag) => void
  showJPEG: boolean
  setShowJPEG: (value: boolean) => void
  showRAW: boolean
  setShowRAW: (value: boolean) => void
  onlyPicked: boolean
  setOnlyPicked: (value: boolean) => void
  hideRejected: boolean
  setHideRejected: (value: boolean) => void
  dateFilterActive: boolean
  selectedDayLabel: string | null
  clearDateFilter: () => void
}

export type MobileWorkspacePanel = 'project' | 'photos' | 'details'

export type UsedProjectLink = {
  id: string
  name: string
  lastUpdatedLabel: string
  previewImageUrl: string | null
  isCurrentProject: boolean
}

export type InspectorField = {
  label: string
  value: string
}

export type KeyMetadataSections = {
  general: InspectorField[]
  capture: InspectorField[]
}

export type MetadataSummary = {
  rating: number
  colorLabel: ColorTag
  pickRejectLabel: string
  picked: boolean
  rejected: boolean
  hasEdits: boolean
}

export type InspectorPreviewData = {
  src: string | null
  thumbSrc: string | null
  alt: string
  placeholderRatio: PlaceholderRatio
}

export type MetadataEntry = {
  key: string
  normalizedKey: string
  label: string
  value: unknown
}

export type MetadataCategory = 'camera' | 'lens' | 'exposure' | 'gps' | 'software' | 'custom'

export type MetadataGroup = {
  id: MetadataCategory
  label: string
  entries: MetadataEntry[]
}

export type ProjectOverviewData = {
  title: string
  description: string
  client: string
  tags: string[]
  assetCount: number
  createdAt: string | null
}

export type CropAspectRatioId = 'free' | 'original' | '1:1' | '4:3' | '16:9' | '2:1'

export type CropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CropOrientation = 'horizontal' | 'vertical'

export type CropSettings = {
  rect: CropRect
  angle: number
  aspectRatioId: CropAspectRatioId
  orientation: CropOrientation
  applied: boolean
}
