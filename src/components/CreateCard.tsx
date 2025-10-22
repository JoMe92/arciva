import React, { useState } from 'react'
import type { Project } from '../features/projects/types'
import { ph, phSizeFor, aspectClass } from '../features/projects/utils'

const CreateCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [a] = useState<Project['aspect']>(() => (['portrait', 'landscape', 'square'] as const)[Math.floor(Math.random() * 3)])
  const [w, h] = phSizeFor(a)

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        type="button"
        aria-label="Create new project"
        data-testid="create-card"
        className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)] rounded-xl"
      >
        {/* Gleiche Grundstruktur wie bei ProjectCard: Bildbereich + weißer Info-Balken */}
        <div className="overflow-hidden rounded-xl bg-[var(--surface,#FFFFFF)] border border-dashed border-[var(--border,#E1D3B9)] hover:border-[var(--text-muted,#6B645B)]">
          {/* Bildbereich (Placeholder) */}
          <div className={`relative ${aspectClass(a)} w-full`}>
            <img
              src={ph(w, h, 'Untitled project • Unassigned')}
              alt="Empty project placeholder"
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          </div>

          {/* Weißer Info-Balken unten – wie bei bestehenden Projekten */}
          <div className="px-1.5 sm:px-2 md:px-3 pt-2 pb-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border,#E1D3B9)] bg-white"
            >
              <span className="text-lg leading-none">＋</span>
            </span>
            <div className="text-left">
              <div className="text-[13px] font-medium tracking-tight text-[var(--text,#1F1E1B)]">
                New project
              </div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                Start from scratch
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

export default CreateCard
