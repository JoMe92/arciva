import React, { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ModalShell from './ModalShell'
import ExperimentalImageStorageWizard from './ExperimentalImageStorageWizard'
import type { GeneralSettings } from '../../shared/settings/general'
import { LANGUAGE_OPTIONS } from '../../shared/settings/general'
import { useBulkImageExport } from '../../shared/bulkExport/BulkImageExportContext'
import { formatBytes } from '../../shared/formatBytes'
import type { ExperimentalStorageStatus } from '../../shared/api/settings'
import { useExperimentalStorageSettings, useInvalidateExperimentalStorage } from '../../shared/settings/experimentalImageStorage'

type GeneralSettingsDialogProps = {
  open: boolean
  settings: GeneralSettings
  onClose: () => void
  onSave: (settings: GeneralSettings) => void
}

const GeneralSettingsDialog: React.FC<GeneralSettingsDialogProps> = ({ open, settings, onClose, onSave }) => {
  const [language, setLanguage] = useState<GeneralSettings['language']>(settings.language)
  const [saving, setSaving] = useState(false)
  const [storageWizardOpen, setStorageWizardOpen] = useState(false)
  const [storageSuccess, setStorageSuccess] = useState<string | null>(null)
  const { state: bulkState, startExport, cancelExport, downloadResult } = useBulkImageExport()
  const queryClient = useQueryClient()
  const bulkPhase = bulkState.phase
  const bulkProgress = bulkState.progress
  const bulkResult = bulkState.result
  const bulkError = bulkState.phase === 'error' ? bulkState.error : null
  const bulkEstimate = bulkState.estimate
  const invalidateExperimentalStorageSettings = useInvalidateExperimentalStorage()
  const experimentalUiEnabled = import.meta.env.DEV
  const {
    data: experimentalStorage,
    isLoading: storageLoading,
    isError: experimentalStorageError,
    error: experimentalStorageErrorValue,
  } = useExperimentalStorageSettings({ enabled: experimentalUiEnabled && open })

  const storageErrorMessage = experimentalStorageError
    ? experimentalStorageErrorValue instanceof Error
      ? experimentalStorageErrorValue.message
      : 'Unable to load experimental image storage settings.'
    : null

  const handleStorageWizardSuccess = useCallback(
    (message: string) => {
      setStorageWizardOpen(false)
      setStorageSuccess(message)
      void invalidateExperimentalStorageSettings()
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    [invalidateExperimentalStorageSettings, queryClient],
  )

  const handleCopyStoragePath = useCallback((path: string) => {
    if (!path) return
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(path)
        .then(() => setStorageSuccess('Path copied to clipboard.'))
        .catch(() => setStorageSuccess(`Copied path: ${path}`))
    } else {
      setStorageSuccess(`Copied path: ${path}`)
    }
  }, [])

  const storageStatusBadge = (status: ExperimentalStorageStatus) => {
    if (status === 'available') {
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Available</span>
    }
    if (status === 'missing') {
      return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">Not available</span>
    }
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">Not writable</span>
  }

  const renderStorageLocations = () => {
    if (!experimentalStorage) {
      if (storageLoading) {
        return <p className="text-[12px] text-[var(--text-muted,#6B645B)]">Loading experimental storage info…</p>
      }
      if (storageErrorMessage) {
        return <p className="text-[12px] text-red-600">{storageErrorMessage}</p>
      }
      return <p className="text-[12px] text-[var(--text-muted,#6B645B)]">No storage configuration found yet.</p>
    }
    if (!experimentalStorage.locations.length) {
      return <p className="text-[12px] text-[var(--text-muted,#6B645B)]">No storage configuration found yet.</p>
    }
    if (experimentalStorage.locations.length === 1) {
      const location = experimentalStorage.locations[0]
      return (
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-[var(--text,#1F1E1B)]">Current image storage path (experimental)</label>
          <div
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-[13px] ${
              location.status === 'available' ? 'border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]' : 'border-red-200 bg-red-50'
            }`}
          >
            <span className="flex-1 truncate font-mono" title={location.path}>
              {location.path}
            </span>
            <button type="button" onClick={() => handleCopyStoragePath(location.path)} className="text-[12px] font-medium text-[var(--primary,#A56A4A)]">
              Copy
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted,#6B645B)]">This local folder contains your photo storage (Uploads, Original, Export, etc.) for development.</p>
          <div className="flex items-center gap-2">
            {storageStatusBadge(location.status)}
            {location.message ? <span className="text-[11px] text-red-600">{location.message}</span> : null}
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[var(--text,#1F1E1B)]">Active storage paths</p>
        <div className="rounded-3xl border border-[var(--border,#E1D3B9)]">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_160px] gap-3 border-b border-[var(--border,#E1D3B9)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            <span>Path</span>
            <span>Role</span>
            <span>Status</span>
          </div>
          {experimentalStorage.locations.map((location) => (
            <div
              key={location.id}
              className="grid grid-cols-[minmax(0,1fr)_120px_160px] gap-3 border-b border-[var(--border,#E1D3B9)] px-4 py-3 text-[12px] last:border-b-0"
            >
              <div>
                <p className="font-mono text-[12px]" title={location.path}>
                  {location.path}
                </p>
                {location.message ? <p className="text-[11px] text-red-600">{location.message}</p> : null}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                {location.role === 'primary' ? 'Primary (new imports)' : 'Secondary'}
              </div>
              <div className="flex items-center gap-2">{storageStatusBadge(location.status)}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
          Multiple storage locations are currently used for development. This configuration is experimental and may not be supported in production.
        </p>
      </div>
    )
  }

  useEffect(() => {
    if (!open) return
    setLanguage(settings.language)
  }, [open, settings.language])

  useEffect(() => {
    if (!open) {
      setStorageWizardOpen(false)
      setStorageSuccess(null)
    }
  }, [open])

  useEffect(() => {
    if (!storageSuccess) return
    const timeout = window.setTimeout(() => setStorageSuccess(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [storageSuccess])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await Promise.resolve(onSave({ language }))
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const handleStartBulkExport = useCallback(() => {
    void startExport()
  }, [startExport])

  const handleDownloadBulkResult = useCallback(() => {
    downloadResult()
  }, [downloadResult])

  if (!open) return null

  const disableSaveButton = saving

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
            disabled={disableSaveButton}
            className={`h-9 rounded-full border px-4 text-[13px] ${disableSaveButton ? 'cursor-not-allowed border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[var(--text-muted,#6B645B)]' : 'border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'}`}
          >
            {saving ? 'Saving…' : 'Save changes'}
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
        {experimentalUiEnabled ? (
          <section className="mt-8 space-y-4 border-t border-dashed border-red-200 pt-6">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--text,#1F1E1B)]">Experimental (Developer Only)</h3>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">Experimental</span>
            </div>
            <div className="space-y-4 rounded-3xl border border-red-200 bg-red-50/40 p-4">
              <div>
                <p className="text-[13px] font-semibold text-red-700">
                  ⚠ Experimental feature for local development only. Behavior may change or be removed later.
                </p>
                <p className="text-[12px] text-[var(--text,#1F1E1B)]">Configure where your local PhotoStore (Uploads, Original, Export, etc.) is stored while testing on this machine.</p>
              </div>
              {storageSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">{storageSuccess}</div>
              ) : null}
              {experimentalStorage?.warning_active ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  Experimental storage configuration: one or more paths are not available. Some images may be missing until all locations are connected.
                </div>
              ) : null}
              {renderStorageLocations()}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setStorageWizardOpen(true)}
                  disabled={!experimentalStorage?.enabled || storageLoading}
                  className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] ${
                    !experimentalStorage?.enabled || storageLoading
                      ? 'cursor-not-allowed border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
                      : 'border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'
                  }`}
                >
                  Change image storage location (Experimental)…
                </button>
                <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                  Use this to test different local photo storage locations. This feature is intended for developers only.
                </p>
                {!experimentalStorage?.enabled ? (
                  <p className="text-[11px] text-[var(--text-muted,#6B645B)]">Disabled in production builds.</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </form>
      {experimentalUiEnabled ? (
        <ExperimentalImageStorageWizard open={storageWizardOpen} onClose={() => setStorageWizardOpen(false)} currentSettings={experimentalStorage} onSuccess={handleStorageWizardSuccess} />
      ) : null}
    </ModalShell>
  )
}

export default GeneralSettingsDialog
