export function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export const TOKENS = {
  clay500: cssVar('--clay-500', '#A56A4A'),
  sand50: cssVar('--sand-50', '#FBF7EF'),
  sand100: cssVar('--sand-100', '#F3EBDD'),
  sand300: cssVar('--sand-300', '#E1D3B9'),
  sand500: cssVar('--sand-500', '#D7C5A6'),
  basalt700: cssVar('--basalt-700', '#4A463F'),
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
      src: null,
      placeholderRatio: ratio,
      isPreview: false,
      previewOrder: null,
    })
  }
  return out
}
