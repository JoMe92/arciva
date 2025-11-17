import React, { useCallback, useEffect, useState } from 'react'
import ModalShell from './ModalShell'
import type { GeneralSettings } from '../../shared/settings/general'
import { LANGUAGE_OPTIONS } from '../../shared/settings/general'
import { useBulkImageExport } from '../../shared/bulkExport/BulkImageExportContext'
import { formatBytes } from '../../shared/formatBytes'

type GeneralSettingsDialogProps = {
  open: boolean
  settings: GeneralSettings
  onClose: () => void
  onSave: (settings: GeneralSettings) => void
}

const GeneralSettingsDialog: React.FC<GeneralSettingsDialogProps> = ({ open, settings, onClose, onSave }) => {
  const [language, setLanguage] = useState<GeneralSettings['language']>(settings.language)
  const { state: bulkState, startExport, cancelExport, downloadResult } = useBulkImageExport()
  const bulkPhase = bulkState.phase
  const bulkProgress = bulkState.progress
  const bulkResult = bulkState.result
  const bulkError = bulkState.phase === 'error' ? bulkState.error : null
  const bulkEstimate = bulkState.estimate

  useEffect(() => {
    if (open) {
      setLanguage(settings.language)
    }
  }, [open, settings.language])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSave({ language })
  }

  const handleStartBulkExport = useCallback(() => {
    void startExport()
  }, [startExport])

  const handleDownloadBulkResult = useCallback(() => {
    downloadResult()
  }, [downloadResult])

  if (!open) return null

  const basisDescription =
    bulkResult?.dateBasis && bulkResult.dateBasis !== 'capture-date'
      ? 'Capture date.'
      : 'Capture date (falls back to upload time when metadata is missing).'
  const folderTemplate = bulkResult?.folderTemplate ?? 'year/month/day'
  const bulkButtonLabel = bulkPhase === 'running' ? 'Preparing archive…' : bulkPhase === 'estimating' ? 'Estimating size…' : 'Download all images'
  const bulkProgressLabel =
    bulkPhase === 'running'
      ? `Packaging ${bulkProgress.total ? `${bulkProgress.completed} of ${bulkProgress.total}` : `${bulkProgress.completed}`} images…`
      : null
  const bulkProgressPercent =
    bulkPhase === 'running' && bulkProgress.total > 0 ? Math.min(100, Math.round((bulkProgress.completed / bulkProgress.total) * 100)) : null

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
          {bulkEstimate ? (
            <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
              Estimated size: {bulkEstimate.totalFiles} images (~{formatBytes(bulkEstimate.totalBytes)}).
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleStartBulkExport}
              disabled={bulkPhase === 'running' || bulkPhase === 'estimating'}
              className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] ${bulkPhase === 'running' ? 'cursor-wait border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[var(--text-muted,#6B645B)]' : 'border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'}`}
            >
              {bulkButtonLabel}
            </button>
            {bulkPhase === 'running' ? (
              <button type="button" onClick={cancelExport} className="text-[11px] text-[var(--text-muted,#6B645B)] underline hover:text-[var(--text,#1F1E1B)]">
                Cancel export
              </button>
            ) : null}
          </div>
          {bulkPhase === 'running' ? (
            <p className="text-[11px] text-[var(--text-muted,#6B645B)]">You can close this dialog—the export keeps running in the background.</p>
          ) : bulkPhase === 'estimating' ? (
            <p className="text-[11px] text-[var(--text-muted,#6B645B)]">Gathering an estimate… hang tight.</p>
          ) : null}
          {bulkProgressLabel ? (
            <div className="space-y-1">
              <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{bulkProgressLabel}</p>
              {typeof bulkProgressPercent === 'number' ? (
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border,#E1D3B9)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary,#A56A4A)] transition-all"
                    style={{ width: `${bulkProgressPercent}%` }}
                    aria-valuenow={bulkProgressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
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
