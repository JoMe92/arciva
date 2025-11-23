/**
 * Defines the core data structure for a project. Each project has
 * identifiers and optional metadata such as tags and a representative
 * image. The aspect property controls the default aspect ratio of
 * thumbnails and placeholders.
 */
export type Project = {
  id: string
  title: string
  client: string
  blurb?: string
  note?: string | null
  aspect: 'portrait' | 'landscape' | 'square'
  image?: string | null
  previewImages?: ProjectPreviewImage[]
  tags?: string[]
  assetCount?: number
  createdAt?: string
  updatedAt?: string
  source?: 'static' | 'api'
}

export type ProjectPreviewImage = {
  assetId?: string
  url: string
  order: number
  width?: number | null
  height?: number | null
}
