import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Photo,
  GridSelectOptions,
  InspectorViewportRect,
  InspectorPreviewPanCommand,
} from '../types'
import { computeCols, COLOR_MAP } from '../utils'
import { RawPlaceholder, RawPlaceholderFrame } from '../../../components/RawPlaceholder'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { StarRow, ColorSwatch, Badge, BadgeConfig } from './Common'

export function GridView({
  items,
  size,
  gap = 12,
  containerWidth,
  onOpen,
  onSelect,
  selectedIds,
  columns,
}: {
  items: Photo[]
  size: number
  gap?: number
  containerWidth: number
  onOpen: (idx: number) => void
  onSelect?: (idx: number, options?: GridSelectOptions) => void
  selectedIds?: Set<string>
  columns?: number
}) {
  const cols = columns ?? computeCols(containerWidth, size, gap)
  const twoLine = cols >= 4
  const template = columns
    ? `repeat(${columns}, minmax(0, 1fr))`
    : `repeat(auto-fill, minmax(${size}px, 1fr))`
  return (
    <div className="p-3 grid" style={{ gridTemplateColumns: template, gap }}>
      {items.map((p, idx) => (
        <div
          key={p.id}
          className={`group border bg-[var(--surface,#FFFFFF)] flex flex-col transition-shadow ${selectedIds?.has(p.id)
            ? 'border-[var(--charcoal-800,#1F1E1B)] shadow-[0_0_0_1px_var(--charcoal-800,#1F1E1B)]'
            : 'border-[var(--border,#E1D3B9)]'
            }`}
        >
          <div className="relative aspect-square w-full overflow-hidden bg-[var(--placeholder-bg-beige,#F3EBDD)] flex items-center justify-center">
            <button
              className="absolute inset-0 flex items-center justify-center focus:outline-none"
              type="button"
              onClick={(event) =>
                onSelect?.(idx, {
                  shiftKey: event.shiftKey,
                  metaKey: event.metaKey,
                  ctrlKey: event.ctrlKey,
                })
              }
              onDoubleClick={() => onOpen(idx)}
              aria-label={`Open ${p.name || 'photo'}`}
            >
              {p.thumbSrc ? (
                <img src={p.thumbSrc} alt={p.name} className="h-full w-full object-contain" />
              ) : (
                <RawPlaceholder
                  ratio={p.placeholderRatio}
                  title={p.name || 'Placeholder image'}
                  fit="contain"
                />
              )}
            </button>
            <ThumbContent p={p} />
          </div>
          <ThumbOverlay p={p} twoLine={twoLine} />
        </div>
      ))}
    </div>
  )
}

