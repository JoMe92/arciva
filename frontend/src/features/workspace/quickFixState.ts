import type {
  QuickFixAdjustmentsPayload,
  QuickFixColorSettingsPayload,
  QuickFixCropSettingsPayload,
  QuickFixExposureSettingsPayload,
  QuickFixGeometrySettingsPayload,
  QuickFixGrainSettingsPayload,
} from '../../shared/api/assets'

export type QuickFixCropState = {
  rotation: number
  aspectRatio: number | string | null
}

export type QuickFixExposureState = {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
}

export type QuickFixColorState = {
  temperature: number
  tint: number
}

export type QuickFixGrainState = {
  amount: number
  size: 'fine' | 'medium' | 'coarse'
}

export type QuickFixGeometryState = {
  vertical: number
  horizontal: number
}

export type QuickFixState = {
  crop: QuickFixCropState
  exposure: QuickFixExposureState
  color: QuickFixColorState
  grain: QuickFixGrainState
  geometry: QuickFixGeometryState
}

export type QuickFixGroupKey = keyof QuickFixState

const DEFAULT_STATE: QuickFixState = {
  crop: { rotation: 0, aspectRatio: null },
  exposure: { exposure: 0, contrast: 1, highlights: 0, shadows: 0 },
  color: { temperature: 0, tint: 0 },
  grain: { amount: 0, size: 'medium' },
  geometry: { vertical: 0, horizontal: 0 },
}

export function createDefaultQuickFixState(): QuickFixState {
  return {
    crop: { ...DEFAULT_STATE.crop },
    exposure: { ...DEFAULT_STATE.exposure },
    color: { ...DEFAULT_STATE.color },
    grain: { ...DEFAULT_STATE.grain },
    geometry: { ...DEFAULT_STATE.geometry },
  }
}

