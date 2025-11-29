import React from 'react'

export function RailDivider() {
  return <div className="h-px w-8 rounded-full bg-[var(--border,#EDE1C6)]" aria-hidden="true" />
}

export function InspectorRailButton({
  icon,
  label,
  onClick,
  ariaControls,
  ariaExpanded,
  isActive = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  ariaControls?: string
  ariaExpanded?: boolean
  isActive?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-transparent text-[var(--text,#1F1E1B)] transition hover:bg-[var(--surface-subtle,#FBF7EF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${
        isActive ? 'border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)]' : ''
      }`}
    >
      {icon}
    </button>
  )
}
