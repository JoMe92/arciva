import React, { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react'
import { RawPlaceholder, RawPlaceholderFrame } from '../../../components/RawPlaceholder'
import {
  ChevronRightIcon,
  InfoIcon,
  CheckIcon,
  CameraIcon,
  CalendarClockIcon,
  SettingsIcon,
  MinusIcon,
  PlusIcon,
  FrameIcon,
  PreviewIcon,
  FolderIcon,
  ChevronLeftIcon,
  InspectorIcon,
} from './icons'
import { InspectorRailButton, RailDivider } from './Buttons'
import { StarRow, ColorSwatch, Badge } from './Common'
import {
  Photo,
  InspectorField,
  KeyMetadataSections,
  MetadataSummary,
  InspectorPreviewData,
  MetadataEntry,
  MetadataCategory,
  MetadataGroup,
  UsedProjectLink,
  MetadataSourceId,
  CURRENT_CONFIG_SOURCE_ID,
  ColorTag,
  InspectorViewportRect,
} from '../types'
import { COLOR_MAP } from '../utils'

const RIGHT_PANEL_ID = 'workspace-image-details-panel'
const RIGHT_PANEL_CONTENT_ID = `${RIGHT_PANEL_ID}-content`
const RIGHT_KEY_SECTION_ID = `${RIGHT_PANEL_ID}-key-data`
const RIGHT_PROJECT_SECTION_ID = `${RIGHT_PANEL_ID}-projects`
const RIGHT_METADATA_SECTION_ID = `${RIGHT_PANEL_ID}-metadata`

type RightPanelTarget = 'keyData' | 'projects' | 'metadata'

export function InspectorPanel({
  collapsed,
  onCollapse,
  onExpand,
  hasSelection,
  usedProjects,
  usedProjectsLoading,
  usedProjectsError,
  metadataSourceId,
  onChangeMetadataSource,
  metadataSourceBusy,
  metadataSourceError,
  keyMetadataSections,
  metadataSummary,
  metadataEntries,
  metadataWarnings,
  metadataLoading,
  metadataError,
  previewAsset,
  detailZoom,
  detailMinZoom,
  detailMaxZoom,
  onDetailZoomIn,
  onDetailZoomOut,
  onDetailZoomReset,
  detailViewport,
  onPreviewPan,
  mode = 'sidebar',
}: {
  collapsed: boolean
  onCollapse: () => void
  onExpand: () => void
  hasSelection: boolean
  usedProjects: UsedProjectLink[]
  usedProjectsLoading: boolean
  usedProjectsError: string | null
  metadataSourceId: MetadataSourceId
  onChangeMetadataSource: (nextId: MetadataSourceId) => void
  metadataSourceBusy: boolean
  metadataSourceError: string | null
  keyMetadataSections: KeyMetadataSections | null
  metadataSummary: MetadataSummary | null
  metadataEntries: MetadataEntry[]
  metadataWarnings: string[]
  metadataLoading: boolean
  metadataError: string | null
  previewAsset: InspectorPreviewData | null
  detailZoom: number
  detailMinZoom: number
  detailMaxZoom: number
  onDetailZoomIn: () => void
  onDetailZoomOut: () => void
  onDetailZoomReset: () => void
  detailViewport: InspectorViewportRect | null
  onPreviewPan?: (position: { x: number; y: number }) => void
  mode?: 'sidebar' | 'mobile'
}) {
  const keyDataSectionRef = useRef<HTMLDivElement | null>(null)
  const projectsSectionRef = useRef<HTMLDivElement | null>(null)
  const metadataSectionRef = useRef<HTMLDivElement | null>(null)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [keyDataOpen, setKeyDataOpen] = useState(true)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [metadataOpen, setMetadataOpen] = useState(true)
  const pendingTargetRef = useRef<RightPanelTarget | null>(null)
  const generalFields = keyMetadataSections?.general ?? []
  const captureFields = keyMetadataSections?.capture ?? []
  const metadataGroups = useMemo(() => groupMetadataEntries(metadataEntries), [metadataEntries])
  const metadataRows = useMemo(() => {
    if (!metadataGroups.length) return []
    return metadataGroups.flatMap((group) =>
      group.entries.map((entry) => ({
        label: entry.label,
        value: formatMetadataEntryValue(entry.value),
      }))
    )
  }, [metadataGroups])
  const isMobilePanel = mode === 'mobile'
  const collapsedState = isMobilePanel ? false : collapsed
  const panelShellClass = isMobilePanel
    ? 'flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-1'
    : 'flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] p-4 shadow-[0_30px_80px_rgba(31,30,27,0.16)]'
  const panelContentClass = isMobilePanel
    ? 'flex flex-1 min-h-0 flex-col gap-3 pb-4'
    : 'flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-2'
  const mergedInspectorFields = useMemo(() => {
    const map = new Map<string, string>()
    generalFields.forEach((field) => {
      if (!map.has(field.label)) map.set(field.label, field.value)
    })
    captureFields.forEach((field) => {
      if (!map.has(field.label)) map.set(field.label, field.value)
    })
    return map
  }, [generalFields, captureFields])

  const keyDataRows = useMemo(() => {
    const colorLabel = metadataSummary?.colorLabel ?? 'None'
    return [
      { label: 'File Name', value: mergedInspectorFields.get('File Name') ?? '—' },
      { label: 'File Type', value: mergedInspectorFields.get('File Type') ?? '—' },
      { label: 'Import Date', value: mergedInspectorFields.get('Import Date') ?? '—' },
      { label: 'Capture Date', value: mergedInspectorFields.get('Capture Date') ?? '—' },
      { label: 'Dimensions', value: mergedInspectorFields.get('Dimensions') ?? '—' },
      { label: 'Rating', value: formatRatingValue(metadataSummary?.rating) },
      { label: 'Color Label', value: <ColorLabelValue value={colorLabel as ColorTag} /> },
      { label: 'Pick/Reject', value: metadataSummary?.pickRejectLabel ?? '—' },
    ]
  }, [metadataSummary, mergedInspectorFields])

  const ensureSectionOpen = useCallback((target: RightPanelTarget) => {
    if (target === 'keyData') setKeyDataOpen(true)
    else if (target === 'projects') setProjectsOpen(true)
    else setMetadataOpen(true)
  }, [])

  const scrollToTarget = useCallback((target: RightPanelTarget) => {
    const refMap: Record<RightPanelTarget, React.RefObject<HTMLDivElement | null>> = {
      keyData: keyDataSectionRef,
      projects: projectsSectionRef,
      metadata: metadataSectionRef,
    }
    const ref = refMap[target]?.current
    if (ref) {
      ref.scrollIntoView({ block: 'start', behavior: 'smooth' })
      if (typeof ref.focus === 'function') {
        ref.focus({ preventScroll: true })
      }
    }
  }, [])

  useEffect(() => {
    if (collapsed) return
    const target = pendingTargetRef.current
    if (!target) return
    ensureSectionOpen(target)
    scrollToTarget(target)
    pendingTargetRef.current = null
  }, [collapsed, ensureSectionOpen, scrollToTarget])

  const handleRailSelect = useCallback(
    (target: RightPanelTarget) => {
      ensureSectionOpen(target)
      if (collapsed) {
        pendingTargetRef.current = target
        onExpand()
        return
      }
      scrollToTarget(target)
    },
    [collapsed, ensureSectionOpen, onExpand, scrollToTarget]
  )

  return (
    <aside
      id={RIGHT_PANEL_ID}
      role="complementary"
      aria-label="Image Details panel"
      className={`relative h - full min - h - 0 ${isMobilePanel ? 'px-3 py-4' : 'px-2 py-4'} `}
      data-state={collapsedState ? 'collapsed' : 'expanded'}
    >
      <div
        data-panel="body"
        aria-hidden={collapsedState}
        className={`h - full min - h - 0 ${isMobilePanel ? '' : `transition-opacity duration-150 ${collapsedState ? 'pointer-events-none opacity-0' : 'opacity-100'}`} `}
      >
        <div className={panelShellClass}>
          {!isMobilePanel ? (
            <header className="sticky top-0 z-10 border-b border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] pb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Collapse Image Details panel"
                  aria-controls={RIGHT_PANEL_CONTENT_ID}
                  onClick={onCollapse}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#EDE1C6)] text-[var(--text,#1F1E1B)] transition hover:border-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                >
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <InspectorIcon className="h-4 w-4 text-[var(--text,#1F1E1B)]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[var(--text,#1F1E1B)]">
                  Image Details
                </span>
              </div>
            </header>
          ) : (
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-[var(--text,#1F1E1B)]">
              <InspectorIcon className="h-4 w-4" aria-hidden="true" />
              Image Details
            </div>
          )}
          <div id={RIGHT_PANEL_CONTENT_ID} className={panelContentClass}>
            <InspectorPreviewCard
              preview={previewAsset}
              hasSelection={hasSelection}
              zoomLevel={detailZoom}
              minZoom={detailMinZoom}
              maxZoom={detailMaxZoom}
              viewport={detailViewport}
              onZoomIn={onDetailZoomIn}
              onZoomOut={onDetailZoomOut}
              onZoomReset={onDetailZoomReset}
              onPanPreview={onPreviewPan}
              open={previewOpen}
              onToggle={() => setPreviewOpen((open) => !open)}
            />
            <InspectorSection
              id={RIGHT_KEY_SECTION_ID}
              ref={keyDataSectionRef}
              icon={<InfoIcon className="h-4 w-4" aria-hidden="true" />}
              label="Key Data"
              open={keyDataOpen}
              onToggle={() => setKeyDataOpen((open) => !open)}
            >
              {hasSelection ? (
                <KeyDataGrid rows={keyDataRows} />
              ) : (
                <p className="text-sm text-[var(--text-muted,#6B645B)]">
                  Select a photo from the gallery to inspect its details.
                </p>
              )}
            </InspectorSection>
            <InspectorSection
              id={RIGHT_PROJECT_SECTION_ID}
              ref={projectsSectionRef}
              icon={<FolderIcon className="h-4 w-4" aria-hidden="true" />}
              label="Used in Projects"
              open={projectsOpen}
              onToggle={() => setProjectsOpen((open) => !open)}
            >
              {hasSelection ? (
                <UsedProjectsSection
                  projects={usedProjects}
                  loading={usedProjectsLoading}
                  error={usedProjectsError}
                  metadataSourceId={metadataSourceId}
                  onChangeMetadataSource={onChangeMetadataSource}
                  metadataSourceBusy={metadataSourceBusy}
                  actionError={metadataSourceError}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted,#6B645B)]">
                  Select a photo to see where it is used.
                </p>
              )}
            </InspectorSection>
            <InspectorSection
              id={RIGHT_METADATA_SECTION_ID}
              ref={metadataSectionRef}
              icon={<CameraIcon className="h-4 w-4" aria-hidden="true" />}
              label="Metadata"
              open={metadataOpen}
              onToggle={() => setMetadataOpen((open) => !open)}
              grow
            >
              {metadataLoading ? (
                <p className="text-xs text-[var(--text-muted,#6B645B)]">Loading metadata…</p>
              ) : null}
              {metadataError ? <p className="text-xs text-[#B42318]">{metadataError}</p> : null}
              {metadataWarnings.length ? (
                <ul className="space-y-1 rounded-[12px] border border-[#F59E0B]/40 bg-[#FFF7ED] px-3 py-2 text-[11px] text-[#B45309]">
                  {metadataWarnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#F59E0B] text-[10px]">
                        !
                      </span>
                      <span className="flex-1 break-words">{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hasSelection ? (
                metadataRows.length ? (
                  <KeyDataGrid rows={metadataRows} />
                ) : (
                  <p className="text-sm text-[var(--text-muted,#6B645B)]">
                    No metadata available for this asset.
                  </p>
                )
              ) : (
                <p className="text-sm text-[var(--text-muted,#6B645B)]">
                  Select a photo to review metadata.
                </p>
              )}
            </InspectorSection>
          </div>
        </div>
      </div>
      {!isMobilePanel ? (
        <div
          data-panel="rail"
          aria-hidden={!collapsed}
          className={`pointer-events-none absolute inset-0 flex items-center justify-center px-1 py-2 transition-opacity duration-150 ${collapsed ? 'opacity-100' : 'opacity-0'}`}
        >
          {collapsed ? (
            <InspectorRail
              onExpand={onExpand}
              onKeyData={() => handleRailSelect('keyData')}
              onProjects={() => handleRailSelect('projects')}
              onMetadata={() => handleRailSelect('metadata')}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

type InspectorPreviewCardProps = {
  preview: InspectorPreviewData | null
  hasSelection: boolean
  zoomLevel: number
  minZoom: number
  maxZoom: number
  viewport: InspectorViewportRect | null
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onPanPreview?: (position: { x: number; y: number }) => void
  open: boolean
  onToggle: () => void
}

function InspectorPreviewCard({
  preview,
  hasSelection,
  zoomLevel,
  minZoom,
  maxZoom,
  viewport,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onPanPreview,
  open,
  onToggle,
}: InspectorPreviewCardProps) {
  const contentId = useId()
  const imageSrc = preview?.src ?? preview?.thumbSrc ?? null
  const zoomPercent = `${Math.round(zoomLevel * 100)}%`
  const controlsDisabled = !hasSelection
  const canZoomIn = zoomLevel < maxZoom - 0.01
  const canZoomOut = zoomLevel > minZoom + 0.01

  const previewMessage = hasSelection
    ? 'Preview unavailable for this asset.'
    : 'Select a photo to see it here.'

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!hasSelection) return
      event.preventDefault()
      if (event.deltaY < 0) onZoomIn()
      else onZoomOut()
    },
    [hasSelection, onZoomIn, onZoomOut]
  )

  const indicatorStyle = useMemo(() => {
    if (!viewport) return null
    return {
      left: `${viewport.x * 100}%`,
      top: `${viewport.y * 100}%`,
      width: `${viewport.width * 100}%`,
      height: `${viewport.height * 100}%`,
    }
  }, [viewport])

  const previewDragRef = useRef<number | null>(null)

  const emitPanFromRelative = useCallback(
    (relativeX: number, relativeY: number) => {
      if (!viewport || !onPanPreview || !hasSelection) return
      const clampCoordinate = (center: number, size: number) => {
        if (!Number.isFinite(size) || size <= 0) return 0
        const half = size / 2
        const max = Math.max(0, 1 - size)
        const target = center - half
        return Math.min(max, Math.max(0, target))
      }
      onPanPreview({
        x: clampCoordinate(relativeX, viewport.width),
        y: clampCoordinate(relativeY, viewport.height),
      })
    },
    [hasSelection, onPanPreview, viewport]
  )

  const handlePreviewPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!preview || !viewport || !onPanPreview || !hasSelection) return
      event.preventDefault()
      previewDragRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      const bounds = event.currentTarget.getBoundingClientRect()
      emitPanFromRelative(
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height
      )
    },
    [emitPanFromRelative, hasSelection, onPanPreview, preview, viewport]
  )

  const handlePreviewPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (previewDragRef.current !== event.pointerId) return
      if (!preview || !viewport || !onPanPreview || !hasSelection) return
      event.preventDefault()
      const bounds = event.currentTarget.getBoundingClientRect()
      emitPanFromRelative(
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height
      )
    },
    [emitPanFromRelative, hasSelection, onPanPreview, preview, viewport]
  )

  const releasePreviewPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (previewDragRef.current !== event.pointerId) return
    previewDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  return (
    <div className="w-full shrink-0">
      <div className="flex flex-col rounded-[18px] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] shadow-[0_18px_40px_rgba(31,30,27,0.12)]">
        <div className="flex items-center gap-3 border-b border-[var(--border,#EDE1C6)] px-4 py-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text,#1F1E1B)]">
            <PreviewIcon className="h-4 w-4 text-[var(--text-muted,#6B645B)]" aria-hidden="true" />
            Preview
          </span>
          <span className="ml-auto text-xs font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            {zoomPercent}
          </span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={onToggle}
            className="rounded-md text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        </div>
        <div id={contentId} aria-hidden={!open} className={open ? 'flex flex-col' : 'hidden'}>
          <div
            tabIndex={preview ? 0 : -1}
            aria-label={preview ? preview.alt : 'No image selected'}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#1A73E8)]"
            onWheel={handleWheel}
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={releasePreviewPointer}
            onPointerLeave={releasePreviewPointer}
            onPointerCancel={releasePreviewPointer}
            onClick={(event) => {
              if (event.detail !== 0) return
              emitPanFromRelative(0.5, 0.5)
            }}
          >
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border,#EDE1C6)] bg-[var(--placeholder-bg-beige,#F3EBDD)]">
              {preview ? (
                imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={preview.alt}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <RawPlaceholder
                    ratio={preview.placeholderRatio}
                    title={preview.alt}
                    fit="contain"
                  />
                )
              ) : (
                <p className="px-4 text-center text-sm text-[var(--text-muted,#6B645B)]">
                  {previewMessage}
                </p>
              )}
              {preview && viewport ? (
                <span className="pointer-events-none absolute inset-0">
                  <span
                    className="absolute rounded-[6px] border border-[var(--focus-ring,#1A73E8)] bg-[rgba(26,115,232,0.12)]"
                    style={indicatorStyle ?? undefined}
                  />
                </span>
              ) : null}
            </div>
            {null}
          </div>
          <div className="flex items-center justify-center gap-3 border-t border-[var(--border,#EDE1C6)] px-3 py-3">
            <InspectorPreviewControlButton
              label="Zoom out"
              icon={<MinusIcon className="h-4 w-4" aria-hidden="true" />}
              onClick={onZoomOut}
              disabled={controlsDisabled || !canZoomOut}
            />
            <InspectorPreviewControlButton
              label="Fit to canvas"
              icon={<FrameIcon className="h-4 w-4" aria-hidden="true" />}
              onClick={onZoomReset}
              disabled={!hasSelection}
            />
            <InspectorPreviewControlButton
              label="Zoom in"
              icon={<PlusIcon className="h-4 w-4" aria-hidden="true" />}
              onClick={onZoomIn}
              disabled={controlsDisabled || !canZoomIn}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

type InspectorPreviewControlButtonProps = {
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}

function InspectorPreviewControlButton({
  label,
  icon,
  onClick,
  disabled,
}: InspectorPreviewControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#EDE1C6)] text-[var(--text,#1F1E1B)] transition hover:border-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="sr-only">{label}</span>
      {icon}
    </button>
  )
}

type InspectorSectionProps = {
  id: string
  icon: React.ReactNode
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  grow?: boolean
}

const InspectorSection = React.forwardRef<HTMLDivElement | null, InspectorSectionProps>(
  function InspectorSection({ id, icon, label, open, onToggle, children, grow = false }, ref) {
    const growClasses = grow && open ? 'flex-1 min-h-0' : ''
    return (
      <section
        id={id}
        ref={ref}
        tabIndex={-1}
        className={`flex shrink-0 flex-col rounded-[18px] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] shadow-[0_18px_40px_rgba(31,30,27,0.12)] ${growClasses}`}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={onToggle}
          className="flex items-center gap-3 px-4 py-2 text-sm font-semibold text-[var(--text,#1F1E1B)]"
        >
          <span className="inline-flex items-center gap-2">
            <span className="text-[var(--text-muted,#6B645B)]">{icon}</span>
            {label}
          </span>
          <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            {open ? 'Hide' : 'Show'}
          </span>
        </button>
        <div
          id={`${id}-content`}
          aria-hidden={!open}
          className={`${open ? `${grow ? 'flex flex-col ' : ''}px-4 pb-4 pt-1` : 'hidden'} ${growClasses}`}
        >
          {children}
        </div>
      </section>
    )
  }
)

type KeyDataRow = { label: string; value: React.ReactNode }

function KeyDataGrid({ rows }: { rows: KeyDataRow[] }) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-4 text-sm">
          <dt className="w-32 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            {row.label}
          </dt>
          <dd className="flex-1 text-right text-sm font-semibold text-[var(--text,#1F1E1B)]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ColorLabelValue({ value }: { value: ColorTag }) {
  const swatch = COLOR_MAP[value] ?? COLOR_MAP.None
  return (
    <span className="inline-flex w-full items-center justify-end gap-2 text-right">
      <span
        className="h-3 w-3 rounded-full border border-[var(--border,#EDE1C6)]"
        style={{ backgroundColor: swatch }}
      />
      {value}
    </span>
  )
}

function formatRatingValue(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 'Unrated'
  return `${value} / 5`
}

function InspectorRail({
  onExpand,
  onKeyData,
  onProjects,
  onMetadata,
}: {
  onExpand: () => void
  onKeyData: () => void
  onProjects: () => void
  onMetadata: () => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Image Details panel rail"
      className="pointer-events-auto flex h-full w-full flex-col items-center rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-1 py-3 shadow-[0_20px_40px_rgba(31,30,27,0.18)]"
    >
      <div className="flex flex-col items-center gap-2">
        <InspectorRailButton
          icon={<ChevronLeftIcon className="h-4 w-4" />}
          label="Expand Image Details panel"
          onClick={onExpand}
        />
        <RailDivider />
      </div>
      <div className="mt-3 flex flex-1 flex-col items-center gap-2">
        <InspectorRailButton
          icon={<InfoIcon className="h-4 w-4" />}
          label="Key data"
          onClick={onKeyData}
        />
        <InspectorRailButton
          icon={<FolderIcon className="h-4 w-4" />}
          label="Projects"
          onClick={onProjects}
        />
        <InspectorRailButton
          icon={<CameraIcon className="h-4 w-4" />}
          label="Metadata"
          onClick={onMetadata}
        />
        <InspectorRailButton
          icon={<CalendarClockIcon className="h-4 w-4" />}
          label="Dates"
          onClick={onMetadata}
        />
      </div>
      <div className="mt-auto flex flex-col items-center gap-2">
        <RailDivider />
        <InspectorRailButton
          icon={<SettingsIcon className="h-4 w-4" />}
          label="Image Details settings"
          onClick={onMetadata}
        />
      </div>
    </div>
  )
}

function UsedProjectsSection({
  projects,
  loading,
  error,
  metadataSourceId,
  onChangeMetadataSource,
  metadataSourceBusy,
  actionError,
}: {
  projects: UsedProjectLink[]
  loading: boolean
  error: string | null
  metadataSourceId: MetadataSourceId
  onChangeMetadataSource: (nextId: MetadataSourceId) => void
  metadataSourceBusy: boolean
  actionError?: string | null
}) {
  if (loading) {
    return <p className="text-sm text-[var(--text-muted,#6B645B)]">Loading project memberships…</p>
  }
  if (error) {
    return <p className="text-sm text-[#B42318]">{error}</p>
  }
  const currentProject = projects.find((project) => project.isCurrentProject) ?? null
  const activeProject =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID
      ? null
      : (projects.find((project) => project.id === metadataSourceId) ?? null)
  const activeTitle =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID
      ? 'Current configuration'
      : (activeProject?.name ?? 'Project unavailable')
  const activeSubtitle =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID
      ? "This image's own settings."
      : (activeProject?.lastUpdatedLabel ?? 'Last updated —')
  const activePreview =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID ? null : (activeProject?.previewImageUrl ?? null)
  const activeFallback =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID
      ? 'CFG'
      : projectInitials(activeProject?.name ?? '')

  const handleSelect = (nextId: MetadataSourceId) => {
    if (metadataSourceBusy || metadataSourceId === nextId) return
    onChangeMetadataSource(nextId)
  }

  return (
    <div className="space-y-4 text-[var(--text,#1F1E1B)]">
      <div>
        <h3 className="text-sm font-semibold">Metadata source</h3>
        <p className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
          Select which configuration should provide the metadata for this image. Switching sources
          is non-destructive and you can always return to the current configuration.
        </p>
        {actionError ? <p className="mt-2 text-xs text-[#B42318]">{actionError}</p> : null}
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
          Active source
        </div>
        <ActiveSourceSummaryCard
          title={activeTitle}
          subtitle={activeSubtitle}
          previewImageUrl={activePreview}
          fallbackLabel={activeFallback}
        />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
          Available sources
        </div>
        <div role="radiogroup" className="space-y-1.5">
          <MetadataSourceRow
            title="Current configuration"
            subtitle="Use this image's own settings."
            previewImageUrl={currentProject?.previewImageUrl ?? null}
            fallbackLabel="CFG"
            badge={null}
            selected={metadataSourceId === CURRENT_CONFIG_SOURCE_ID}
            disabled={metadataSourceBusy}
            onSelect={() => handleSelect(CURRENT_CONFIG_SOURCE_ID)}
          />
          {projects.length ? (
            projects.map((project) => (
              <MetadataSourceRow
                key={project.id}
                title={project.name}
                subtitle={project.lastUpdatedLabel}
                previewImageUrl={project.previewImageUrl}
                fallbackLabel={projectInitials(project.name)}
                badge={project.isCurrentProject ? 'Current project' : null}
                selected={metadataSourceId === project.id}
                disabled={metadataSourceBusy || project.isCurrentProject}
                onSelect={() => handleSelect(project.id)}
              />
            ))
          ) : (
            <p className="text-sm text-[var(--text-muted,#6B645B)]">
              No other projects use this image.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ActiveSourceSummaryCard({
  title,
  subtitle,
  previewImageUrl,
  fallbackLabel,
}: {
  title: string
  subtitle: string
  previewImageUrl: string | null
  fallbackLabel: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-3">
      <MetadataSourceThumbnail previewImageUrl={previewImageUrl} fallbackLabel={fallbackLabel} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)]">{subtitle}</div>
      </div>
    </div>
  )
}

function MetadataSourceRow({
  title,
  subtitle,
  previewImageUrl,
  fallbackLabel,
  badge,
  selected,
  disabled,
  onSelect,
}: {
  title: string
  subtitle: string
  previewImageUrl: string | null
  fallbackLabel: string
  badge: string | null
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${
        selected
          ? 'border-[var(--river-400,#69A3AE)] bg-[var(--river-50,#F0F7F6)]'
          : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] hover:border-[var(--text,#1F1E1B)]'
      } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect()
      }}
    >
      <RadioIndicator selected={selected} />
      <MetadataSourceThumbnail previewImageUrl={previewImageUrl} fallbackLabel={fallbackLabel} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-[var(--text-muted,#6B645B)]">{subtitle}</div>
      </div>
      {badge ? (
        <span className="ml-2 shrink-0 rounded-full bg-[var(--surface-subtle,#FBF7EF)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted,#6B645B)]">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
        selected ? 'border-[var(--river-500,#3B7F87)]' : 'border-[var(--border,#EDE1C6)]'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${selected ? 'bg-[var(--river-500,#3B7F87)]' : 'bg-transparent'}`}
      />
    </span>
  )
}

function MetadataSourceThumbnail({
  previewImageUrl,
  fallbackLabel,
}: {
  previewImageUrl: string | null
  fallbackLabel: string
}) {
  if (previewImageUrl) {
    return (
      <img
        src={previewImageUrl}
        alt=""
        className="h-9 w-9 rounded-[8px] object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] text-[11px] font-semibold uppercase text-[var(--text,#1F1E1B)]">
      {fallbackLabel || '—'}
    </div>
  )
}

function InspectorBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'danger'
}) {
  const tones: Record<string, string> = {
    neutral: 'border border-[var(--border,#EDE1C6)] text-[var(--text-muted,#6B645B)]',
    primary: 'bg-[var(--river-100,#E3F2F4)] text-[var(--river-700,#2F5F62)]',
    success: 'bg-[#ECFDF3] text-[#027A48]',
    danger: 'bg-[#FEF3F2] text-[#B42318]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone] || tones.neutral}`}
    >
      {children}
    </span>
  )
}

const METADATA_GROUP_ORDER: { id: MetadataCategory; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'lens', label: 'Lens' },
  { id: 'exposure', label: 'Exposure' },
  { id: 'gps', label: 'GPS' },
  { id: 'software', label: 'Software' },
  { id: 'custom', label: 'Custom' },
]

function groupMetadataEntries(entries: MetadataEntry[]): MetadataGroup[] {
  if (!entries.length) return []
  const buckets: Record<MetadataCategory, MetadataEntry[]> = {
    camera: [],
    lens: [],
    exposure: [],
    gps: [],
    software: [],
    custom: [],
  }
  entries.forEach((entry) => {
    const category = categorizeMetadataKey(entry.normalizedKey)
    buckets[category].push(entry)
  })
  return METADATA_GROUP_ORDER.map((category) => ({
    id: category.id,
    label: category.label,
    entries: buckets[category.id].sort((a, b) => a.label.localeCompare(b.label)),
  })).filter((group) => group.entries.length > 0)
}

function categorizeMetadataKey(normalizedKey: string): MetadataCategory {
  const key = normalizedKey.split(':').pop() ?? normalizedKey
  if (key.includes('lens')) return 'lens'
  if (key.includes('camera') || key.includes('model') || key.includes('body')) return 'camera'
  if (
    key.includes('exposure') ||
    key.includes('aperture') ||
    key.includes('shutter') ||
    key.includes('iso') ||
    key.includes('speed')
  )
    return 'exposure'
  if (
    key.includes('gps') ||
    key.includes('latitude') ||
    key.includes('longitude') ||
    key.includes('location')
  )
    return 'gps'
  if (
    key.includes('software') ||
    key.includes('firmware') ||
    key.includes('application') ||
    key.includes('program') ||
    key.includes('version')
  )
    return 'software'
  return 'custom'
}

function formatMetadataEntryValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return value.map((item) => formatMetadataEntryValue(item)).join(', ')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number') {
    return formatMetadataEntryNumber(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return '—'
    const decimalMatch = trimmed.match(/^-?\d+\.(\d{4,})/)
    if (decimalMatch) {
      const [whole] = trimmed.split('.')
      return `${whole}.${decimalMatch[1].slice(0, 4)}`
    }
    return trimmed
  }
  return String(value)
}

function formatMetadataEntryNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const magnitude = Math.abs(value)
  const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2
  const fixed = value.toFixed(decimals)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function projectInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (!parts.length) return 'P'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
