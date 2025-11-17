import React from 'react'
import StoneTrailIcon from './StoneTrailIcon'

type DialogHeaderProps = {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  actions?: React.ReactNode
  closeLabel?: string
  closeDisabled?: boolean
  className?: string
}

/**
 * Shared dialog header that pins the Stone Trail key visual on the left,
 * keeps actions aligned on the right and standardises spacing across modals.
 */
export function DialogHeader({
  title,
  subtitle,
  onClose,
  actions,
  closeLabel = 'Close dialog',
  closeDisabled = false,
  className = '',
}: DialogHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-3 border-b border-[var(--border,#E1D3B9)] px-6 py-4 text-[var(--text,#1F1E1B)] sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)]"
        >
          <StoneTrailIcon size={26} />
        </span>
        {(title || subtitle) && (
          <div className="min-w-0">
            {title ? <p className="text-base font-semibold leading-tight text-[var(--text,#1F1E1B)]">{title}</p> : null}
            {subtitle ? <p className="text-[12px] text-[var(--text-muted,#6B645B)]">{subtitle}</p> : null}
          </div>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        {actions}
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-lg leading-none ${
            closeDisabled
              ? 'cursor-not-allowed border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] opacity-70'
              : 'border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)]'
          }`}
          aria-label={closeLabel}
        >
          ×
        </button>
      </div>
    </header>
  )
}

export default DialogHeader
