export type PlaceholderRatio =
  | '1x1'
  | '3x2'
  | '4x3'
  | '16x9'
  | '2x1'
  | '2x3'
  | '3x4'
  | '9x16'
  | '1x2'

export type RatioSpec = { width: number; height: number }

export const RATIO_DIMENSIONS: Record<PlaceholderRatio, RatioSpec> = {
  '1x1': { width: 100, height: 100 },
  '3x2': { width: 300, height: 200 },
  '4x3': { width: 400, height: 300 },
  '16x9': { width: 160, height: 90 },
  '2x1': { width: 200, height: 100 },
  '2x3': { width: 200, height: 300 },
  '3x4': { width: 300, height: 400 },
  '9x16': { width: 90, height: 160 },
  '1x2': { width: 100, height: 200 },
}

export function toPlaceholderRatio(input: string): PlaceholderRatio {
  const ratios = Object.keys(RATIO_DIMENSIONS) as PlaceholderRatio[]
  return (ratios.find((r) => r === input) ?? '1x1') as PlaceholderRatio
}

export function placeholderRatioForAspect(
  aspect: 'portrait' | 'landscape' | 'square'
): PlaceholderRatio {
  if (aspect === 'portrait') return '3x4'
  if (aspect === 'landscape') return '16x9'
  return '1x1'
}
