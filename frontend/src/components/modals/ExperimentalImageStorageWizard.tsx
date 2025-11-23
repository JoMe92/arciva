import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ModalShell from './ModalShell'
import {
  applyExperimentalStorageChange,
  validateExperimentalStoragePath,
  type ExperimentalStorageMode,
  type ExperimentalStorageSettings,
  type ExperimentalStorageValidationResult,
} from '../../shared/api/settings'

type ExperimentalImageStorageWizardProps = {
  open: boolean
  onClose: () => void
  currentSettings?: ExperimentalStorageSettings
  onSuccess: (message: string) => void
}

type WizardStep = 1 | 2 | 3

const clampWizardStep = (value: number): WizardStep => {
  if (value <= 1) return 1
  if (value >= 3) return 3
  return value as WizardStep
}

const STEP_META: Record<WizardStep, { title: string; caption: string }> = {
  1: {
    title: 'Choose new image storage path',
    caption: 'Select a folder on your local machine to store the PhotoStore (Uploads, Original, Export, etc.).',
  },
  2: {
    title: 'How should existing data be handled?',
    caption: 'Pick whether to create a fresh PhotoStore or load an existing one from the selected folder.',
  },
  3: {
    title: 'Summary & confirmation',
    caption: 'Review the changes, read the experimental disclaimer, and acknowledge before applying.',
  },
}

const MODE_DESCRIPTIONS: Record<ExperimentalStorageMode, { label: string; description: string; note?: string }> = {
  fresh: {
    label: 'Start fresh with an empty PhotoStore',
    description: 'Creates a brand-new database at the selected path. Previous projects disappear from the app (files stay on disk for manual recovery).',
    note: '⚠ Experimental: use when you want to completely reset storage for local testing.',
  },
  load: {
    label: 'Load existing PhotoStore from this folder',
    description: 'Reuses the arciva.db file already present in the folder and keeps all existing projects/images.',
    note: 'Requires the folder to contain an arciva.db created by this app.',
  },
}

const DEFAULT_MODE: ExperimentalStorageMode = 'fresh'

