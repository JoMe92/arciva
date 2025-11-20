import React from 'react'
import type { Project } from '../features/projects/types'
import {
  aspectClass,
  placeholderRatioForAspect,
  aspectRatioValue,
  fallbackAspectRatioForAspect,
  orientationFromRatio,
  parseRatio,
  ratioFromDimensions,
} from '../features/projects/utils'
import { RawPlaceholder } from './RawPlaceholder'

const MEDIA_MAX_DEFAULT = 'max-h-[420px] md:max-h-[520px]'
const MEDIA_MAX_COMPACT = 'max-h-[320px] md:max-h-[420px]'

const ProjectCard: React.FC<{
  p: Project
  onOpen: (id: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  archiveMode: boolean
  onEdit: (p: Project) => void
  onSelectPrimary?: (projectId: string, assetId: string) => Promise<void>
  compact?: boolean
  variant?: 'grid' | 'feed'
}> = ({ p, onOpen, onEdit, onSelectPrimary, compact = false, variant = 'grid' }) => {
  const feedMode = variant === 'feed'
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
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const [activePreview, setActivePreview] = React.useState(0)
  const previewCount = previews.length
  const hasImage = previewCount > 0
  const current = hasImage ? previews[Math.max(0, Math.min(activePreview, previewCount - 1))] : null
  const primaryPreview = previews[0] ?? null
  const currentUrl = current?.url ?? null
  const showNav = hovered && previewCount > 1
  const fallbackAspectRatio = React.useMemo(() => fallbackAspectRatioForAspect(p.aspect), [p.aspect])
  const fallbackAspectRatioValue = React.useMemo(() => parseRatio(fallbackAspectRatio), [fallbackAspectRatio])
  const primaryAspectRatio = aspectRatioValue(primaryPreview?.width, primaryPreview?.height) ?? fallbackAspectRatio
  const primaryAspectRatioValue = ratioFromDimensions(primaryPreview?.width, primaryPreview?.height) ?? fallbackAspectRatioValue
  const tileOrientation = orientationFromRatio(primaryAspectRatioValue)
  const currentRatio = ratioFromDimensions(current?.width, current?.height)
  const currentOrientation = orientationFromRatio(currentRatio)
  const shouldCoverCurrent =
    activePreview === 0 || !tileOrientation || !currentOrientation || currentOrientation === tileOrientation

  React.useEffect(() => {
    setImageLoaded(false)
  }, [currentUrl])

  React.useEffect(() => {
    setActivePreview(0)
  }, [previews])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const cycleRelative = React.useCallback(
    (delta: number) => {
      setActivePreview((idx) => {
        if (!previewCount) return 0
        const next = (idx + delta + previewCount) % previewCount
        return next
      })
    },
    [previewCount],
  )

  const wheelAccumulatorRef = React.useRef(0)

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (previewCount < 2) return
      const primaryDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!primaryDelta) return
      wheelAccumulatorRef.current += primaryDelta
      const threshold = 40
      if (Math.abs(wheelAccumulatorRef.current) < threshold) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      const direction = wheelAccumulatorRef.current > 0 ? 1 : -1
      wheelAccumulatorRef.current = 0
      event.preventDefault()
      event.stopPropagation()
      cycleRelative(direction)
    },
    [cycleRelative, previewCount],
  )

  React.useEffect(() => {
    if (!hovered || previewCount < 2) return
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      const key = (event.key || '').toLowerCase()
      if (key === 'arrowleft' || key === 'arrowup') {
        event.preventDefault()
        cycleRelative(-1)
        return
      }
      if (key === 'arrowright' || key === 'arrowdown') {
        event.preventDefault()
        cycleRelative(1)
        return
      }
      if (key === 'home') {
        event.preventDefault()
        setActivePreview(0)
        return
      }
      if (key === 'end') {
        event.preventDefault()
        setActivePreview(Math.max(0, previewCount - 1))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cycleRelative, hovered, previewCount])

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
  }

  const tags = React.useMemo(() => {
    if (!Array.isArray(p.tags)) return []
    return p.tags.map((tag) => tag.trim()).filter((tag) => Boolean(tag.length))
  }, [p.tags])
  const hasTags = tags.length > 0

  const rootClassName = feedMode
    ? 'relative rounded-[32px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] shadow-[0_18px_42px_rgba(31,30,27,0.12)] overflow-hidden'
    : 'relative'
  const footerClassName = feedMode
    ? 'bg-[var(--surface,#FFFFFF)] px-4 pt-4 pb-5 sm:px-5'
    : 'rounded-b-xl border border-[var(--border,#E1D3B9)] border-t-0 bg-[var(--surface,#FFFFFF)] px-1.5 sm:px-2 md:px-3 pt-2 pb-3'
  const tagShellClassName = feedMode
    ? 'project-card-tags rounded-2xl border border-[var(--border,#E1D3B9)]/80 bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2 min-h-[46px]'
    : 'project-card-tags rounded-xl border border-[var(--border,#E1D3B9)]/80 bg-[var(--surface-subtle,#FBF7EF)] px-2 py-1.5 min-h-[52px]'
  const titleClassName = feedMode
    ? 'text-[15px] sm:text-base font-semibold tracking-tight text-[var(--text,#1F1E1B)]'
    : 'text-[13px] font-medium tracking-tight text-[var(--text,#1F1E1B)]'
  const clientClassName = feedMode
    ? 'text-xs uppercase tracking-widest text-[var(--text-muted,#6B645B)]'
    : 'text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]'

  return (
    <div className={rootClassName}>
      {/* Bildbereich: nur Navigation/Preview */}
      <div
        tabIndex={0}
        aria-label={`Preview project: ${p.title}`}
        data-testid={`project-card-${p.id}`}
        role={feedMode ? 'button' : undefined}
        onClick={feedMode ? () => onOpen(p.id) : undefined}
        onKeyDown={(e) => {
          const key = (e.key || '').toLowerCase()
          if (feedMode && (key === 'enter' || key === ' ' || key === 'spacebar')) {
            e.preventDefault()
            onOpen(p.id)
            return
          }
          if ((key === 'arrowleft' || key === 'arrowright') && previews.length > 1) {
            e.preventDefault()
            if (key === 'arrowleft') {
              setActivePreview((idx) => (idx === 0 ? previews.length - 1 : idx - 1))
            } else {
              setActivePreview((idx) => (idx === previews.length - 1 ? 0 : idx + 1))
            }
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onWheel={handleWheel}
        className={`block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)] rounded-xl ${
          feedMode ? 'cursor-pointer active:scale-[0.995]' : ''
        }`}
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
                className={`absolute inset-0 h-full w-full object-center transition-[opacity,transform,filter] duration-500 ease-out ${
                  shouldCoverCurrent ? 'object-cover' : 'object-contain'
                } ${imageLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-3xl scale-[1.03]'}`}
                loading="lazy"
                decoding="async"
                onLoad={handleImageLoad}
              />
            ) : null}
            <RawPlaceholder
              ratio={placeholderRatio}
              className={`absolute inset-0 pointer-events-none ${hasImage ? 'transition-opacity duration-500 ease-out' : ''} ${
                hasImage && imageLoaded ? 'opacity-0' : 'opacity-100'
              }`}
            />
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
      {/* white footer at the bottom */}
      <div className={footerClassName}>
        {hasTags && (
          <div className="mb-2">
            <div className={tagShellClassName}>
              <div className="tag-strip flex flex-nowrap gap-1.5 text-[11px] text-[var(--text-muted,#6B645B)]" role="list" aria-label="Project tags">
                {tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="project-card-tag-pill inline-flex shrink-0 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-0.5 text-[11px] leading-tight"
                    role="listitem"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className={`flex items-start gap-3 ${feedMode ? '' : 'justify-between'}`}>
          <div className="min-w-0 flex-1">
            <div className={titleClassName}>{p.title}</div>
            <div className={clientClassName}>{p.client || 'UNASSIGNED'}</div>
          </div>
          {feedMode ? (
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-xl text-[var(--text-muted,#6B645B)] shadow-sm transition hover:border-[var(--text-muted,#6B645B)]"
              aria-label={`Edit ${p.title}`}
              data-testid="card-footer-edit"
            >
              ⋯
            </button>
          ) : (
            <div className="flex items-center gap-1" role="group" aria-label="Project actions">
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="h-8 px-3 rounded-full bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)]"
                aria-label={`Open ${p.title}`}
                data-testid="card-footer-open"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="h-8 px-3 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[12px] hover:border-[var(--text-muted,#6B645B)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)]"
                aria-label="Edit project"
                data-testid="card-footer-edit"
              >
                Edit
              </button>
            </div>
          )}
        </div>
        {feedMode ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className="h-11 w-full rounded-full bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] text-[13px] font-semibold tracking-tight shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)]"
              aria-label={`Open ${p.title}`}
              data-testid="card-footer-open"
            >
              Open project
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ProjectCard
