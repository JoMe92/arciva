import type { QuickFixAdjustments } from '@JoMe92/quickfix-renderer/quickfix_renderer.js'

// --- State Definitions ---

export type QuickFixCropState = {
  rotation: number
  aspectRatio: number | null
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

// New: Curves
export type CurvePoint = { x: number; y: number }
export type QuickFixCurvesState = {
  intensity: number
  master: CurvePoint[]
  red: CurvePoint[]
  green: CurvePoint[]
  blue: CurvePoint[]
}

// New: HSL
export type HslRange = { hue: number; saturation: number; luminance: number }
export type QuickFixHslState = {
  red: HslRange
  orange: HslRange
  yellow: HslRange
  green: HslRange
  aqua: HslRange
  blue: HslRange
  purple: HslRange
  magenta: HslRange
}

// New: Split Toning
export type QuickFixSplitToningState = {
  shadowHue: number
  shadowSat: number
  highlightHue: number
  highlightSat: number
  balance: number
}

// Updated Detail (Sharpen, Clarity, Dehaze, Denoise)
export type QuickFixDetailState = {
  sharpenAmount: number
  sharpenRadius: number
  sharpenThreshold: number
  clarity: number
  dehaze: number
  denoiseLuminance: number
  denoiseColor: number
}

export type QuickFixGrainState = {
  amount: number
  size: 'fine' | 'medium' | 'coarse'
}

// New: Vignette
export type QuickFixVignetteState = {
  amount: number
  midpoint: number
  roundness: number
  feather: number
}

// Updated Geometry (Distortion)
export type QuickFixGeometryState = {
  vertical: number
  horizontal: number
  flipVertical: boolean
  flipHorizontal: boolean
  distortionK1: number
  distortionK2: number
}

export type QuickFixState = {
  crop: QuickFixCropState
  exposure: QuickFixExposureState
  color: QuickFixColorState
  curves: QuickFixCurvesState
  hsl: QuickFixHslState
  splitToning: QuickFixSplitToningState
  detail: QuickFixDetailState
  grain: QuickFixGrainState
  vignette: QuickFixVignetteState
  geometry: QuickFixGeometryState
}

export type QuickFixGroupKey = keyof QuickFixState

// --- Defaults ---

const DEFAULT_CURVE = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

const DEFAULT_HSL_RANGE: HslRange = { hue: 0, saturation: 0, luminance: 0 }

// Helper for sanitization
function sanitizeNumber(value: unknown, defaultValue: number): number {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue
}

function sanitizeBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue
}

function sanitizeCropSettings(payload: unknown): QuickFixCropState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.crop

  let ar = data.aspectRatio !== undefined ? data.aspectRatio : data.aspect_ratio

  if (typeof ar === 'string' && ar.includes(':')) {
    const parts = ar.split(':').map(Number)
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
      ar = parts[0] / parts[1]
    } else {
      ar = null
    }
  }

  // Treat 0 as null (Original/Free)
  if (ar === 0) ar = null

  return {
    rotation: sanitizeNumber(data.rotation, defaults.rotation),
    aspectRatio: typeof ar === 'number' || ar === null ? ar : defaults.aspectRatio,
  }
}

function sanitizeExposureSettings(payload: unknown): QuickFixExposureState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.exposure
  return {
    exposure: sanitizeNumber(data.exposure, defaults.exposure),
    contrast: sanitizeNumber(data.contrast, defaults.contrast),
    highlights: sanitizeNumber(data.highlights, defaults.highlights),
    shadows: sanitizeNumber(data.shadows, defaults.shadows),
  }
}

function sanitizeColorSettings(payload: unknown): QuickFixColorState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.color
  return {
    temperature: sanitizeNumber(data.temperature, defaults.temperature),
    tint: sanitizeNumber(data.tint, defaults.tint),
  }
}

