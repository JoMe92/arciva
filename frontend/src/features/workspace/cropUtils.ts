import type { CropAspectRatioId, CropRect, CropSettings, CropOrientation } from './types'

export type CropRatioOption = {
  id: CropAspectRatioId
  label: string
  ratio: number | null
}

export const MIN_CROP_EDGE = 0.05

export const CROP_RATIO_OPTIONS: CropRatioOption[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '2:1', label: '2:1', ratio: 2 },
]

export const FIXED_RATIO_MAP: Record<Exclude<CropAspectRatioId, 'free' | 'original'>, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '2:1': 2,
}

export const DEFAULT_CROP_RECT: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

export const DEFAULT_CROP_SETTINGS: CropSettings = {
  rect: { ...DEFAULT_CROP_RECT },
  angle: 0,
  aspectRatioId: 'original',
  orientation: 'horizontal',
  applied: false,
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export function clampCropRect(rect: CropRect, minSize = MIN_CROP_EDGE): CropRect {
  const width = clamp(rect.width, minSize, 1)
  const height = clamp(rect.height, minSize, 1)
  const x = clamp(rect.x, 0, 1 - width)
  const y = clamp(rect.y, 0, 1 - height)
  return { x, y, width, height }
}

export function fitRectToAspect(
  rect: CropRect,
  ratio: number,
  minSize = MIN_CROP_EDGE,
  containerRatio = 1
): CropRect {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return clampCropRect(rect, minSize)
  }
  const normalizedRatio =
    Number.isFinite(containerRatio) && containerRatio > 0 ? ratio / containerRatio : ratio
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  let width = rect.width
  let height = rect.height
  if (width <= 0 || height <= 0) {
    width = ratio >= 1 ? 1 : ratio
    height = width / ratio
  }
  const currentRatio = width / height
  if (Number.isFinite(currentRatio)) {
    if (currentRatio > normalizedRatio) {
      width = height * normalizedRatio
    } else if (currentRatio < normalizedRatio) {
      height = width / normalizedRatio
    }
  }
  if (width > 1) {
    const scale = width ? 1 / width : 1
    width = 1
    height *= scale
  }
  if (height > 1) {
    const scale = height ? 1 / height : 1
    height = 1
    width *= scale
  }
  width = clamp(width, minSize, 1)
  height = clamp(height, minSize, 1)
  const x = clamp(centerX - width / 2, 0, 1 - width)
  const y = clamp(centerY - height / 2, 0, 1 - height)
  return { x, y, width, height }
}

export function resolveAspectRatioValue(
  id: CropAspectRatioId,
  originalRatio: number | null
): number | null {
  if (id === 'free') return null
  if (id === 'original') return originalRatio ?? null
  return FIXED_RATIO_MAP[id] ?? null
}

export function createDefaultCropSettings(): CropSettings {
  return {
    rect: { ...DEFAULT_CROP_RECT },
    angle: DEFAULT_CROP_SETTINGS.angle,
    aspectRatioId: DEFAULT_CROP_SETTINGS.aspectRatioId,
    orientation: DEFAULT_CROP_SETTINGS.orientation,
    applied: DEFAULT_CROP_SETTINGS.applied,
  }
}

export function applyOrientationToRatio(
  ratio: number | null,
  orientation: CropOrientation
): number | null {
  if (!ratio || orientation === 'horizontal') return ratio
  if (ratio === 0) return null
  return 1 / ratio
}

export function inferAspectRatioSelection(
  value: number | string | null,
  originalRatio: number | null
): { id: CropAspectRatioId; orientation: CropOrientation } {
  let numericValue: number | null = null
  if (typeof value === 'string') {
    if (value.includes(':')) {
      const [w, h] = value.split(':').map(Number)
      if (w > 0 && h > 0) {
        numericValue = w / h
      }
    } else {
      const parsed = parseFloat(value)
      if (Number.isFinite(parsed)) {
        numericValue = parsed
      }
    }
  } else {
    numericValue = value
  }

  if (!numericValue || numericValue <= 0) {
    return { id: 'free', orientation: 'horizontal' }
  }
  let orientation: CropOrientation = 'horizontal'
  let target = numericValue
  if (numericValue < 1) {
    orientation = 'vertical'
    target = 1 / numericValue
  }
  const tolerance = 0.01
  if (originalRatio && Math.abs(target - originalRatio) <= tolerance) {
    return { id: 'original', orientation }
  }
  for (const option of CROP_RATIO_OPTIONS) {
    if (!option.ratio) continue
    if (Math.abs(target - option.ratio) <= tolerance) {
      return { id: option.id, orientation }
    }
  }
  return { id: 'free', orientation }
}
