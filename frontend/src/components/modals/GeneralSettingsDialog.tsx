import React, { useEffect, useState } from 'react'
import ModalShell from './ModalShell'
import type { GeneralSettings } from '../../shared/settings/general'
import { LANGUAGE_OPTIONS } from '../../shared/settings/general'

type GeneralSettingsDialogProps = {
  open: boolean
  settings: GeneralSettings
  onClose: () => void
  onSave: (settings: GeneralSettings) => void
}

const GeneralSettingsDialog: React.FC<GeneralSettingsDialogProps> = ({ open, settings, onClose, onSave }) => {
  const [language, setLanguage] = useState<GeneralSettings['language']>(settings.language)

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
      </form>
    </ModalShell>
  )
}

export default GeneralSettingsDialog