function sanitizeDetailSettings(payload: unknown): QuickFixDetailState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.detail
  return {
    sharpenAmount: sanitizeNumber(data.sharpenAmount, defaults.sharpenAmount),
    sharpenRadius: sanitizeNumber(data.sharpenRadius, defaults.sharpenRadius),
    sharpenThreshold: sanitizeNumber(data.sharpenThreshold, defaults.sharpenThreshold),
    clarity: sanitizeNumber(data.clarity, defaults.clarity),
    dehaze: sanitizeNumber(data.dehaze, defaults.dehaze),
    denoiseLuminance: sanitizeNumber(data.denoiseLuminance, defaults.denoiseLuminance),
    denoiseColor: sanitizeNumber(data.denoiseColor, defaults.denoiseColor),
  }
}

function sanitizeGrainSettings(payload: unknown): QuickFixGrainState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.grain
  return {
    amount: sanitizeNumber(data.amount, defaults.amount),
    size: ['fine', 'medium', 'coarse'].includes(data.size) ? data.size : defaults.size,
  }
}

function sanitizeGeometrySettings(payload: unknown): QuickFixGeometryState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.geometry
  return {
    vertical: sanitizeNumber(data.vertical, defaults.vertical),
    horizontal: sanitizeNumber(data.horizontal, defaults.horizontal),
    flipVertical: sanitizeBoolean(data.flipVertical, defaults.flipVertical),
    flipHorizontal: sanitizeBoolean(data.flipHorizontal, defaults.flipHorizontal),
    distortionK1: sanitizeNumber(data.distortionK1, defaults.distortionK1),
    distortionK2: sanitizeNumber(data.distortionK2, defaults.distortionK2),
  }
}

function sanitizeCurvesSettings(payload: unknown): QuickFixCurvesState {
  const data = (payload ?? {}) as any
  // Simplified sanitizer - rely on valid structure or defaults
  // In a real app we'd validate the points array structure
  const defaults = DEFAULT_STATE.curves
  return {
    intensity: sanitizeNumber(data.intensity, defaults.intensity),
    master: Array.isArray(data.master) ? data.master : [...defaults.master],
    red: Array.isArray(data.red) ? data.red : [...defaults.red],
    green: Array.isArray(data.green) ? data.green : [...defaults.green],
    blue: Array.isArray(data.blue) ? data.blue : [...defaults.blue],
  }
}

function sanitizeHslSettings(payload: unknown): QuickFixHslState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.hsl
  // Deep merging is tedious, assume if keys exist they are valid or fallback per channel
  // For now return defaults mixed with data
  // Implementation omitted for brevity, returning defaults if malformed
  if (!data) return { ...defaults }
  // Only handle if structure matches roughly
  return { ...defaults, ...data }
}

function sanitizeSplitToningSettings(payload: unknown): QuickFixSplitToningState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.splitToning
  return {
    shadowHue: sanitizeNumber(data.shadowHue, defaults.shadowHue),
    shadowSat: sanitizeNumber(data.shadowSat, defaults.shadowSat),
    highlightHue: sanitizeNumber(data.highlightHue, defaults.highlightHue),
    highlightSat: sanitizeNumber(data.highlightSat, defaults.highlightSat),
    balance: sanitizeNumber(data.balance, defaults.balance),
  }
}

function sanitizeVignetteSettings(payload: unknown): QuickFixVignetteState {
  const data = (payload ?? {}) as any
  const defaults = DEFAULT_STATE.vignette
  return {
    amount: sanitizeNumber(data.amount, defaults.amount),
    midpoint: sanitizeNumber(data.midpoint, defaults.midpoint),
    roundness: sanitizeNumber(data.roundness, defaults.roundness),
    feather: sanitizeNumber(data.feather, defaults.feather),
  }
}

