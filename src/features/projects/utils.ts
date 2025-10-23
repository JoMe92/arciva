import type { Project } from './types'
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
  return a === 'portrait'
    ? 'aspect-[3/4]'
    : a === 'landscape'
    ? 'aspect-[16/9]'
    : 'aspect-square'
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
