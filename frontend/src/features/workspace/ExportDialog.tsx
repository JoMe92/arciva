import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RawPlaceholderFrame } from '../../components/RawPlaceholder'
import type { Photo } from './types'
import { exportSelectedPhotos } from '../../shared/api/exports'
import type { ExportPhotosResponse } from '../../shared/api/exports'
import { useExportPresets, type ExportSettingsSnapshot, type ExportPreset } from './exportPresets'

type ExportDialogProps = {
  isOpen: boolean
  photos: Photo[]
  onClose: () => void
}

type ExportPhase = 'configure' | 'exporting' | 'success'

type ExportErrors = Partial<Record<'folderPath' | 'longEdge' | 'presetName', string>>

type ExportSettingsState = ExportSettingsSnapshot & {
  folderPath: string
  presetId: string | null
  storeFolderInPreset: boolean
}

const DEFAULT_PRESET_VALUE = '__default__'

const DEFAULT_SNAPSHOT: ExportSettingsSnapshot = {
  outputFormat: 'JPEG',
  rawHandling: 'developed',
  sizeMode: 'original',
  longEdge: 3000,
  jpegQuality: 90,
  contactSheetEnabled: false,
  contactSheetFormat: 'PDF',
}

const JPEG_QUALITY_OPTIONS = [70, 80, 90, 100]
const MIN_LONG_EDGE = 256
const MAX_LONG_EDGE = 12_000

function makeInitialSettings(): ExportSettingsState {
  return {
    ...DEFAULT_SNAPSHOT,
    folderPath: '',
    presetId: null,
    storeFolderInPreset: false,
  }
}

function snapshotFromState(state: ExportSettingsState): ExportSettingsSnapshot {
  return {
    outputFormat: state.outputFormat,
    rawHandling: state.rawHandling,
    sizeMode: state.sizeMode,
    longEdge: state.longEdge,
    jpegQuality: state.jpegQuality,
    contactSheetEnabled: state.contactSheetEnabled,
    contactSheetFormat: state.contactSheetFormat,
    folderPath: state.storeFolderInPreset && state.folderPath ? state.folderPath : undefined,
  }
}

function applySnapshot(prev: ExportSettingsState, snapshot: ExportSettingsSnapshot, presetId: string | null): ExportSettingsState {
  return {
    ...prev,
    outputFormat: snapshot.outputFormat,
    rawHandling: snapshot.rawHandling,
    sizeMode: snapshot.sizeMode,
    longEdge: snapshot.longEdge,
    jpegQuality: snapshot.jpegQuality,
    contactSheetEnabled: snapshot.contactSheetEnabled,
    contactSheetFormat: snapshot.contactSheetFormat,
    folderPath: snapshot.folderPath ?? prev.folderPath,
    storeFolderInPreset: Boolean(snapshot.folderPath),
    presetId,
  }
}