const DEFAULT_STATE: QuickFixState = {
  crop: { rotation: 0, aspectRatio: null },
  exposure: { exposure: 0, contrast: 1, highlights: 0, shadows: 0 },
  color: { temperature: 0, tint: 0 },
  curves: {
    intensity: 1,
    master: [...DEFAULT_CURVE],
    red: [...DEFAULT_CURVE],
    green: [...DEFAULT_CURVE],
    blue: [...DEFAULT_CURVE],
  },
  hsl: {
    red: { ...DEFAULT_HSL_RANGE },
    orange: { ...DEFAULT_HSL_RANGE },
    yellow: { ...DEFAULT_HSL_RANGE },
    green: { ...DEFAULT_HSL_RANGE },
    aqua: { ...DEFAULT_HSL_RANGE },
    blue: { ...DEFAULT_HSL_RANGE },
    purple: { ...DEFAULT_HSL_RANGE },
    magenta: { ...DEFAULT_HSL_RANGE },
  },
  splitToning: {
    shadowHue: 0,
    shadowSat: 0,
    highlightHue: 0,
    highlightSat: 0,
    balance: 0,
  },
  detail: {
    sharpenAmount: 0,
    sharpenRadius: 1.0,
    sharpenThreshold: 0,
    clarity: 0,
    dehaze: 0,
    denoiseLuminance: 0,
    denoiseColor: 0,
  },
  grain: { amount: 0, size: 'medium' },
  vignette: { amount: 0, midpoint: 0.5, roundness: 0.5, feather: 0.5 },
  geometry: {
    vertical: 0,
    horizontal: 0,
    flipVertical: false,
    flipHorizontal: false,
    distortionK1: 0,
    distortionK2: 0,
  },
}

export function createDefaultQuickFixState(): QuickFixState {
  // Deep clone defaults
  return JSON.parse(JSON.stringify(DEFAULT_STATE))
}

export function cloneQuickFixState(state: QuickFixState): QuickFixState {
  return JSON.parse(JSON.stringify(state))
}

// --- Equality Checks (Simplified via JSON for complex objects or explicit) ---

// Helper for deep equality of simpler objects
function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

const cropDefaults = DEFAULT_STATE.crop
const exposureDefaults = DEFAULT_STATE.exposure
const colorDefaults = DEFAULT_STATE.color
const detailDefaults = DEFAULT_STATE.detail
const grainDefaults = DEFAULT_STATE.grain
const geometryDefaults = DEFAULT_STATE.geometry
const curvesDefaults = DEFAULT_STATE.curves
const hslDefaults = DEFAULT_STATE.hsl
const splitToningDefaults = DEFAULT_STATE.splitToning
const vignetteDefaults = DEFAULT_STATE.vignette

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

export const detailEqual = (a: QuickFixDetailState, b: QuickFixDetailState) =>
  Math.abs(a.sharpenAmount - b.sharpenAmount) < 1e-3 &&
  Math.abs(a.sharpenRadius - b.sharpenRadius) < 1e-3 &&
  Math.abs(a.sharpenThreshold - b.sharpenThreshold) < 1e-3 &&
  Math.abs(a.clarity - b.clarity) < 1e-3 &&
  Math.abs(a.dehaze - b.dehaze) < 1e-3 &&
  Math.abs(a.denoiseLuminance - b.denoiseLuminance) < 1e-3 &&
  Math.abs(a.denoiseColor - b.denoiseColor) < 1e-3

export const grainEqual = (a: QuickFixGrainState, b: QuickFixGrainState) =>
  Math.abs(a.amount - b.amount) < 1e-3 && a.size === b.size

export const geometryEqual = (a: QuickFixGeometryState, b: QuickFixGeometryState) =>
  Math.abs(a.vertical - b.vertical) < 1e-3 &&
  Math.abs(a.horizontal - b.horizontal) < 1e-3 &&
  a.flipVertical === b.flipVertical &&
  a.flipHorizontal === b.flipHorizontal &&
  Math.abs(a.distortionK1 - b.distortionK1) < 1e-3 &&
  Math.abs(a.distortionK2 - b.distortionK2) < 1e-3