const ExperimentalImageStorageWizard: React.FC<ExperimentalImageStorageWizardProps> = ({ open, onClose, currentSettings, onSuccess }) => {
  const [step, setStep] = useState<WizardStep>(1)
  const [selectedPath, setSelectedPath] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [validation, setValidation] = useState<ExperimentalStorageValidationResult | null>(null)
  const [validationPending, setValidationPending] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mode, setMode] = useState<ExperimentalStorageMode>(DEFAULT_MODE)
  const [acknowledged, setAcknowledged] = useState(false)
  const [applyPending, setApplyPending] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const currentPrimaryPath = useMemo(() => {
    return currentSettings?.locations.find((loc) => loc.role === 'primary')?.path ?? '—'
  }, [currentSettings?.locations])

  useEffect(() => {
    if (!open) return
    setStep(1)
    setSelectedPath('')
    setManualInput('')
    setValidation(null)
    setValidationError(null)
    setMode(DEFAULT_MODE)
    setAcknowledged(false)
    setApplyPending(false)
    setApplyError(null)
    setLogs([])
  }, [open])

  useEffect(() => {
    if (!selectedPath.trim()) {
      setValidation(null)
      setValidationError(null)
      return
    }
    let cancelled = false
    setValidationPending(true)
    setValidationError(null)
    const timeout = window.setTimeout(() => {
      validateExperimentalStoragePath({ path: selectedPath, mode })
        .then((result) => {
          if (cancelled) return
          setValidation(result)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          const message = error instanceof Error ? error.message : 'Unable to validate path.'
          setValidation({ path: selectedPath, valid: false, message })
          setValidationError(message)
        })
        .finally(() => {
          if (!cancelled) setValidationPending(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [selectedPath, mode])

  const handleManualApply = useCallback(() => {
    const trimmed = manualInput.trim()
    if (!trimmed) {
      setValidationError('Enter an absolute path to continue.')
      return
    }
    setSelectedPath(trimmed)
    setValidationError(null)
  }, [manualInput])

  const canProceed = step === 1 ? Boolean(validation?.valid && !validationPending) : step === 2 ? Boolean(mode) : false
  const canApply = step === 3 ? acknowledged && !applyPending : false

  const proceedToNext = useCallback(() => {
    if (!canProceed || step >= 3) return
    setStep((prev) => clampWizardStep(prev + 1))
  }, [canProceed, step])

  const goBack = useCallback(() => {
    if (step === 1) return
    setStep((prev) => clampWizardStep(prev - 1))
  }, [step])

  const handleApply = useCallback(async () => {
    if (!selectedPath.trim() || !acknowledged || applyPending) return
    setApplyPending(true)
    setApplyError(null)
    setLogs((prev) => [...prev, `Applying experimental change (${mode}) to ${selectedPath}…`])
    try {
      await applyExperimentalStorageChange({
        path: selectedPath.trim(),
        mode,
        acknowledge: true,
      })
      setLogs((prev) => [...prev, 'Experimental image storage settings updated successfully.'])
      onSuccess('Experimental image storage settings updated successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to apply experimental changes.'
      setApplyError(message)
      setLogs((prev) => [...prev, `Failed to apply changes: ${message}`])
    } finally {
      setApplyPending(false)
    }
  }, [acknowledged, applyPending, mode, onSuccess, selectedPath])

  if (!open) return null

  const renderStepNavigation = () => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--surface-subtle,#FBF7EF)] px-4 py-2 text-[12px] text-[var(--text-muted,#6B645B)]">
        <span>Step {step} of 3 · {STEP_META[step].title}</span>
        <span className="text-[11px] text-red-600">Experimental use only</span>
      </div>
    )
  }

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-4">
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{STEP_META[1].caption}</p>
          <label className="text-[12px] font-semibold text-[var(--text,#1F1E1B)]">New image storage path (local)</label>
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">
            Enter the folder that should host the PhotoStore (Uploads, Original, Export, etc.). Only choose local or directly mounted drives for this experimental feature.
          </p>
          <div className="space-y-2 rounded-2xl bg-[var(--surface-subtle,#FBF7EF)] px-3 py-3">
            <label className="text-[12px] font-medium text-[var(--text,#1F1E1B)]">Folder path</label>
            <input
              type="text"
              value={manualInput}
              onChange={(event) => setManualInput(event.target.value)}
              placeholder="/media/drive/photo-store"
              className="w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--stone-trail-brand-focus,#4A463F)]"
            />
            <button
              type="button"
              onClick={handleManualApply}
              className="rounded-full border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] px-4 py-2 text-[13px] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]"
            >
              Use this path
            </button>
          </div>
          {validationPending ? <p className="text-[12px] text-[var(--text-muted,#6B645B)]">Validating path…</p> : null}
          {validation ? (
            <p className={`text-[12px] ${validation.valid ? 'text-emerald-600' : 'text-red-600'}`}>
              {validation.valid ? 'Path looks good.' : validation.message ?? 'Selected folder is not writable. Please choose another path.'}
            </p>
          ) : null}
          {validationError ? <p className="text-[12px] text-red-600">{validationError}</p> : null}
        </div>
      )
    }
    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{STEP_META[2].caption}</p>
          <div className="space-y-3">
            {(Object.keys(MODE_DESCRIPTIONS) as ExperimentalStorageMode[]).map((option) => (
              <label
                key={option}
                className={`flex flex-col gap-2 rounded-3xl border px-4 py-3 ${mode === option ? 'border-[var(--primary,#A56A4A)] bg-[var(--surface,#FFFFFF)]' : 'border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="experimental-storage-mode"
                    className="mt-1"
                    checked={mode === option}
                    onChange={() => setMode(option)}
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--text,#1F1E1B)]">{MODE_DESCRIPTIONS[option].label}</p>
                    <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{MODE_DESCRIPTIONS[option].description}</p>
                    {MODE_DESCRIPTIONS[option].note ? (
                      <p className={`mt-2 rounded-2xl border px-3 py-2 text-[11px] ${option === 'fresh' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                        {MODE_DESCRIPTIONS[option].note}
                      </p>
                    ) : null}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-4 py-3">
          <p className="text-[13px] font-semibold text-[var(--text,#1F1E1B)]">Summary</p>
          <dl className="mt-2 space-y-1 text-[12px] text-[var(--text,#1F1E1B)]">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Current image storage path (old)</dt>
              <dd className="font-mono text-[12px]" title={currentPrimaryPath}>
                {currentPrimaryPath}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">New image storage path</dt>
              <dd className="font-mono text-[12px]" title={selectedPath}>
                {selectedPath}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Selected option</dt>
              <dd className="text-[12px]">{MODE_DESCRIPTIONS[mode].label} (experimental)</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
          {mode === 'fresh'
            ? '⚠ Starting fresh creates a brand-new, empty database at this path. Existing projects will disappear from the app, though their files remain on disk if you ever need to revert.'
            : '⚠ Loading an existing PhotoStore will keep any projects already stored in arciva.db inside the selected folder.'}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[var(--text,#1F1E1B)]">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          I understand that this is an experimental developer feature and that behavior may change.
        </label>
        {applyError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{applyError}</div> : null}
        {logs.length ? (
          <div className="space-y-1 rounded-2xl bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2 text-[11px] text-[var(--text-muted,#6B645B)]">
            {logs.map((entry, index) => (
              <p key={`${entry}-${index}`}>{entry}</p>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <ModalShell
      title="Change Image Storage Location (Experimental)"
      subtitle="Experimental feature for local development only. This UI may be removed or changed in future versions."
      onClose={onClose}
      footerRight={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} disabled={applyPending} className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px]">
            Cancel
          </button>
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={applyPending}
              className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px] text-[var(--text,#1F1E1B)] disabled:opacity-60"
            >
              Back
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              onClick={proceedToNext}
              disabled={!canProceed}
              className={`h-9 rounded-full px-4 text-[13px] ${
                !canProceed
                  ? 'cursor-not-allowed border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
                  : 'border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'
              }`}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              disabled={!canApply}
              className={`h-9 rounded-full px-4 text-[13px] ${
                !canApply
                  ? 'cursor-not-allowed border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
                  : 'border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)]'
              }`}
            >
              {applyPending ? 'Applying…' : 'Apply experimental changes'}
            </button>
          )}
        </div>
      }
    >
      {renderStepNavigation()}
      <div className="mt-4">{renderStepContent()}</div>
    </ModalShell>
  )
}

export default ExperimentalImageStorageWizard
