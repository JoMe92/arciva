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

export function ph(w: number, h: number, label: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${TOKENS.sand50}'/>
      <stop offset='100%' stop-color='${TOKENS.sand500}'/>
    </linearGradient></defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <circle cx='${w * 0.82}' cy='${h * 0.22}' r='${Math.min(w, h) * 0.08}' fill='${TOKENS.clay500}' fill-opacity='0.9'/>
    <text x='16' y='26' font-family='ui-sans-serif, system-ui' font-size='14' fill='${TOKENS.basalt700}' opacity='0.8'>${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function makeDemo(n = 24) {
  const out: import('./types').Photo[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
    const type = Math.random() < 0.35 ? 'RAW' : 'JPEG'
    out.push({
      id: `ph${i + 1}`,
      name: `IMG_${String(i + 1).padStart(4, '0')}.${type === 'RAW' ? 'ARW' : 'JPG'}`,
      type: type as any,
      date: d.toISOString(),
      rating: 0,
      picked: false,
      rejected: false,
      tag: 'None',
      src: ph(900, 600, `IMG_${String(i + 1).padStart(4, '0')}`),
    })
  }
  return out
}