// Simplified deep equals for complex objects
export const curvesEqual = (a: QuickFixCurvesState, b: QuickFixCurvesState) => JSON.stringify(a) === JSON.stringify(b)
export const hslEqual = (a: QuickFixHslState, b: QuickFixHslState) => JSON.stringify(a) === JSON.stringify(b)
export const splitToningEqual = (a: QuickFixSplitToningState, b: QuickFixSplitToningState) => JSON.stringify(a) === JSON.stringify(b)
export const vignetteEqual = (a: QuickFixVignetteState, b: QuickFixVignetteState) => JSON.stringify(a) === JSON.stringify(b)


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
    detailEqual(a.detail, b.detail) &&
    grainEqual(a.grain, b.grain) &&
    geometryEqual(a.geometry, b.geometry) &&
    curvesEqual(a.curves, b.curves) &&
    hslEqual(a.hsl, b.hsl) &&
    splitToningEqual(a.splitToning, b.splitToning) &&
    vignetteEqual(a.vignette, b.vignette)
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
    case 'detail':
      return detailEqual(state.detail, detailDefaults)
    case 'grain':
      return grainEqual(state.grain, grainDefaults)
    case 'geometry':
      return geometryEqual(state.geometry, geometryDefaults)
    case 'curves':
      return curvesEqual(state.curves, curvesDefaults)
    case 'hsl':
      return hslEqual(state.hsl, hslDefaults)
    case 'splitToning':
      return splitToningEqual(state.splitToning, splitToningDefaults)
    case 'vignette':
      return vignetteEqual(state.vignette, vignetteDefaults)
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
    !isQuickFixGroupDefault(state, 'curves') ||
    !isQuickFixGroupDefault(state, 'hsl') ||
    !isQuickFixGroupDefault(state, 'splitToning') ||
    !isQuickFixGroupDefault(state, 'detail') ||
    !isQuickFixGroupDefault(state, 'grain') ||
    !isQuickFixGroupDefault(state, 'vignette') ||
    !isQuickFixGroupDefault(state, 'geometry')
  )
}

export function resetQuickFixGroup(state: QuickFixState, group: QuickFixGroupKey): QuickFixState {
  const next = cloneQuickFixState(state)
  next[group] = JSON.parse(JSON.stringify(DEFAULT_STATE[group]))
  return next
}

// --- Payload Conversion ---

export function quickFixStateToPayload(state: QuickFixState): any | null { // Returning 'any' to match adjustments expected structure
  if (!hasQuickFixAdjustments(state)) return null

  const payload: any = {}

  // Crop
  if (!isQuickFixGroupDefault(state, 'crop')) {
    payload.crop = {
      rotation: state.crop.rotation,
      aspect_ratio: state.crop.aspectRatio ?? undefined,
      rect: undefined // Not handling rect here yet
    }
  }

  // Exposure
  if (!isQuickFixGroupDefault(state, 'exposure')) {
    payload.exposure = { ...state.exposure }
  }

  // Color
  if (!isQuickFixGroupDefault(state, 'color')) {
    payload.color = { ...state.color }
  }

  // Curves
  if (!isQuickFixGroupDefault(state, 'curves')) {
    payload.curves = {
      intensity: state.curves.intensity,
      master: { points: state.curves.master },
      red: { points: state.curves.red },
      green: { points: state.curves.green },
      blue: { points: state.curves.blue },
    }
  }

  // HSL
  if (!isQuickFixGroupDefault(state, 'hsl')) {
    // Send both standard names and potential aliases to cover renderer mismatch
    // (e.g. aqua vs cyan, purple vs violet)
    const hsl = { ...state.hsl } as any
    if (hsl.aqua) hsl.cyan = hsl.aqua
    if (hsl.purple) hsl.violet = hsl.purple
    payload.hsl = hsl
  }

  // Split Toning
  if (!isQuickFixGroupDefault(state, 'splitToning')) {
    payload.splitToning = { ...state.splitToning }
  }

  // Detail (Split into Sharpen, Clarity, Dehaze, Denoise)
  const d = state.detail
  if (d.sharpenAmount !== 0 || d.sharpenRadius !== 1.0 || d.sharpenThreshold !== 0) {
    payload.sharpen = {
      amount: d.sharpenAmount,
      radius: d.sharpenRadius,
      threshold: d.sharpenThreshold
    }
  }
  if (d.clarity !== 0) {
    payload.clarity = { amount: d.clarity }
  }
  if (d.dehaze !== 0) {
    payload.dehaze = { amount: d.dehaze }
  }
  if (d.denoiseLuminance !== 0 || d.denoiseColor !== 0) {
    payload.denoise = {
      luminance: d.denoiseLuminance,
      color: d.denoiseColor
    }
  }

  // Grain
  if (!isQuickFixGroupDefault(state, 'grain')) {
    payload.grain = { ...state.grain }
  }

  // Vignette
  if (!isQuickFixGroupDefault(state, 'vignette')) {
    payload.vignette = { ...state.vignette }
  }

  // Geometry
  if (!isQuickFixGroupDefault(state, 'geometry')) {
    payload.geometry = {
      vertical: state.geometry.vertical,
      horizontal: state.geometry.horizontal,
      flipVertical: state.geometry.flipVertical,
      flipHorizontal: state.geometry.flipHorizontal,
    }
    // Distortion is separate in renderer
    if (state.geometry.distortionK1 !== 0 || state.geometry.distortionK2 !== 0) {
      payload.distortion = {
        k1: state.geometry.distortionK1,
        k2: state.geometry.distortionK2
      }
    }
  }

  return Object.keys(payload).length ? payload : null
}

