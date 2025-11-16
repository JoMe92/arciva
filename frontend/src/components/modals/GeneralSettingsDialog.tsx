import React, { useCallback, useEffect, useRef, useState } from 'react'
import ModalShell from './ModalShell'
import type { GeneralSettings } from '../../shared/settings/general'
import { LANGUAGE_OPTIONS } from '../../shared/settings/general'
import { exportAllProjectImages, type BulkImageExportProgress, type BulkImageExportResult } from '../../shared/api/bulkImageExports'
import { triggerBrowserDownload } from '../../shared/downloads'

type GeneralSettingsDialogProps = {
  open: boolean
  settings: GeneralSettings
  onClose: () => void
  onSave: (settings: GeneralSettings) => void
}

const GeneralSettingsDialog: React.FC<GeneralSettingsDialogProps> = ({ open, settings, onClose, onSave }) => {
  const [language, setLanguage] = useState<GeneralSettings['language']>(settings.language)
  const [bulkPhase, setBulkPhase] = useState<'idle' | 'running' | 'success'>('idle')
  const [bulkProgress, setBulkProgress] = useState<BulkImageExportProgress>({ completed: 0, total: 0 })
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkImageExportResult | null>(null)
  const [autoDownloadedJobId, setAutoDownloadedJobId] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const downloadUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (open) {
      setLanguage(settings.language)
    }
  }, [open, settings.language])

  if (!open) return null

    const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault()
      onSave({ language })
    }

  const handleStartBulkExport = useCallback(async () => {
    if (bulkPhase === 'running') return
    if (controllerRef.current) {
      controllerRef.current.abort()
    }
    setBulkPhase('running')
    setBulkError(null)
    setBulkResult(null)
    setAutoDownloadedJobId(null)
    setBulkProgress({ completed: 0, total: 0 })
    const controller = new AbortController()
    controllerRef.current = controller
    try {
      const result = await exportAllProjectImages({
        signal: controller.signal,
        onProgress: (snapshot) => setBulkProgress({ completed: snapshot.completed, total: snapshot.total }),
      })
      setBulkResult(result)
      setBulkPhase('success')
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setBulkError('Export cancelled.')
      } else {
        setBulkError(error instanceof Error ? error.message : 'Unable to export images.')
      }
      setBulkPhase('idle')
    } finally {
      controllerRef.current = null
    }
  }, [bulkPhase])

  const handleDownloadBulkResult = useCallback(() => {
    if (!bulkResult?.downloadUrl) return
    triggerBrowserDownload(bulkResult.downloadUrl, bulkResult.downloadFilename)
  }, [bulkResult])

  useEffect(() => {
    if (!open && controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (downloadUrlRef.current && downloadUrlRef.current !== (bulkResult?.downloadUrl ?? null)) {
      URL.revokeObjectURL(downloadUrlRef.current)
    }
    downloadUrlRef.current = bulkResult?.downloadUrl ?? null
  }, [bulkResult?.downloadUrl])

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (bulkPhase !== 'success' || !bulkResult?.downloadUrl) return
    if (autoDownloadedJobId && autoDownloadedJobId === bulkResult.jobId) return
    triggerBrowserDownload(bulkResult.downloadUrl, bulkResult.downloadFilename)
    setAutoDownloadedJobId(bulkResult.jobId)
  }, [autoDownloadedJobId, bulkPhase, bulkResult])

  const basisDescription =
    bulkResult?.dateBasis && bulkResult.dateBasis !== 'capture-date'
      ? 'Capture date.'
      : 'Capture date (falls back to upload time when metadata is missing).'
  const folderTemplate = bulkResult?.folderTemplate ?? 'year/month/day'
  const bulkButtonLabel = bulkPhase === 'running' ? 'Preparing archive…' : 'Download all images'
  const bulkProgressLabel =
    bulkPhase === 'running'
      ? `Packaging ${bulkProgress.total ? `${bulkProgress.completed} of ${bulkProgress.total}` : `${bulkProgress.completed}`} images…`
      : null

  return (
    <ModalShell
      title="Application settings"
      subtitle="These settings apply to the whole app, regardless of which project is open."
      onClose={onClose}
      footerRight={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="general-settings-form"
            className="h-9 rounded-full border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] px-4 text-[13px] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]"
          >
            Save changes
          </button>
        </>
      }
    >
      <form id="general-settings-form" onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-4">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Language</legend>
          <p className="text-[12px] text-[var(--text-muted,#6B645B)] mb-3">Choose the language used across menus and dialogs.</p>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as GeneralSettings['language'])}
            className="w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--stone-trail-brand-focus,#4A463F)]"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset className="space-y-3 rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-4">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Image archive</legend>
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">
            Download every project image as a ZIP archive organised in a {folderTemplate} folder hierarchy. Images are grouped by capture date when available.
          </p>
          <p className="text-[11px] text-[var(--text-muted,#6B645B)]">{basisDescription}</p>
          <p className="text-[11px] text-[var(--text-muted,#6B645B)]">This contains image files only—metadata/database exports live in their own workflow.</p>
          <button
            type="button"
            onClick={handleStartBulkExport}
            disabled={bulkPhase === 'running'}
            className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] ${bulkPhase === 'running' ? 'cursor-wait border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[var(--text-muted,#6B645B)]' : 'border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'}`}
          >
            {bulkButtonLabel}
          </button>
          {bulkProgressLabel ? <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{bulkProgressLabel}</p> : null}
          {bulkError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{bulkError}</div>
          ) : null}
          {bulkResult && bulkPhase === 'success' ? (
            <div className="rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-3">
              <p className="text-[13px] font-semibold text-[var(--text,#1F1E1B)]">Archive ready to download</p>
              <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{bulkResult.totalFiles} images packaged as a ZIP archive.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBulkResult}
                  disabled={!bulkResult.downloadUrl}
                  className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] ${
                    bulkResult.downloadUrl
                      ? 'border border-[var(--charcoal-900,#1F1E1B)] bg-[var(--charcoal-900,#1F1E1B)] text-white hover:bg-[var(--charcoal-800,#2A2926)]'
                      : 'cursor-not-allowed border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
                  }`}
                >
                  Download archive
                </button>
                <p className="text-[11px] text-[var(--text-muted,#6B645B)]">Download starts automatically when ready.</p>
              </div>
            </div>
          ) : null}
        </fieldset>
      </form>
    </ModalShell>
  )
}

export default GeneralSettingsDialog
