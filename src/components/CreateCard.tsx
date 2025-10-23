import React from 'react'
import type { Project } from '../features/projects/types'
import { aspectClass, placeholderRatioForAspect } from '../features/projects/utils'
import { RawPlaceholder } from './RawPlaceholder'

const MEDIA_MAX = 'max-h-[420px] md:max-h-[520px]'
// tailwind v4 scan hint
const __scan = 'aspect-[3/4] aspect-[16/9] aspect-square'

const CreateCard: React.FC<{ onClick: () => void; aspect?: Project['aspect'] }> = ({ onClick, aspect = 'portrait' }) => {
  const ratio = placeholderRatioForAspect(aspect)

  return (
    <div className="relative">
      <button
        onClick={onClick}
        type="button"
        aria-label="Create new project"
        className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)] rounded-xl"
      >
        <div className="overflow-hidden rounded-t-xl bg-[var(--surface,#FFFFFF)]">
          <div className={`relative ${aspectClass(aspect)} w-full ${MEDIA_MAX} overflow-hidden`}>
            <RawPlaceholder ratio={ratio} className="absolute inset-0" />
          </div>
        </div>
        <div className="rounded-b-xl border border-[var(--border,#E1D3B9)] border-t-0 bg-[var(--surface,#FFFFFF)] px-1.5 sm:px-2 md:px-3 pt-2 pb-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border,#E1D3B9)] bg-white">
              <span className="text-lg leading-none">＋</span>
            </span>
            <div className="text-left">
              <div className="text-[13px] font-medium tracking-tight">New project</div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Start from scratch</div>
            </div>
          </div>
        </div>
      </button>
    </div>
  )
}

export default CreateCard