// --- Sanitization (from API) ---
// Simplified for now, relying on defaults if missing.
// Implementing proper sanitization requires mirroring the structure check.
// Since we are primarily 'pushing' state to renderer, incoming from API is for loading presets?
// Assuming yes.


export function quickFixStateFromApi(payload: unknown): QuickFixState | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as any
  const next = createDefaultQuickFixState()

  // Crop
  if (p.crop) {
    next.crop = sanitizeCropSettings(p.crop)
  }

  // Exposure
  if (p.exposure) {
    next.exposure = sanitizeExposureSettings(p.exposure)
  }

  // Color
  if (p.color) {
    next.color = sanitizeColorSettings(p.color)
  }

  // Curves (API: { intensity, master: { points: [] }, ... }) -> State: { intensity, master: [], ... }
  if (p.curves) {
    const c = p.curves
    if (typeof c.intensity === 'number') next.curves.intensity = c.intensity

    // Helper to extract points
    const extractPoints = (channel: any) => {
      if (channel && Array.isArray(channel.points)) {
        return channel.points.map((pt: any) => ({ x: Number(pt.x), y: Number(pt.y) }))
      }
      return null
    }

    const m = extractPoints(c.master); if (m) next.curves.master = m
    const r = extractPoints(c.red); if (r) next.curves.red = r
    const g = extractPoints(c.green); if (g) next.curves.green = g
    const b = extractPoints(c.blue); if (b) next.curves.blue = b
  }

  // HSL
  if (p.hsl) {
    next.hsl = sanitizeHslSettings(p.hsl)
  }

  // Split Toning
  if (p.splitToning) {
    next.splitToning = sanitizeSplitToningSettings(p.splitToning)
  }

  // Detail (Flattening)
  // Sharpen
  if (p.sharpen) {
    if (typeof p.sharpen.amount === 'number') next.detail.sharpenAmount = p.sharpen.amount
    if (typeof p.sharpen.radius === 'number') next.detail.sharpenRadius = p.sharpen.radius
    if (typeof p.sharpen.threshold === 'number') next.detail.sharpenThreshold = p.sharpen.threshold
  }
  // Clarity
  if (p.clarity && typeof p.clarity.amount === 'number') {
    next.detail.clarity = p.clarity.amount
  }
  // Dehaze
  if (p.dehaze && typeof p.dehaze.amount === 'number') {
    next.detail.dehaze = p.dehaze.amount
  }
  // Denoise
  if (p.denoise) {
    if (typeof p.denoise.luminance === 'number') next.detail.denoiseLuminance = p.denoise.luminance
    if (typeof p.denoise.color === 'number') next.detail.denoiseColor = p.denoise.color
  }

  // Grain
  if (p.grain) {
    next.grain = sanitizeGrainSettings(p.grain)
  }

  // Vignette
  if (p.vignette) {
    next.vignette = sanitizeVignetteSettings(p.vignette)
  }

  // Geometry
  if (p.geometry) {
    next.geometry = sanitizeGeometrySettings(p.geometry)
  }
  // Distortion (Merged into geometry in state)
  if (p.distortion) {
    if (typeof p.distortion.k1 === 'number') next.geometry.distortionK1 = p.distortion.k1
    if (typeof p.distortion.k2 === 'number') next.geometry.distortionK2 = p.distortion.k2
  }

  return next
}


// ... (imports remain)

