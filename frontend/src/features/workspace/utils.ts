export function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

import { ColorTag } from './types'

export const TOKENS = {
  clay500: cssVar('--clay-500', '#A56A4A'),
  sand50: cssVar('--sand-50', '#FBF7EF'),
  sand100: cssVar('--sand-100', '#F6EEDD'),
  sand300: cssVar('--sand-300', '#E3D4B1'),
  sand500: cssVar('--sand-500', '#CBB58F'),
  basalt700: cssVar('--basalt-700', '#332F2B'),
  charcoal800: cssVar('--charcoal-800', '#1F1E1B'),
  river500: cssVar('--river-500', '#6B7C7A'),
}

const DEMO_RATIOS: import('../../shared/placeholder').PlaceholderRatio[] = ['3x2', '4x3', '16x9', '2x3', '3x4', '9x16', '1x2', '2x1', '1x1']

export function randomPlaceholderRatio() {
  return DEMO_RATIOS[Math.floor(Math.random() * DEMO_RATIOS.length)]
}

export function makeDemo(n = 24) {
  const out: import('./types').Photo[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
    const type = Math.random() < 0.35 ? 'RAW' : 'JPEG'
    const ratio = randomPlaceholderRatio()
    out.push({
      id: `ph${i + 1}`,
      name: `IMG_${String(i + 1).padStart(4, '0')}.${type === 'RAW' ? 'ARW' : 'JPG'}`,
      type: type as any,
      date: d.toISOString(),
      rating: 0,
      picked: false,
      rejected: false,
      tag: 'None',
      thumbSrc: null,
      previewSrc: null,
      placeholderRatio: ratio,
      isPreview: false,
      previewOrder: null,
      status: 'READY',
      metadataWarnings: [],
    })
  }
  return out
}

export function computeCols(containerWidth: number, size: number, gap: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1
  if (!Number.isFinite(size) || size <= 0) return 1
  const divisor = size + gap
  if (divisor <= 0) return 1
  const possible = Math.floor((containerWidth + gap) / divisor)
  return Math.max(1, possible)
}

export function setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

export const COLOR_MAP: Record<ColorTag, string> = {
  None: '#E5E7EB',
  Red: '#F87171',
  Green: '#34D399',
  Blue: '#60A5FA',
  Yellow: '#FBBF24',
  Purple: '#C084FC',
}

export const PROJECT_DATE_FORMAT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }) : null

export function projectInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function localizedMonthLabel(date: Date): string {
  return date.toLocaleString('default', { month: 'long' })
}

export function makeMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function makeDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