export function DetailView({
  items,
  index,
  setIndex,
  className = '',
  selectedIds,
  onSelect,
  paginatorRef,
  zoom = 1,
  minZoom = 1,
  maxZoom = 4,
  zoomStep = 1.2,
  onViewportChange,
  viewportResetKey,
  assetDimensions,
  onZoomChange,
  previewPanRequest,
  showFilmstrip = true,
  enableSwipeNavigation = false,
}: {
  items: Photo[]
  index: number
  setIndex: (n: number) => void
  className?: string
  selectedIds?: Set<string>
  onSelect?: (idx: number, options?: GridSelectOptions) => void
  paginatorRef?: React.Ref<HTMLDivElement>
  zoom?: number
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  onViewportChange?: (rect: InspectorViewportRect | null) => void
  viewportResetKey?: number
  assetDimensions?: { width: number; height: number } | null
  onZoomChange?: React.Dispatch<React.SetStateAction<number>>
  previewPanRequest?: InspectorPreviewPanCommand | null
  showFilmstrip?: boolean
  enableSwipeNavigation?: boolean
}) {
  const cur = items[index]
  const canPrev = index > 0
  const canNext = index < items.length - 1
  const STRIP_H = 180
  const THUMB = 96
  const itemsLength = items.length
  const indexRef = useRef(index)
  const itemsLengthRef = useRef(itemsLength)

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    itemsLengthRef.current = itemsLength
  }, [itemsLength])

  const stripNodeRef = useRef<HTMLDivElement | null>(null)
  const [stripEl, setStripEl] = useState<HTMLDivElement | null>(null)
  const setStripRef = useCallback((node: HTMLDivElement | null) => {
    stripNodeRef.current = node
    setStripEl(node)
  }, [])

  const rootClass = ['grid', 'h-full', 'w-full', 'min-h-0', 'min-w-0', className]
    .filter(Boolean)
    .join(' ')
  const ensureThumbVisible = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = stripNodeRef.current
    const total = itemsLengthRef.current
    if (!container || !total) return
    const targetIndex = indexRef.current
    const target = container.querySelector<HTMLElement>(`[data-thumb-index="${targetIndex}"]`)
    if (!target) return
    const padding = 12
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const overflowLeft = targetRect.left - containerRect.left - padding
    const overflowRight = targetRect.right - containerRect.right + padding
    if (overflowLeft < 0) {
      container.scrollTo({ left: container.scrollLeft + overflowLeft, behavior })
    } else if (overflowRight > 0) {
      container.scrollTo({ left: container.scrollLeft + overflowRight, behavior })
    }
  }, [])
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ pointerId: number | null; lastX: number; lastY: number } | null>(
    null
  )
  const swipeStateRef = useRef<{ pointerId: number; startX: number; startTime: number } | null>(
    null
  )
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const clampZoomValue = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return minZoom
      return Math.min(maxZoom, Math.max(minZoom, value))
    },
    [minZoom, maxZoom]
  )

  const zoomValue = useMemo(() => {
    return clampZoomValue(zoom)
  }, [zoom, clampZoomValue])
  const SWIPE_DISTANCE = 40
  const SWIPE_MAX_DURATION = 800

  const handleSwipePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enableSwipeNavigation || zoomValue > 1) return
      swipeStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startTime: event.timeStamp,
      }
    },
    [enableSwipeNavigation, zoomValue]
  )

  const cancelSwipeTracking = useCallback((pointerId?: number) => {
    if (pointerId === undefined) {
      swipeStateRef.current = null
      return
    }
    if (swipeStateRef.current && swipeStateRef.current.pointerId === pointerId) {
      swipeStateRef.current = null
    }
  }, [])

  const triggerSwipeNavigation = useCallback(
    (direction: 'prev' | 'next') => {
      const currentIndex = indexRef.current
      if (direction === 'prev' && currentIndex > 0) {
        setIndex(Math.max(0, currentIndex - 1))
      } else if (direction === 'next' && currentIndex < itemsLengthRef.current - 1) {
        setIndex(Math.min(itemsLengthRef.current - 1, currentIndex + 1))
      }
    },
    [setIndex]
  )

  const handleSwipePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enableSwipeNavigation || zoomValue > 1) return
      const state = swipeStateRef.current
      if (!state || state.pointerId !== event.pointerId) return
      const deltaX = event.clientX - state.startX
      const deltaTime = event.timeStamp - state.startTime
      if (Math.abs(deltaX) >= SWIPE_DISTANCE && deltaTime <= SWIPE_MAX_DURATION) {
        if (deltaX < 0) triggerSwipeNavigation('next')
        else triggerSwipeNavigation('prev')
      }
      swipeStateRef.current = null
    },
    [enableSwipeNavigation, triggerSwipeNavigation, zoomValue]
  )
  const handleSwipePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      cancelSwipeTracking(event.pointerId)
    },
    [cancelSwipeTracking]
  )

  useEffect(() => {
    const node = viewerRef.current
    if (!node) return
    if (typeof ResizeObserver === 'undefined') {
      const rect = node.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
      return
    }
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return
      const entry = entries[0]
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [cur ? cur.id : null])

  const fallbackRatio = useMemo(() => {
    if (!cur?.placeholderRatio) return 1
    const parts = String(cur.placeholderRatio)
      .split('x')
      .map((part) => Number(part))
    if (
      parts.length === 2 &&
      Number.isFinite(parts[0]) &&
      Number.isFinite(parts[1]) &&
      parts[1] !== 0
    ) {
      return Math.abs(parts[0] / parts[1])
    }
    return 1
  }, [cur?.placeholderRatio])

  const detailAspectRatio = useMemo(() => {
    const width = assetDimensions?.width
    const height = assetDimensions?.height
    if (Number.isFinite(width) && Number.isFinite(height) && width && height) {
      const ratio = width / height
      if (ratio > 0) return ratio
    }
    return fallbackRatio || 1
  }, [assetDimensions?.width, assetDimensions?.height, fallbackRatio])

  const baseSize = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return { width: 0, height: 0 }
    const ratio = detailAspectRatio || 1
    const containerRatio = containerSize.width / containerSize.height || 1
    if (ratio >= containerRatio) {
      const width = containerSize.width
      const height = ratio ? width / ratio : containerSize.height
      return { width, height }
    }
    const height = containerSize.height
    const width = height * ratio
    return { width, height }
  }, [containerSize.width, containerSize.height, detailAspectRatio])

  const scaledWidth = baseSize.width * zoomValue
  const scaledHeight = baseSize.height * zoomValue
  const maxOffsetX = Math.max(0, (scaledWidth - containerSize.width) / 2)
  const maxOffsetY = Math.max(0, (scaledHeight - containerSize.height) / 2)

  const clampPanValue = useCallback(
    (value: number, axis: 'x' | 'y') => {
      const limit = axis === 'x' ? maxOffsetX : maxOffsetY
      if (!Number.isFinite(value) || limit <= 0) return 0
      return Math.min(limit, Math.max(-limit, value))
    },
    [maxOffsetX, maxOffsetY]
  )

  const clampPanState = useCallback(
    (next: { x: number; y: number }) => ({
      x: clampPanValue(next.x, 'x'),
      y: clampPanValue(next.y, 'y'),
    }),
    [clampPanValue]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPan((prev) => clampPanState(prev))
  }, [clampPanState])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPan({ x: 0, y: 0 })
    dragStateRef.current = null
    setIsDragging(false)
  }, [cur?.id, viewportResetKey])

  useEffect(() => {
    if (!previewPanRequest) return
    if (!containerSize.width || !containerSize.height || !scaledWidth || !scaledHeight) return
    const viewWidth = Math.min(containerSize.width, scaledWidth)
    const viewHeight = Math.min(containerSize.height, scaledHeight)
    const normalizedWidth = Math.min(1, scaledWidth ? viewWidth / scaledWidth : 1)
    const normalizedHeight = Math.min(1, scaledHeight ? viewHeight / scaledHeight : 1)
    const clampCoord = (value: number, size: number) => {
      const max = Math.max(0, 1 - size)
      if (!Number.isFinite(value)) return 0
      return Math.min(max, Math.max(0, value))
    }
    const targetX = clampCoord(previewPanRequest.x, normalizedWidth)
    const targetY = clampCoord(previewPanRequest.y, normalizedHeight)

    const computePanFromNormalized = (target: number, axis: 'x' | 'y') => {
      const scaled = axis === 'x' ? scaledWidth : scaledHeight
      const container = axis === 'x' ? containerSize.width : containerSize.height
      if (!scaled || !container) return 0
      if (scaled <= container) return 0
      const desiredImageOffset = -target * scaled
      const centeredOffset = (container - scaled) / 2
      return clampPanValue(desiredImageOffset - centeredOffset, axis)
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPan({
      x: computePanFromNormalized(targetX, 'x'),
      y: computePanFromNormalized(targetY, 'y'),
    })
  }, [
    // clampPanValue, // Removed to avoid loop
    containerSize.height,
    containerSize.width,
    previewPanRequest,
    scaledHeight,
    scaledWidth,
  ])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (zoomValue <= 1) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragStateRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      }
      setIsDragging(true)
    },
    [zoomValue]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current
      if (!state || state.pointerId !== event.pointerId) return
      event.preventDefault()
      const dx = event.clientX - state.lastX
      const dy = event.clientY - state.lastY
      state.lastX = event.clientX
      state.lastY = event.clientY
      setPan((prev) => clampPanState({ x: prev.x + dx, y: prev.y + dy }))
    },
    [clampPanState]
  )

  const endPointerInteraction = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current
    if (!state || state.pointerId !== event.pointerId) return
    dragStateRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const interactionCursor = zoomValue > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
  const handleWheelZoom = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!onZoomChange || !cur) return
      event.preventDefault()
      const direction = event.deltaY < 0 ? zoomStep : 1 / zoomStep
      const nextZoom = clampZoomValue(zoomValue * direction)
      if (nextZoom === zoomValue) return
      onZoomChange(() => nextZoom)
    },
    [clampZoomValue, cur, onZoomChange, zoomStep, zoomValue]
  )

  const detailImage = useMemo(() => {
    if (!cur) return null
    if (cur.previewSrc) {
      return (
        <img
          src={cur.previewSrc}
          alt={cur.name}
          draggable={false}
          className="pointer-events-none h-full w-full select-none object-contain"
        />
      )
    }
    if (cur.thumbSrc) {
      return (
        <img
          src={cur.thumbSrc}
          alt={cur.name}
          draggable={false}
          className="pointer-events-none h-full w-full select-none object-contain"
        />
      )
    }
    return (
      <div className="pointer-events-none">
        <RawPlaceholder
          ratio={cur.placeholderRatio}
          title={cur.name || 'Placeholder image'}
          fit="contain"
        />
      </div>
    )
  }, [cur])

  useEffect(() => {
    if (!onViewportChange) return
    if (!cur) {
      onViewportChange(null)
      return
    }
    if (!containerSize.width || !containerSize.height || !scaledWidth || !scaledHeight) {
      onViewportChange({ x: 0, y: 0, width: 1, height: 1 })
      return
    }
    const containerWidth = containerSize.width
    const containerHeight = containerSize.height
    const viewWidth = Math.min(containerWidth, scaledWidth)
    const viewHeight = Math.min(containerHeight, scaledHeight)
    const normalizedWidth = Math.min(1, scaledWidth ? viewWidth / scaledWidth : 1)
    const normalizedHeight = Math.min(1, scaledHeight ? viewHeight / scaledHeight : 1)
    const imageLeft = (containerWidth - scaledWidth) / 2 + pan.x
    const imageTop = (containerHeight - scaledHeight) / 2 + pan.y
    const visibleLeft = Math.max(0, -imageLeft)
    const visibleTop = Math.max(0, -imageTop)
    const rawX = scaledWidth ? visibleLeft / scaledWidth : 0
    const rawY = scaledHeight ? visibleTop / scaledHeight : 0
    const clampCoord = (value: number, size: number) => {
      const max = Math.max(0, 1 - size)
      if (!Number.isFinite(value)) return 0
      return Math.min(max, Math.max(0, value))
    }
    onViewportChange({
      x: clampCoord(rawX, normalizedWidth),
      y: clampCoord(rawY, normalizedHeight),
      width: normalizedWidth,
      height: normalizedHeight,
    })
  }, [
    containerSize.height,
    containerSize.width,
    cur,
    onViewportChange,
    pan.x,
    pan.y,
    scaledHeight,
    scaledWidth,
  ])

  useEffect(() => {
    ensureThumbVisible('smooth')
  }, [index, ensureThumbVisible])

  const prevItemsLengthRef = useRef(itemsLength)
  useEffect(() => {
    if (prevItemsLengthRef.current !== itemsLength) {
      prevItemsLengthRef.current = itemsLength
      ensureThumbVisible('auto')
    }
  }, [itemsLength, ensureThumbVisible])

  useEffect(() => {
    const node = stripEl
    if (!node) return
    ensureThumbVisible('auto')
    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => ensureThumbVisible('auto')
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
    const observer = new ResizeObserver(() => ensureThumbVisible('auto'))
    observer.observe(node)
    return () => observer.disconnect()
  }, [stripEl, ensureThumbVisible])

  const gridTemplateRows = showFilmstrip ? `minmax(0,1fr) ${STRIP_H}px` : 'minmax(0,1fr)'

  return (
    <div className={rootClass} style={{ gridTemplateRows }}>
      <div className="relative min-h-0 min-w-0 overflow-hidden">
        {cur ? (
          <>
            <div className="absolute inset-0 bg-[var(--placeholder-bg-beige,#F3EBDD)] p-6">
              <div
                ref={viewerRef}
                className="relative h-full w-full overflow-hidden rounded-[var(--r-lg,20px)]"
              >
                <div
                  className="absolute inset-0"
                  style={{
                    cursor: interactionCursor,
                    touchAction: zoomValue > 1 || enableSwipeNavigation ? 'none' : 'auto',
                  }}
                  onPointerDown={(event) => {
                    handlePointerDown(event)
                    handleSwipePointerDown(event)
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => {
                    endPointerInteraction(event)
                    handleSwipePointerUp(event)
                  }}
                  onPointerLeave={(event) => {
                    endPointerInteraction(event)
                    handleSwipePointerCancel(event)
                  }}
                  onPointerCancel={(event) => {
                    endPointerInteraction(event)
                    handleSwipePointerCancel(event)
                  }}
                  onWheel={handleWheelZoom}
                >
                  <div
                    className="absolute left-1/2 top-1/2"
                    style={{
                      width: baseSize.width || undefined,
                      height: baseSize.height || undefined,
                      transform: `translate(-50%, -50%) translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomValue})`,
                      transition: isDragging ? 'none' : 'transform 120ms ease-out',
                    }}
                  >
                    {detailImage}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <RawPlaceholderFrame
              ratio="16x9"
              className="w-[380px] h-[240px] rounded-xl border border-[var(--border,#E1D3B9)]"
              title="Placeholder image"
            />
          </div>
        )}
      </div>

      {showFilmstrip ? (
        <div className="group relative w-full min-w-0 border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
          {items.length > 0 ? (
            <div
              ref={paginatorRef}
              tabIndex={-1}
              role="group"
              aria-label="Image paginator"
              className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between px-4 opacity-0 transition-opacity duration-150 focus:opacity-100 focus-visible:opacity-100 focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <button
                type="button"
                aria-label="Previous image"
                onClick={() => canPrev && setIndex(Math.max(0, index - 1))}
                disabled={!canPrev}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] shadow-[0_10px_30px_rgba(31,30,27,0.18)] transition hover:bg-[var(--surface-hover,#F4EBDD)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={() => canNext && setIndex(Math.min(items.length - 1, index + 1))}
                disabled={!canNext}
                className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] shadow-[0_10px_30px_rgba(31,30,27,0.18)] transition hover:bg-[var(--surface-hover,#F4EBDD)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
              >
                <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div ref={setStripRef} className="thumb-strip min-w-0">
            {items.length === 0 ? (
              <div className="h-full grid place-items-center">
                <RawPlaceholderFrame
                  ratio="3x2"
                  className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]"
                  title="Placeholder image"
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-end gap-6 pr-6">
                {items.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex shrink-0 w-[96px] max-w-[96px] flex-col items-stretch text-[10px] leading-tight"
                  >
                    <button
                      data-thumb-index={i}
                      onClick={(event) => {
                        if (onSelect) {
                          onSelect(i, {
                            shiftKey: event.shiftKey,
                            metaKey: event.metaKey,
                            ctrlKey: event.ctrlKey,
                          })
                        } else {
                          setIndex(i)
                        }
                      }}
                      className={`relative overflow-hidden rounded border focus:outline-none focus:ring-2 focus:ring-[var(--sand-200,#EDE1C6)] ${selectedIds?.has(p.id)
                        ? 'border-[var(--charcoal-800,#1F1E1B)] shadow-[0_0_0_1px_var(--charcoal-800,#1F1E1B)]'
                        : i === index
                          ? 'border-[var(--text,#1F1E1B)]'
                          : 'border-[var(--border,#E1D3B9)]'
                        }`}
                      style={{ width: THUMB, height: THUMB }}
                      aria-label={`View ${p.name}`}
                    >
                      <span className="absolute top-1 left-1 rounded bg-[var(--surface-frosted-strong,#FBF7EF)] px-1 py-[2px] text-[9px] font-medium border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)]">
                        {p.type}
                      </span>
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--placeholder-bg-beige,#F3EBDD)]">
                        {p.thumbSrc ? (
                          <img
                            src={p.thumbSrc}
                            alt={p.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <RawPlaceholder
                            ratio={p.placeholderRatio}
                            title={p.name || 'Placeholder image'}
                            fit="contain"
                          />
                        )}
                      </div>
                    </button>
                    <div className="mt-1 truncate text-center font-medium text-[var(--text,#1F1E1B)]">
                      {p.name}
                    </div>
                    <div className="mt-1 rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-1 py-0.5">
                      <div className="flex flex-col gap-0.5 text-[9px]">
                        <span className="flex items-center justify-between gap-1">
                          <span className="font-medium">Rating</span>
                          <span>{p.rating}★</span>
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="font-medium">Color</span>
                          <span className="flex items-center gap-1">
                            <span
                              className="h-2 w-2 rounded-full border border-[var(--border,#E1D3B9)]"
                              style={{ backgroundColor: COLOR_MAP[p.tag] }}
                              aria-hidden
                            />
                            <span className="truncate">{p.tag}</span>
                          </span>
                        </span>
                        <span className="flex items-center justify-between gap-1">
                          <span className="font-medium">Status</span>
                          <span
                            className={
                              p.rejected
                                ? 'text-[#B91C1C]'
                                : p.picked
                                  ? 'text-[#166534]'
                                  : 'text-[var(--text-muted,#6B645B)]'
                            }
                          >
                            {p.rejected ? 'Rejected' : p.picked ? 'Picked' : '—'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function ThumbContent({ p }: { p: Photo }) {
  return (
    <div className="pointer-events-none absolute top-1 left-1 flex items-center gap-1 text-[10px]">
      <span className="px-1 py-0.5 rounded border border-[var(--border,#E1D3B9)] bg-[var(--surface-frosted,#F8F0E4)]">
        {p.displayType ?? p.type}
      </span>
      <span
        className="w-2.5 h-2.5 rounded-full border border-[var(--border,#E1D3B9)]"
        style={{ backgroundColor: COLOR_MAP[p.tag] }}
        aria-hidden
      />
    </div>
  )
}

export function ThumbOverlay({ p, twoLine }: { p: Photo; twoLine?: boolean }) {
  // leben via DOM-Custom-Events (gleiche Mechanik wie im Monolith)
  const emit = (name: 'rate' | 'pick' | 'reject' | 'color', detail: any) => {
    const ev = new CustomEvent(name, { detail })
    window.dispatchEvent(ev)
  }
  const pickBadge: BadgeConfig = p.picked
    ? { label: 'Picked', tone: 'success', icon: '✔', ariaLabel: 'Picked asset' }
    : p.rejected
      ? { label: 'Rejected', tone: 'danger', icon: '✕', ariaLabel: 'Rejected asset' }
      : { label: 'Pending', tone: 'muted', icon: '•', ariaLabel: 'Pick or reject pending' }

  const statusBadge: BadgeConfig | null = (() => {
    switch (p.status) {
      case 'READY':
        return null
      case 'PROCESSING':
      case 'QUEUED':
      case 'UPLOADING':
        return { label: 'Processing', tone: 'warning', icon: '⏳', ariaLabel: 'Asset processing' }
      case 'ERROR':
        return { label: 'Error', tone: 'danger', icon: '⚠', ariaLabel: 'Processing error' }
      case 'MISSING_SOURCE':
        return { label: 'Missing source', tone: 'danger', icon: '⚠', ariaLabel: 'Missing source' }
      case 'DUPLICATE':
        return { label: 'Duplicate', tone: 'muted', icon: '≡', ariaLabel: 'Duplicate asset' }
      default:
        return {
          label: 'Processing',
          tone: 'warning',
          icon: '⏳',
          ariaLabel: `Status: ${p.status}`,
        }
    }
  })()

  return (
    <div className="border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-[11px]">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[12px] font-semibold text-[var(--text,#1F1E1B)] truncate">
          {p.name}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Badge {...pickBadge} />
          {statusBadge ? <Badge {...statusBadge} /> : null}
        </div>
      </div>
      {twoLine ? (
        <div className="mt-2 flex flex-col gap-1">
          <div className="flex items-center justify-end gap-2">
            <StarRow value={p.rating} onChange={(r) => emit('rate', { id: p.id, r })} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              className={`px-1 border rounded ${p.picked ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`}
              onClick={() => emit('pick', { id: p.id })}
              title="Pick (P)"
            >
              P
            </button>
            <button
              className={`px-1 border rounded ${p.rejected ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`}
              onClick={() => emit('reject', { id: p.id })}
              title="Reject (X)"
            >
              X
            </button>
            <ColorSwatch value={p.tag} onPick={(t) => emit('color', { id: p.id, t })} />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StarRow value={p.rating} onChange={(r) => emit('rate', { id: p.id, r })} />
            <ColorSwatch value={p.tag} onPick={(t) => emit('color', { id: p.id, t })} />
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-1 border rounded ${p.picked ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`}
              onClick={() => emit('pick', { id: p.id })}
              title="Pick (P)"
            >
              P
            </button>
            <button
              className={`px-1 border rounded ${p.rejected ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`}
              onClick={() => emit('reject', { id: p.id })}
              title="Reject (X)"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
