import React from 'react'

export interface TagProps {
  label: string
  selected?: boolean
  onClick?: () => void
}

/**
 * A small pill used to represent tags throughout the UI. Selected
 * tags invert their colours and border. A click handler may be
 * provided to toggle selection.
 */
const Tag: React.FC<TagProps> = ({ label, selected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-[11px] border ${
        selected
          ? 'bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] border-[var(--primary,#A56A4A)]'
          : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text-muted,#6B645B)]'
      }`}
    >
      {label}
    </button>
  )
}

export default Tag
