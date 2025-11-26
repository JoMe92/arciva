import { useCallback, useState } from 'react'
import type {
  ContactSheetFormat,
  ExportFileFormat,
  RawHandlingStrategy,
  ExportSizeMode,
} from '../../shared/api/exports'

const STORAGE_KEY = 'workspace-export-presets'

export type ExportSettingsSnapshot = {
  outputFormat: ExportFileFormat
  rawHandling: RawHandlingStrategy
  sizeMode: ExportSizeMode
  longEdge: number
  jpegQuality: number
  contactSheetEnabled: boolean
  contactSheetFormat: ContactSheetFormat
}

export type ExportPreset = {
  id: string
  name: string
  settings: ExportSettingsSnapshot
}

function readPresetsFromStorage(): ExportPreset[] {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ExportPreset => {
      return (
        typeof item?.id === 'string' &&
        typeof item?.name === 'string' &&
        typeof item?.settings === 'object'
      )
    })
  } catch {
    return []
  }
}

function persistPresets(presets: ExportPreset[]) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // Ignore persistence errors. Presets will stay in memory for this session.
  }
}

function makePresetId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `preset-${Date.now()}-${Math.round(Math.random() * 10_000)}`
}

export function useExportPresets() {
  const [presets, setPresets] = useState<ExportPreset[]>(() => readPresetsFromStorage())

  const addPreset = useCallback((name: string, snapshot: ExportSettingsSnapshot) => {
    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Preset name required')
    }
    const preset: ExportPreset = {
      id: makePresetId(),
      name: trimmed,
      settings: snapshot,
    }
    setPresets((prev) => {
      const canonical = prev.some((item) => item.name === preset.name)
        ? prev.map((item) => (item.name === preset.name ? { ...preset, id: item.id } : item))
        : [...prev, preset]
      persistPresets(canonical)
      return canonical
    })
    return preset
  }, [])

  return { presets, addPreset }
}
