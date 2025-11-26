import type { Project } from './types'
import type { ProjectApiResponse } from '../../shared/api/projects'
import { withBase } from '../../shared/api/base'
export { placeholderRatioForAspect } from '../../shared/placeholder'
export type { PlaceholderRatio } from '../../shared/placeholder'

/**
 * Generate a simple numeric-to-string converter. Some libraries require
 * stringified numeric attributes on SVG elements; this helper avoids
 * sprinkling String() calls throughout the code.
 */
export const S = (n: number) => String(n)

/**
 * Compute a Tailwind aspect ratio class from a project aspect value.
 */
export function aspectClass(a: Project['aspect']): string {
  return a === 'portrait' ? 'aspect-[3/4]' : a === 'landscape' ? 'aspect-[16/9]' : 'aspect-square'
}

export function aspectRatioValue(width?: number | null, height?: number | null): string | null {
  if (!width || !height) return null
  if (width <= 0 || height <= 0) return null
  return `${width} / ${height}`
}

export function ratioFromDimensions(width?: number | null, height?: number | null): number | null {
  if (!width || !height) return null
  if (width <= 0 || height <= 0) return null
  return width / height
}

export function parseRatio(value?: string | null): number | null {
  if (!value) return null
  const parts = value.split('/').map((part) => Number(part.trim()))
  if (parts.length !== 2) return null
  const [w, h] = parts
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  if (h === 0) return null
  return w / h
}

export type Orientation = 'landscape' | 'portrait' | 'square'

export function orientationFromRatio(ratio: number | null): Orientation | null {
  if (!ratio || ratio <= 0) return null
  const EPSILON = 0.02
  if (Math.abs(ratio - 1) <= EPSILON) return 'square'
  return ratio > 1 ? 'landscape' : 'portrait'
}

export function fallbackAspectRatioForAspect(aspect: Project['aspect']): string {
  if (aspect === 'landscape') return '16 / 9'
  if (aspect === 'portrait') return '3 / 4'
  return '1 / 1'
}

/**
 * Create a sorted array of unique strings. This helper is used for
 * deduplicating clients and tags in the filter bar.
 */
export function unique(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b))
}

// Row composition utilities. These functions slice an input array into
// rows following a repeating pattern of lengths (2,3,1,4). The pattern
// aims to balance the grid layout visually without rearranging items.
const pattern = [2, 3, 1, 4]

/**
 * Compose a list of projects into a nested array representing rows.
 * Items remain in order; each row contains between 1 and 4 items
 * depending on the pattern.
 */
export function composeRows<T>(arr: T[]): T[][] {
  const rows: T[][] = []
  let i = 0
  let p = 0
  while (i < arr.length) {
    const take = Math.min(pattern[p % pattern.length], arr.length - i)
    rows.push(arr.slice(i, i + take))
    i += take
    p++
  }
  return rows
}

/**
 * Normalize an API response object into the richer Project shape used in the UI.
 * Preview image ordering and aspect detection mirror the original dashboard logic.
 */
export function projectFromApi(proj: ProjectApiResponse): Project {
  const previewImages = (proj.preview_images || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((img, idx) => {
      const url = withBase(img.thumb_url)
      if (!url) return null
      return {
        assetId: img.asset_id,
        url,
        order: idx,
        width: img.width ?? null,
        height: img.height ?? null,
      }
    })
    .filter((img): img is NonNullable<typeof img> => Boolean(img))

  const primaryPreview = previewImages[0]?.url ?? null

  const derivedAspect = (() => {
    const candidate = previewImages.find((img) => (img.width ?? 0) > 0 && (img.height ?? 0) > 0)
    if (!candidate) return 'portrait' as Project['aspect']
    const w = candidate.width ?? 0
    const h = candidate.height ?? 0
    if (w === h) return 'square'
    return w > h ? 'landscape' : 'portrait'
  })()

  const description = proj.note ?? undefined
  const normalizedTags = Array.isArray(proj.tags)
    ? proj.tags.filter((tag): tag is string => typeof tag === 'string')
    : []

  return {
    id: proj.id,
    title: proj.title,
    client: proj.client ?? 'Unassigned',
    note: proj.note,
    blurb: description,
    aspect: derivedAspect,
    image: primaryPreview,
    previewImages,
    tags: normalizedTags,
    assetCount: proj.asset_count,
    createdAt: proj.created_at,
    updatedAt: proj.updated_at,
    source: 'api',
  }
}
