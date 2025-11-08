import React from 'react'
import type { Project } from '../features/projects/types'
import { aspectClass, placeholderRatioForAspect } from '../features/projects/utils'
import { RawPlaceholder } from './RawPlaceholder'

const MEDIA_MAX_DEFAULT = 'max-h-[420px] md:max-h-[520px]'
const MEDIA_MAX_COMPACT = 'max-h-[320px] md:max-h-[420px]'

function aspectRatioValue(width?: number | null, height?: number | null): string | null {
  if (!width || !height) return null
  if (width <= 0 || height <= 0) return null
  return `${width} / ${height}`
}

function ratioFromDimensions(width?: number | null, height?: number | null): number | null {
  if (!width || !height) return null
  if (width <= 0 || height <= 0) return null
  return width / height
}

function parseRatio(value?: string | null): number | null {
  if (!value) return null
  const parts = value.split('/').map((part) => Number(part.trim()))
  if (parts.length !== 2) return null
  const [w, h] = parts
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  if (h === 0) return null
  return w / h
}

type Orientation = 'landscape' | 'portrait' | 'square'

function orientationFromRatio(ratio: number | null): Orientation | null {
  if (!ratio || ratio <= 0) return null
  const EPSILON = 0.02
  if (Math.abs(ratio - 1) <= EPSILON) return 'square'
  return ratio > 1 ? 'landscape' : 'portrait'
}

const ProjectCard: React.FC<{
  p: Project
  onOpen: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  archiveMode: boolean
  onEdit: (p: Project) => void
  onSelectPrimary?: (projectId: string, assetId: string) => Promise<void>
  compact?: boolean
}> = ({ p, onOpen, onEdit, onSelectPrimary, compact = false }) => {
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
  const primaryPreview = previews[0] ?? null
  const currentUrl = current?.url ?? null
  const showNav = hovered && previews.length > 1
  const fallbackAspectRatio = React.useMemo(() => {
    if (p.aspect === 'landscape') return '16 / 9'
    if (p.aspect === 'portrait') return '3 / 4'
    return '1 / 1'
  }, [p.aspect])
  const fallbackAspectRatioValue = React.useMemo(() => parseRatio(fallbackAspectRatio), [fallbackAspectRatio])
  const primaryAspectRatio = aspectRatioValue(primaryPreview?.width, primaryPreview?.height) ?? fallbackAspectRatio
  const primaryAspectRatioValue = ratioFromDimensions(primaryPreview?.width, primaryPreview?.height) ?? fallbackAspectRatioValue
  const tileOrientation = orientationFromRatio(primaryAspectRatioValue)
  const currentRatio = ratioFromDimensions(current?.width, current?.height)
  const currentOrientation = orientationFromRatio(currentRatio)
  const shouldCoverCurrent =
    activePreview === 0 || !tileOrientation || !currentOrientation || currentOrientation === tileOrientation

  React.useEffect(() => {
    setActivePreview(0)
  }, [previews])

  const [promoting, setPromoting] = React.useState(false)
  const canPromote = Boolean(
    onSelectPrimary &&
    current?.assetId &&
    (current?.order ?? 0) !== 0,
  )

  const promote = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onSelectPrimary || !current?.assetId) return
    try {
      setPromoting(true)
      await onSelectPrimary(p.id, current.assetId)
      setActivePreview(0)
    } finally {
      setPromoting(false)
    }
  }

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
        <div className="overflow-hidden rounded-t-xl bg-[var(--placeholder-bg-beige,#F3EBDD)] relative">
          {/* identischer Medien-Wrapper mit vertikalem Limit */}
          <div
            className={`relative ${aspectClass(p.aspect)} w-full ${compact ? MEDIA_MAX_COMPACT : MEDIA_MAX_DEFAULT} overflow-hidden`}
            style={{ aspectRatio: primaryAspectRatio }}
          >
            {hasImage ? (
              <img
                src={currentUrl ?? undefined}
                alt={`${p.title} – ${p.client}`}
                className={`absolute inset-0 h-full w-full object-center transition-[transform] duration-150 ease-out ${
                  shouldCoverCurrent ? 'object-cover' : 'object-contain'
                }`}
              />
            ) : (
              <RawPlaceholder ratio={placeholderRatio} className="absolute inset-0" />
            )}
            {canPromote && (
              <button
                type="button"
                className="pointer-events-auto absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white shadow transition hover:bg-black/80 disabled:opacity-60"
                onClick={promote}
                disabled={promoting}
              >
                {promoting ? 'Setting…' : 'Use as cover'}
              </button>
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
