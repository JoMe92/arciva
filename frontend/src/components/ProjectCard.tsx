import React from 'react'
import type { Project } from '../features/projects/types'
import { aspectClass, placeholderRatioForAspect } from '../features/projects/utils'
import { RawPlaceholder } from './RawPlaceholder'

const MEDIA_MAX = 'max-h-[420px] md:max-h-[520px]'

const ProjectCard: React.FC<{
  p: Project
  onOpen: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  archiveMode: boolean
  onEdit: (p: Project) => void
}> = ({ p, onOpen, onEdit }) => {
  const placeholderRatio = placeholderRatioForAspect(p.aspect)
  const previews = React.useMemo(() => {
    const list = (p.previewImages ?? [])
      .filter((img) => Boolean(img?.url))
      .map((img) => ({ ...img }))
      .sort((a, b) => a.order - b.order)
    if (!list.length && p.image) {
      list.push({ url: p.image, order: 0 })
    }
    return list
  }, [p.previewImages, p.image])
  const [hovered, setHovered] = React.useState(false)
  const [activePreview, setActivePreview] = React.useState(0)
  const hasImage = previews.length > 0
  const current = hasImage ? previews[Math.max(0, Math.min(activePreview, previews.length - 1))] : null
  const currentUrl = current?.url ?? null
  const showNav = hovered && previews.length > 1

  React.useEffect(() => {
    setActivePreview(0)
  }, [previews])

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setActivePreview((idx) => {
      if (!previews.length) return 0
      return idx === 0 ? previews.length - 1 : idx - 1
    })
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setActivePreview((idx) => {
      if (!previews.length) return 0
      return idx === previews.length - 1 ? 0 : idx + 1
    })
  }

  const handleFocus = () => setHovered(true)
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && event.currentTarget.contains(next)) {
      return
    }
    setHovered(false)
    setActivePreview(0)
  }

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
          } else if ((key === 'arrowleft' || key === 'arrowright') && previews.length > 1) {
            e.preventDefault()
            if (key === 'arrowleft') {
              setActivePreview((idx) => (idx === 0 ? previews.length - 1 : idx - 1))
            } else {
              setActivePreview((idx) => (idx === previews.length - 1 ? 0 : idx + 1))
            }
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setActivePreview(0) }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)] rounded-xl"
      >
        <div className="overflow-hidden rounded-t-xl bg-[var(--surface,#FFFFFF)] relative">
          {/* identischer Medien-Wrapper mit vertikalem Limit */}
          <div className={`relative ${aspectClass(p.aspect)} w-full ${MEDIA_MAX} overflow-hidden`}>
            {hasImage ? (
              <img
                src={currentUrl ?? undefined}
                alt={`${p.title} – ${p.client}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <RawPlaceholder ratio={placeholderRatio} className="absolute inset-0" />
            )}
          </div>
          {previews.length > 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-1 opacity-0 transition-opacity duration-150 ease-out" style={{ opacity: showNav ? 1 : 0 }}>
              <button
                type="button"
                className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white text-lg"
                aria-label="Show previous preview"
                onClick={handlePrev}
                tabIndex={showNav ? 0 : -1}
              >
                ‹
              </button>
              <button
                type="button"
                className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white text-lg"
                aria-label="Show next preview"
                onClick={handleNext}
                tabIndex={showNav ? 0 : -1}
              >
                ›
              </button>
            </div>
          )}
          {previews.length > 1 && (
            <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {previews.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 w-4 rounded-full ${idx === activePreview ? 'bg-white/90' : 'bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weißer Footer unten */}
      <div className="rounded-b-xl border border-[var(--border,#E1D3B9)] border-t-0 bg-[var(--surface,#FFFFFF)] px-1.5 sm:px-2 md:px-3 pt-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium tracking-tight text-[var(--text,#1F1E1B)]">{p.title}</div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">{p.client}</div>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