export function cloneQuickFixState(state: QuickFixState): QuickFixState {
  return {
    crop: { ...state.crop },
    exposure: { ...state.exposure },
    color: { ...state.color },
    grain: { ...state.grain },
    geometry: { ...state.geometry },
  }
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const sanitizeNumber = (value: unknown, fallback: number): number => {
  if (isNumber(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function sanitizeCropSettings(payload: unknown): QuickFixCropState {
  const data = (payload ?? {}) as QuickFixCropSettingsPayload
  let aspectRatio: number | string | null = null
  if (typeof data.aspect_ratio === 'string') {
    aspectRatio = data.aspect_ratio
  } else if (typeof data.aspect_ratio === 'number' && data.aspect_ratio > 0) {
    aspectRatio = data.aspect_ratio
  }
  return {
    rotation: sanitizeNumber(data.rotation, DEFAULT_STATE.crop.rotation),
    aspectRatio,
  }
}

function sanitizeExposureSettings(payload: unknown): QuickFixExposureState {
  const data = (payload ?? {}) as QuickFixExposureSettingsPayload
  return {
    exposure: sanitizeNumber(data.exposure, DEFAULT_STATE.exposure.exposure),
    contrast: sanitizeNumber(data.contrast, DEFAULT_STATE.exposure.contrast),
    highlights: sanitizeNumber(data.highlights, DEFAULT_STATE.exposure.highlights),
    shadows: sanitizeNumber(data.shadows, DEFAULT_STATE.exposure.shadows),
  }
}

function sanitizeColorSettings(payload: unknown): QuickFixColorState {
  const data = (payload ?? {}) as QuickFixColorSettingsPayload
  return {
    temperature: sanitizeNumber(data.temperature, DEFAULT_STATE.color.temperature),
    tint: sanitizeNumber(data.tint, DEFAULT_STATE.color.tint),
  }
}

function sanitizeGrainSettings(payload: unknown): QuickFixGrainState {
  const data = (payload ?? {}) as QuickFixGrainSettingsPayload
  const size = data.size
  const normalizedSize: QuickFixGrainState['size'] =
    size === 'fine' || size === 'medium' || size === 'coarse' ? size : DEFAULT_STATE.grain.size
  return {
    amount: sanitizeNumber(data.amount, DEFAULT_STATE.grain.amount),
    size: normalizedSize,
  }
}

function sanitizeGeometrySettings(payload: unknown): QuickFixGeometryState {
  const data = (payload ?? {}) as QuickFixGeometrySettingsPayload
  return {
    vertical: sanitizeNumber(data.vertical, DEFAULT_STATE.geometry.vertical),
    horizontal: sanitizeNumber(data.horizontal, DEFAULT_STATE.geometry.horizontal),
  }
}

export function quickFixStateFromApi(payload: unknown): QuickFixState | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const data = payload as QuickFixAdjustmentsPayload
  const next = createDefaultQuickFixState()
  if (data.crop) next.crop = sanitizeCropSettings(data.crop)
  if (data.exposure) next.exposure = sanitizeExposureSettings(data.exposure)
  if (data.color) next.color = sanitizeColorSettings(data.color)
  if (data.grain) next.grain = sanitizeGrainSettings(data.grain)
  if (data.geometry) next.geometry = sanitizeGeometrySettings(data.geometry)
  return next
}

const cropDefaults = DEFAULT_STATE.crop
const exposureDefaults = DEFAULT_STATE.exposure
const colorDefaults = DEFAULT_STATE.color
const grainDefaults = DEFAULT_STATE.grain
const geometryDefaults = DEFAULT_STATE.geometry

export const cropEqual = (a: QuickFixCropState, b: QuickFixCropState) => {
  if (Math.abs(a.rotation - b.rotation) >= 1e-3) return false
  if (a.aspectRatio === b.aspectRatio) return true
  if (typeof a.aspectRatio === 'number' && typeof b.aspectRatio === 'number') {
    return Math.abs(a.aspectRatio - b.aspectRatio) < 1e-4
  }
  return false
}

export const exposureEqual = (a: QuickFixExposureState, b: QuickFixExposureState) =>
  Math.abs(a.exposure - b.exposure) < 1e-3 &&
  Math.abs(a.contrast - b.contrast) < 1e-3 &&
  Math.abs(a.highlights - b.highlights) < 1e-3 &&
  Math.abs(a.shadows - b.shadows) < 1e-3

export const colorEqual = (a: QuickFixColorState, b: QuickFixColorState) =>
  Math.abs(a.temperature - b.temperature) < 1e-3 && Math.abs(a.tint - b.tint) < 1e-3

export const grainEqual = (a: QuickFixGrainState, b: QuickFixGrainState) =>
  Math.abs(a.amount - b.amount) < 1e-3 && a.size === b.size

export const geometryEqual = (a: QuickFixGeometryState, b: QuickFixGeometryState) =>
  Math.abs(a.vertical - b.vertical) < 1e-3 && Math.abs(a.horizontal - b.horizontal) < 1e-3

export function areQuickFixStatesEqual(
  a: QuickFixState | null | undefined,
  b: QuickFixState | null | undefined
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    cropEqual(a.crop, b.crop) &&
    exposureEqual(a.exposure, b.exposure) &&
    colorEqual(a.color, b.color) &&
    grainEqual(a.grain, b.grain) &&
    geometryEqual(a.geometry, b.geometry)
  )
}

export function isQuickFixGroupDefault(state: QuickFixState, group: QuickFixGroupKey): boolean {
  switch (group) {
    case 'crop':
      return cropEqual(state.crop, cropDefaults)
    case 'exposure':
      return exposureEqual(state.exposure, exposureDefaults)
    case 'color':
      return colorEqual(state.color, colorDefaults)
    case 'grain':
      return grainEqual(state.grain, grainDefaults)
    case 'geometry':
      return geometryEqual(state.geometry, geometryDefaults)
    default:
      return true
  }
}

export function hasQuickFixAdjustments(state: QuickFixState | null | undefined): boolean {
  if (!state) return false
  return (
    !isQuickFixGroupDefault(state, 'crop') ||
    !isQuickFixGroupDefault(state, 'exposure') ||
    !isQuickFixGroupDefault(state, 'color') ||
    !isQuickFixGroupDefault(state, 'grain') ||
    !isQuickFixGroupDefault(state, 'geometry')
  )
}

export function resetQuickFixGroup(state: QuickFixState, group: QuickFixGroupKey): QuickFixState {
  const next = cloneQuickFixState(state)
  switch (group) {
    case 'crop':
      next.crop = { ...cropDefaults }
      break
    case 'exposure':
      next.exposure = { ...exposureDefaults }
      break
    case 'color':
      next.color = { ...colorDefaults }
      break
    case 'grain':
      next.grain = { ...grainDefaults }
      break
    case 'geometry':
      next.geometry = { ...geometryDefaults }
      break
    default:
      break
  }
  return next
}

export function quickFixStateToPayload(state: QuickFixState): QuickFixAdjustmentsPayload | null {
  const payload: QuickFixAdjustmentsPayload = {}
  if (!cropEqual(state.crop, cropDefaults)) {
    payload.crop = {
      rotation: state.crop.rotation,
      aspect_ratio: state.crop.aspectRatio ?? undefined,
    }
  }
  if (!exposureEqual(state.exposure, exposureDefaults)) {
    payload.exposure = { ...state.exposure }
  }
  if (!colorEqual(state.color, colorDefaults)) {
    payload.color = { ...state.color }
  }
  if (!grainEqual(state.grain, grainDefaults)) {
    payload.grain = { ...state.grain }
  }
  if (!geometryEqual(state.geometry, geometryDefaults)) {
    payload.geometry = { ...state.geometry }
  }
  return Object.keys(payload).length ? payload : null
}
