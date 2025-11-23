import React from 'react'
import SettingsIcon from '../shared/icons/SettingsIcon'

type ProjectSettingsButtonProps = {
  onClick: () => void
  disabled?: boolean
  label?: string
  title?: string
  className?: string
}

/**
 * Small rounded icon button that launches the project settings dialog.
 * Reusing it keeps hover/focus/disabled states identical everywhere.
 */
const ProjectSettingsButton: React.FC<ProjectSettingsButtonProps> = ({ onClick, disabled = false, label, title, className }) => {
  const fallbackLabel = 'Open application settings'
  const ariaLabel = label || fallbackLabel
  const buttonTitle = title || fallbackLabel
  const enabledClasses =
    'border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)] hover:text-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)]'
  const disabledClasses = 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] opacity-60 cursor-not-allowed'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={buttonTitle}
      className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border bg-[var(--surface,#FFFFFF)] transition-colors ${disabled ? disabledClasses : enabledClasses} ${className || ''}`}
    >
      <SettingsIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

export default ProjectSettingsButton
