import React from 'react'
import type { Project } from '../features/projects/types'
import { ph, phSizeFor, aspectClass } from '../features/projects/utils'

const ProjectCard: React.FC<{
  p: Project
  onOpen: (id: string) => void
  onArchive: (id: string) => void // bleibt als Prop für Konsistenz, wird hier jedoch NICHT mehr genutzt
  onUnarchive: (id: string) => void // dito
  archiveMode: boolean // dito
  onEdit: (p: Project) => void
}> = ({ p, onOpen, onEdit }) => {
  const [w, h] = phSizeFor(p.aspect)
  const src = p.image ?? ph(w, h, `${p.title} • ${p.client}`)

  return (
    <div className="relative">
      {/* Klickfläche: Bild */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open project: ${p.title}`}
        aria-keyshortcuts="Enter Space"
        data-testid={`project-card-${p.id}`}
        onClick={() => onOpen(p.id)}
        onDoubleClick={() => onOpen(p.id)}
        onKeyDown={(e) => {
          const key = (e.key || '').toLowerCase()
          if (key === 'enter' || key === ' ' || key === 'spacebar') {
            e.preventDefault()
            onOpen(p.id)
          }
        }}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)] rounded-xl"
      >
        <div className="overflow-hidden rounded-t-xl bg-[var(--surface,#FFFFFF)]">
          <div className={`relative ${aspectClass(p.aspect)} w-full`}>
            <img
              src={src}
              alt={`${p.title} – ${p.client}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Weißer Info-Bereich unten – mit Titel/Client links und Aktionen rechts */}
      <div className="rounded-b-xl border border-[var(--border,#E1D3B9)] border-t-0 bg-[var(--surface,#FFFFFF)] px-1.5 sm:px-2 md:px-3 pt-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium tracking-tight text-[var(--text,#1F1E1B)]">
              {p.title}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
              {p.client}
            </div>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="Project actions">
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className="h-8 px-3 rounded-full bg-[var(--basalt-700,#4A463F)] text-white text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)]"
              aria-label={`Open ${p.title}`}
              data-testid="card-footer-open"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="h-8 px-3 rounded-full border border-[var(--border,#E1D3B9)] bg-white text-[12px] hover:border-[var(--text-muted,#6B645B)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)]"
              aria-label="Edit project"
              data-testid="card-footer-edit"
            >
              Edit
            </button>
            {/* WICHTIG: Kein Archive/Unarchive-Button mehr hier.
               Archivieren ausschließlich im Edit-Dialog. */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