export function ExportDialog({ isOpen, photos, onClose }: ExportDialogProps) {
  const { presets, addPreset } = useExportPresets()
  const [settings, setSettings] = useState<ExportSettingsState>(() => makeInitialSettings())
  const [errors, setErrors] = useState<ExportErrors>({})
  const [phase, setPhase] = useState<ExportPhase>('configure')
  const [progress, setProgress] = useState({ completed: 0, total: Math.max(photos.length, 1) })
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportResult, setExportResult] = useState<ExportPhotosResponse | null>(null)
  const [presetSaveOpen, setPresetSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetDropdown, setPresetDropdown] = useState<string>(DEFAULT_PRESET_VALUE)
  const [presetSaveError, setPresetSaveError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const hasRawSource = useMemo(() => photos.some((photo) => photo.type === 'RAW' || photo.pairedAssetType === 'RAW'), [photos])
  const jpegSettingsVisible = settings.outputFormat === 'JPEG' || (settings.contactSheetEnabled && settings.contactSheetFormat === 'JPEG')
  const totalSelected = photos.length

  useEffect(() => {
    if (!isOpen) return
    setSettings(makeInitialSettings())
    setErrors({})
    setPhase('configure')
    setExportError(null)
    setExportResult(null)
    setProgress({ completed: 0, total: Math.max(photos.length, 1) })
    setPresetSaveOpen(false)
    setPresetName('')
    setPresetSaveError(null)
    setPresetDropdown(DEFAULT_PRESET_VALUE)
  }, [isOpen, photos.length])

  useEffect(() => {
    if (!isOpen) return
    setProgress((prev) => ({ ...prev, total: Math.max(photos.length, 1) }))
  }, [isOpen, photos.length])

  useEffect(() => {
    if (!isOpen || phase !== 'configure') return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, phase, onClose])

  useEffect(() => {
    if (!isOpen && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [isOpen])

  const validate = useCallback(() => {
    const nextErrors: ExportErrors = {}
    if (!settings.folderPath.trim()) {
      nextErrors.folderPath = 'Please choose an export folder.'
    }
    if (settings.sizeMode === 'resize') {
      if (!Number.isFinite(settings.longEdge) || settings.longEdge < MIN_LONG_EDGE) {
        nextErrors.longEdge = `Long edge must be at least ${MIN_LONG_EDGE}px.`
      } else if (settings.longEdge > MAX_LONG_EDGE) {
        nextErrors.longEdge = `Long edge must be less than ${MAX_LONG_EDGE}px.`
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }, [settings])

  const handleBrowse = useCallback(() => {
    const suggested = settings.folderPath || '/Users/me/Pictures/Exports'
    const nextPath = typeof window !== 'undefined' ? window.prompt('Enter export folder path', suggested)?.trim() ?? null : null
    if (nextPath) {
      setSettings((prev) => ({ ...prev, folderPath: nextPath }))
      setErrors((prev) => ({ ...prev, folderPath: undefined }))
    }
  }, [settings.folderPath])

  const handlePresetChange = useCallback(
    (value: string) => {
      setPresetDropdown(value)
      if (value === DEFAULT_PRESET_VALUE) {
        setSettings((prev) => applySnapshot(prev, DEFAULT_SNAPSHOT, null))
        return
      }
      const preset = presets.find((item) => item.id === value)
      if (preset) {
        setSettings((prev) => applySnapshot(prev, preset.settings, preset.id))
      }
    },
    [presets],
  )

  const handleSavePreset = useCallback(() => {
    try {
      setPresetSaveError(null)
      const snapshot = snapshotFromState(settings)
      const saved = addPreset(presetName, snapshot)
      setPresetDropdown(saved.id)
      setSettings((prev) => ({ ...prev, presetId: saved.id }))
      setPresetSaveOpen(false)
      setPresetName('')
    } catch (error) {
      setPresetSaveError(error instanceof Error ? error.message : 'Unable to save preset')
    }
  }, [addPreset, presetName, settings])

  const handleExport = useCallback(async () => {
    if (!validate()) return
    if (!photos.length) return
    setPhase('exporting')
    setExportError(null)
    setPresetSaveOpen(false)
    const controller = new AbortController()
    abortRef.current = controller
    setProgress({ completed: 0, total: photos.length })
    try {
      const result = await exportSelectedPhotos(
        {
          photoIds: photos.map((photo) => photo.id),
          outputFormat: settings.outputFormat,
          rawHandling: settings.rawHandling,
          sizeMode: settings.sizeMode,
          longEdge: settings.longEdge,
          jpegQuality: settings.jpegQuality,
          contactSheetEnabled: settings.contactSheetEnabled,
          contactSheetFormat: settings.contactSheetFormat,
          folderPath: settings.folderPath,
          presetId: settings.presetId,
        },
        {
          signal: controller.signal,
          onProgress: (snapshot) => setProgress(snapshot),
        },
      )
      setExportResult(result)
      setPhase('success')
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setExportError('Export cancelled.')
      } else {
        setExportError(error instanceof Error ? error.message : 'Unable to export photos.')
      }
      setPhase('configure')
    } finally {
      abortRef.current = null
    }
  }, [photos, settings, validate])

  const handleCancelExport = useCallback(() => {
    if (!abortRef.current) return
    abortRef.current.abort()
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (!exportResult?.folderPath) return
    const path = exportResult.folderPath
    const normalized = path.startsWith('file://') ? path : `file://${path.replace(/^file:\/\//i, '')}`
    const opened = typeof window !== 'undefined' ? window.open(normalized, '_blank') : null
    if (!opened && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(path)
        setExportError('Opening folders is not supported in this preview. Path copied to clipboard.')
      } catch {
        setExportError('Unable to open the export folder.')
      }
    }
  }, [exportResult])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="flex w-[min(1120px,100%)] max-h-[90vh] flex-col overflow-hidden rounded-[28px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] shadow-2xl">
        <header className="border-b border-[var(--border,#E1D3B9)] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[var(--text,#1F1E1B)]">Export selected photos</p>
              <p className="text-sm text-[var(--text-muted,#6B645B)]">{totalSelected} photo{totalSelected === 1 ? '' : 's'} selected</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={phase === 'exporting'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-lg ${
                phase === 'exporting' ? 'cursor-not-allowed opacity-60' : 'hover:border-[var(--text,#1F1E1B)]'
              }`}
              aria-label="Close export dialog"
            >
              ✕
            </button>
          </div>
        </header>
        {phase === 'configure' ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col divide-y divide-[var(--border,#E1D3B9)] lg:flex-row lg:divide-x lg:divide-y-0">
              <div className="flex min-h-0 max-h-[60vh] flex-1 flex-col overflow-hidden px-6 py-5 lg:max-h-full lg:px-6">
                <p className="text-sm font-semibold text-[var(--text,#1F1E1B)]">
                  {totalSelected} photo{totalSelected === 1 ? '' : 's'} will be exported
                </p>
                <p className="text-xs text-[var(--text-muted,#6B645B)]">Selection snapshot is taken at the time export starts.</p>
                <div className="mt-4 flex-1 overflow-y-auto pr-2">
                  {photos.length ? (
                    <div className="space-y-3">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="flex items-center gap-3 rounded-[18px] border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2"
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-xl bg-[var(--placeholder-bg-beige,#F3EBDD)]">
                            {photo.thumbSrc ? (
                              <img src={photo.thumbSrc} alt={photo.name} className="h-full w-full object-cover" />
                            ) : (
                              <RawPlaceholderFrame ratio={photo.placeholderRatio} className="h-full w-full" title={photo.name} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[var(--text,#1F1E1B)]">{photo.name}</div>
                            <div className="truncate text-[11px] text-[var(--text-muted,#6B645B)]">{photo.basename ?? photo.id}</div>
                          </div>
                          <span className="rounded-full border border-[var(--border,#E1D3B9)] px-2 py-0.5 text-[11px] font-medium text-[var(--text,#1F1E1B)]">
                            {photo.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[18px] border border-dashed border-[var(--border,#E1D3B9)] text-sm text-[var(--text-muted,#6B645B)]">
                      Select at least one photo to enable exporting.
                    </div>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 w-full flex-col gap-5 overflow-y-auto px-6 py-5 lg:w-[420px] lg:pr-4">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]" htmlFor="export-preset-select">
                      Preset
                    </label>
                    <button
                      type="button"
                      onClick={() => setPresetSaveOpen((open) => !open)}
                      className="text-[12px] font-medium text-[var(--river-700,#2C5B58)] hover:underline"
                    >
                      Save current settings as preset…
                    </button>
                  </div>
                  <select
                    id="export-preset-select"
                    value={presetDropdown}
                    onChange={(event) => handlePresetChange(event.target.value)}
                    className="mt-2 h-10 w-full rounded-[14px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-sm text-[var(--text,#1F1E1B)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)]"
                  >
                    <option value={DEFAULT_PRESET_VALUE}>Default preset</option>
                    {presets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  {presetSaveOpen ? (
                    <div className="mt-3 rounded-[16px] border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] p-3 text-sm">
                      <label htmlFor="export-preset-name" className="text-[12px] font-medium text-[var(--text,#1F1E1B)]">
                        Preset name
                      </label>
                      <input
                        id="export-preset-name"
                        value={presetName}
                        onChange={(event) => setPresetName(event.target.value)}
                        className="mt-2 h-9 w-full rounded-[12px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)]"
                      />
                      {presetSaveError ? <p className="mt-1 text-[11px] text-[#B42318]">{presetSaveError}</p> : null}
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" onClick={() => setPresetSaveOpen(false)} className="text-[12px] text-[var(--text-muted,#6B645B)] hover:underline">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePreset}
                          className="rounded-full bg-[var(--text,#1F1E1B)] px-4 py-1 text-[12px] font-semibold text-white"
                        >
                          Save preset
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-4 rounded-[18px] border border-[var(--border,#E1D3B9)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">File format</p>
                  <label className="text-sm font-medium text-[var(--text,#1F1E1B)]" htmlFor="export-format-select">
                    Output format
                  </label>
                  <select
                    id="export-format-select"
                    value={settings.outputFormat}
                    onChange={(event) => setSettings((prev) => ({ ...prev, outputFormat: event.target.value as ExportSettingsState['outputFormat'] }))}
                    className="h-10 rounded-[14px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-sm"
                  >
                    <option value="JPEG">JPEG (default)</option>
                    <option value="TIFF">TIFF</option>
                    <option value="PNG">PNG</option>
                  </select>
                  {hasRawSource ? (
                    <div className="space-y-2 rounded-[16px] bg-[var(--sand-50,#FBF7EF)] p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">For RAW files</p>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={settings.rawHandling === 'raw'}
                          onChange={() => setSettings((prev) => ({ ...prev, rawHandling: 'raw' }))}
                        />
                        <span>Use RAW original files</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={settings.rawHandling === 'developed'}
                          onChange={() => setSettings((prev) => ({ ...prev, rawHandling: 'developed' }))}
                        />
                        <span>Use developed JPEG output</span>
                      </label>
                      <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                        RAW handling only applies to assets with a RAW source. Other files always use their current image.
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-[18px] border border-[var(--border,#E1D3B9)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Size &amp; quality</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={settings.sizeMode === 'original'} onChange={() => setSettings((prev) => ({ ...prev, sizeMode: 'original' }))} />
                    <span>Original size</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={settings.sizeMode === 'resize'} onChange={() => setSettings((prev) => ({ ...prev, sizeMode: 'resize' }))} />
                    <span className="flex items-center gap-2">
                      Resize by long edge
                      <input
                        type="number"
                        min={MIN_LONG_EDGE}
                        max={MAX_LONG_EDGE}
                        value={settings.longEdge}
                        disabled={settings.sizeMode !== 'resize'}
                        onChange={(event) => setSettings((prev) => ({ ...prev, longEdge: Number(event.target.value) }))}
                        className="h-9 w-20 rounded-[10px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 text-sm disabled:bg-[var(--sand-50,#FBF7EF)]"
                      />
                      <span>px</span>
                    </span>
                  </label>
                  {errors.longEdge ? <p className="text-[11px] text-[#B42318]">{errors.longEdge}</p> : null}
                  {jpegSettingsVisible ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span>JPEG quality</span>
                      <select
                        value={settings.jpegQuality}
                        onChange={(event) => setSettings((prev) => ({ ...prev, jpegQuality: Number(event.target.value) }))}
                        className="h-9 rounded-[10px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 text-sm"
                      >
                        {JPEG_QUALITY_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-[18px] border border-[var(--border,#E1D3B9)] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.contactSheetEnabled}
                        onChange={(event) => setSettings((prev) => ({ ...prev, contactSheetEnabled: event.target.checked }))}
                      />
                      <span>Also create contact sheet</span>
                    </label>
                    {settings.contactSheetEnabled ? (
                      <select
                        value={settings.contactSheetFormat}
                        onChange={(event) => setSettings((prev) => ({ ...prev, contactSheetFormat: event.target.value as ExportSettingsState['contactSheetFormat'] }))}
                        className="h-9 rounded-[10px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 text-sm"
                      >
                        <option value="PDF">PDF</option>
                        <option value="JPEG">JPEG</option>
                        <option value="TIFF">TIFF</option>
                      </select>
                    ) : null}
                  </div>
                  {settings.contactSheetEnabled ? (
                    <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                      Generates a vintage-style contact sheet with thumbnails and filenames for this export.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-[18px] border border-[var(--border,#E1D3B9)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Export location</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.folderPath}
                      readOnly
                      placeholder="Choose folder…"
                      className="h-10 flex-1 rounded-[14px] border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 text-sm text-[var(--text,#1F1E1B)]"
                    />
                    <button
                      type="button"
                      onClick={handleBrowse}
                      className="flex h-10 items-center rounded-[14px] border border-[var(--border,#E1D3B9)] px-4 text-sm font-semibold text-[var(--text,#1F1E1B)]"
                    >
                      Browse…
                    </button>
                  </div>
                  {errors.folderPath ? <p className="text-[11px] text-[#B42318]">{errors.folderPath}</p> : null}
                  <label className="flex items-center gap-2 text-sm text-[var(--text,#1F1E1B)]">
                    <input
                      type="checkbox"
                      checked={settings.storeFolderInPreset}
                      onChange={(event) => setSettings((prev) => ({ ...prev, storeFolderInPreset: event.target.checked }))}
                    />
                    <span>Store this folder in preset</span>
                  </label>
                </div>
              </div>
            </div>
            <footer className="flex items-center justify-between border-t border-[var(--border,#E1D3B9)] px-6 py-4">
              <div className="text-sm text-[var(--text-muted,#6B645B)]">{exportError}</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center rounded-full border border-[var(--border,#E1D3B9)] px-4 text-sm font-medium text-[var(--text,#1F1E1B)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!photos.length || !settings.folderPath}
                  onClick={handleExport}
                  className={`inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold ${
                    !photos.length || !settings.folderPath
                      ? 'cursor-not-allowed border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
                      : 'bg-[var(--charcoal-800,#1F1E1B)] text-white shadow-lg'
                  }`}
                >
                  Export {totalSelected} photo{totalSelected === 1 ? '' : 's'}
                </button>
              </div>
            </footer>
          </>
        ) : null}
        {phase === 'exporting' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div>
              <p className="text-xl font-semibold text-[var(--text,#1F1E1B)]">Exporting photos…</p>
              <p className="text-sm text-[var(--text-muted,#6B645B)]">
                Exporting {progress.total} photo{progress.total === 1 ? '' : 's'} to <span className="font-medium">{settings.folderPath}</span>
              </p>
            </div>
            <div className="h-3 w-full max-w-lg rounded-full bg-[var(--sand-100,#F3EBDD)]">
              <div
                className="h-full rounded-full bg-[var(--charcoal-800,#1F1E1B)] transition-[width]"
                style={{ width: progress.total ? `${Math.min(100, Math.round((progress.completed / progress.total) * 100))}%` : '0%' }}
              />
            </div>
            <p className="text-sm text-[var(--text-muted,#6B645B)]">
              Photo {Math.min(progress.completed, progress.total)} of {progress.total}
            </p>
            <button
              type="button"
              onClick={handleCancelExport}
              className="mt-2 inline-flex h-10 items-center rounded-full border border-[var(--border,#E1D3B9)] px-4 text-sm font-medium text-[var(--text,#1F1E1B)]"
            >
              Cancel export
            </button>
          </div>
        ) : null}
        {phase === 'success' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--river-100,#DCEDEC)] text-3xl text-[var(--river-700,#2C5B58)]">
              ✓
            </div>
            <div>
              <p className="text-xl font-semibold text-[var(--text,#1F1E1B)]">Successfully exported {progress.total} photo{progress.total === 1 ? '' : 's'}</p>
              <p className="text-sm text-[var(--text-muted,#6B645B)]">Saved to {exportResult?.folderPath ?? settings.folderPath}</p>
              {exportError ? <p className="mt-2 text-xs text-[#B42318]">{exportError}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenFolder}
                className="inline-flex h-10 items-center rounded-full border border-[var(--border,#E1D3B9)] px-4 text-sm font-medium text-[var(--text,#1F1E1B)]"
              >
                Open export folder
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-full bg-[var(--charcoal-800,#1F1E1B)] px-5 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export default ExportDialog
