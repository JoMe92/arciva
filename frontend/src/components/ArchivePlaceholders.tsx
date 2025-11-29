import React from 'react'
import { aspectClass, placeholderRatioForAspect } from '../features/projects/utils'
import { RawPlaceholder } from './RawPlaceholder'

/**
 * Renders a set of ghost cards representing archived projects. This
 * component is currently unused in the main UI but is included to
 * preserve parity with the original file. It may be useful for
 * skeleton or loading states in the future.
 */
const ArchivePlaceholders: React.FC = () => {
  const ghosts = [
    { id: 'g1', aspect: 'portrait' as const, label: 'Archived project' },
    { id: 'g2', aspect: 'landscape' as const, label: 'Archived project' },
    { id: 'g3', aspect: 'square' as const, label: 'Archived project' },
  ]
  return (
    <div className="space-y-14">
      <div className="grid grid-cols-3 gap-x-10 gap-y-10 items-start">
        {ghosts.map((g) => {
          const ratio = placeholderRatioForAspect(g.aspect)
          return (
            <div
              key={g.id}
              className="rounded-xl overflow-hidden bg-[var(--surface,#FFFFFF)] opacity-80"
            >
              <div className={`relative ${aspectClass(g.aspect)} w-full`}>
                <RawPlaceholder ratio={ratio} className="absolute inset-0" title={g.label} />
              </div>
              <div className="px-3 pt-2 pb-3 text-[11px] uppercase text-[var(--text-muted,#6B645B)]">
                Archive
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ArchivePlaceholders
