import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { RawPlaceholder, RawPlaceholderFrame } from '../../components/RawPlaceholder'
import ProjectSettingsButton from '../../components/ProjectSettingsButton'
import StoneTrailLogo from '../../components/StoneTrailLogo'
import DialogHeader from '../../components/DialogHeader'
import { useTheme } from '../../shared/theme'
import { TOKENS } from './utils'
import type { Photo, ImgType, ColorTag } from './types'
import SettingsIcon from '../../shared/icons/SettingsIcon'

const COLOR_MAP: Record<ColorTag, string> = {
  None: '#E5E7EB',
  Red: '#F87171',
  Green: '#34D399',
  Blue: '#60A5FA',
  Yellow: '#FBBF24',
  Purple: '#C084FC',
}

export type DateTreeDayNode = {
  id: string
  label: string
  count: number
  year: string
  month: string
  day: string
  parentYearId: string
  parentMonthId: string
}

export type DateTreeMonthNode = {
  id: string
  label: string
  count: number
  year: string
  month: string
  parentYearId: string
  days: DateTreeDayNode[]
}

export type DateTreeYearNode = {
  id: string
  label: string
  count: number
  year: string
  months: DateTreeMonthNode[]
}

export type GridSelectOptions = {
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
}

export const CURRENT_CONFIG_SOURCE_ID = 'current-config' as const
export type MetadataSourceId = typeof CURRENT_CONFIG_SOURCE_ID | string

type UsedProjectLink = {
  id: string
  name: string
  lastUpdatedLabel: string
  previewImageUrl: string | null
  isCurrentProject: boolean
}

type InspectorField = {
  label: string
  value: string
}

type KeyMetadataSections = {
  general: InspectorField[]
  capture: InspectorField[]
}

type MetadataSummary = {
  rating: number
  colorLabel: ColorTag
  pickRejectLabel: string
  picked: boolean
  rejected: boolean
  hasEdits: boolean
}

type InspectorPreviewData = {
  src: string | null
  thumbSrc: string | null
  alt: string
  placeholderRatio: Photo['placeholderRatio']
}

export type InspectorViewportRect = {
  x: number
  y: number
  width: number
  height: number
}

export type InspectorPreviewPanCommand = {
  x: number
  y: number
  token: number
}

type MetadataEntry = {
  key: string
  normalizedKey: string
  label: string
  value: unknown
}

type MetadataCategory = 'camera' | 'lens' | 'exposure' | 'gps' | 'software' | 'custom'

type MetadataGroup = {
  id: MetadataCategory
  label: string
  entries: MetadataEntry[]
}

type ProjectOverviewData = {
  title: string
  description: string
  client: string
  tags: string[]
  assetCount: number
  createdAt: string | null
}

function setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

export function computeCols(containerWidth: number, size: number, gap: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 1
  if (!Number.isFinite(size) || size <= 0) return 1
  const divisor = size + gap
  if (divisor <= 0) return 1
  const possible = Math.floor((containerWidth + gap) / divisor)
  return Math.max(1, possible)
}

export type WorkspaceFilterControls = {
  minStars: 0 | 1 | 2 | 3 | 4 | 5
  setMinStars: (value: 0 | 1 | 2 | 3 | 4 | 5) => void
  filterColor: 'Any' | ColorTag
  setFilterColor: (value: 'Any' | ColorTag) => void
  showJPEG: boolean
  setShowJPEG: (value: boolean) => void
  showRAW: boolean
  setShowRAW: (value: boolean) => void
  onlyPicked: boolean
  setOnlyPicked: (value: boolean) => void
  hideRejected: boolean
  setHideRejected: (value: boolean) => void
  dateFilterActive: boolean
  selectedDayLabel: string | null
  clearDateFilter: () => void
}

const SHORTCUTS_LEGEND_ID = 'shortcuts-legend'
const FILTERS_DIALOG_ID = 'workspace-filters-dialog'
const PROJECT_DATE_FORMAT = typeof Intl !== 'undefined' ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }) : null

export function TopBar({
  projectName,
  onBack,
  onRename,
  renamePending,
  renameError,
  view,
  onChangeView,
  gridSize,
  minGridSize,
  onGridSizeChange,
  filters,
  filterCount,
  onResetFilters,
  stackPairsEnabled,
  onToggleStackPairs,
  stackTogglePending,
  selectedCount,
  onOpenExport,
  onOpenSettings,
  layout = 'desktop',
}: {
  projectName: string
  onBack: () => void
  onRename: (next: string) => Promise<void> | void
  renamePending?: boolean
  renameError?: string | null
  view: 'grid' | 'detail'
  onChangeView: (next: 'grid' | 'detail') => void
  gridSize: number
  minGridSize: number
  onGridSizeChange: (value: number) => void
  filters: WorkspaceFilterControls
  filterCount: number
  onResetFilters: () => void
  stackPairsEnabled: boolean
  onToggleStackPairs: (next: boolean) => void
  stackTogglePending?: boolean
  selectedCount: number
  onOpenExport: () => void
  onOpenSettings: () => void
  layout?: 'desktop' | 'mobile'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(projectName)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const shortcutsButtonRef = useRef<HTMLButtonElement | null>(null)
  const [filtersAnchorRect, setFiltersAnchorRect] = useState<DOMRect | null>(null)
  const [shortcutsAnchorRect, setShortcutsAnchorRect] = useState<DOMRect | null>(null)
  const { mode, toggle } = useTheme()

  const syncFiltersAnchor = useCallback(() => {
    if (!filtersButtonRef.current) return
    setFiltersAnchorRect(filtersButtonRef.current.getBoundingClientRect())
  }, [])

  const syncShortcutsAnchor = useCallback(() => {
    if (!shortcutsButtonRef.current) return
    setShortcutsAnchorRect(shortcutsButtonRef.current.getBoundingClientRect())
  }, [])

  const closeFilters = useCallback(() => {
    setFiltersOpen(false)
    setFiltersAnchorRect(null)
    filtersButtonRef.current?.focus()
  }, [])

  const closeShortcuts = useCallback(() => {
    setShortcutsOpen(false)
    setShortcutsAnchorRect(null)
    shortcutsButtonRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!filtersOpen) return
    const handle = () => syncFiltersAnchor()
    handle()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [filtersOpen, syncFiltersAnchor])

  useLayoutEffect(() => {
    if (!shortcutsOpen) return
    const handle = () => syncShortcutsAnchor()
    handle()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [shortcutsOpen, syncShortcutsAnchor])

  useEffect(() => {
    if (!editing) {
      setDraft(projectName)
    }
  }, [projectName, editing])

  useEffect(() => {
    if (!editing) return
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])


  const startEditing = useCallback(() => {
    setDraft(projectName)
    setEditing(true)
  }, [projectName])

  const cancelEditing = useCallback(() => {
    setDraft(projectName)
    setEditing(false)
  }, [projectName])

  const commitRename = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(projectName)
      setEditing(false)
      return
    }
    if (trimmed === projectName.trim()) {
      setEditing(false)
      return
    }
    try {
      await onRename(trimmed)
      setEditing(false)
    } catch {
      // keep editing so the user can resolve the error surfaced below
    }
  }, [draft, onRename, projectName])

  const handleTitleKey = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitRename()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
  }, [cancelEditing, commitRename])

  const handleBlur = useCallback(() => {
    if (renamePending) return
    void commitRename()
  }, [commitRename, renamePending])

  const filterLabel = useMemo(() => {
    if (filterCount === 0) return 'Filters'
    return `Filters · ${filterCount}`
  }, [filterCount])

  const viewButtonClasses = (mode: 'grid' | 'detail') =>
    `inline-flex h-9 w-[88px] items-center justify-center text-[12px] font-medium transition-colors ${
      view === mode ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)]'
    }`

  const sizeControlWidth = 200
  const canExport = selectedCount > 0
  const isMobileLayout = layout === 'mobile'

  if (isMobileLayout) {
    return (
      <header className="sticky top-0 z-50 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1 text-[12px] font-medium text-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)]"
            aria-label="Back to projects"
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            <span>Projects</span>
          </button>
          <div className="flex min-w-0 flex-1 justify-center">
            {editing ? (
              <div className="relative w-full max-w-[220px]">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleTitleKey}
                  onBlur={handleBlur}
                  disabled={renamePending}
                  aria-label="Project name"
                  className="h-10 w-full rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 text-center text-sm font-semibold text-[var(--text,#1F1E1B)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--stone-trail-brand-focus,#4A463F)]"
                />
                {renameError ? <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-[#B42318]">{renameError}</span> : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="max-w-[220px] truncate text-center text-sm font-semibold text-[var(--text,#1F1E1B)]"
                title="Rename project"
              >
                {projectName}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              ref={filtersButtonRef}
              onClick={() => {
                if (filtersOpen) {
                  closeFilters()
                } else {
                  setFiltersOpen(true)
                  syncFiltersAnchor()
                }
              }}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
                filtersOpen ? 'bg-[var(--sand-100,#F3EBDD)]' : 'bg-[var(--surface,#FFFFFF)]'
              }`}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              aria-controls={FILTERS_DIALOG_ID}
              title={filterLabel}
            >
              <FilterIcon className="h-5 w-5" aria-hidden="true" />
              {filterCount ? <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--text,#1F1E1B)] px-1 text-[10px] font-semibold text-[var(--surface,#FFFFFF)]">{filterCount}</span> : null}
              <span className="sr-only">{filterLabel}</span>
            </button>
            <button
              type="button"
              ref={shortcutsButtonRef}
              onClick={() => {
                if (shortcutsOpen) {
                  closeShortcuts()
                } else {
                  setShortcutsOpen(true)
                  syncShortcutsAnchor()
                }
              }}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
                shortcutsOpen ? 'bg-[var(--sand-100,#F3EBDD)]' : 'bg-[var(--surface,#FFFFFF)]'
              }`}
              aria-haspopup="dialog"
              aria-expanded={shortcutsOpen}
              aria-controls={SHORTCUTS_LEGEND_ID}
              title="Shortcuts"
            >
              <ShortcutIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Keyboard shortcuts</span>
            </button>
            <ProjectSettingsButton onClick={onOpenSettings} label="Open application settings" title="Application settings" />
          </div>
        </div>
        {filtersOpen ? (
          <FiltersDialog
            controls={filters}
            onReset={() => {
              onResetFilters()
              closeFilters()
            }}
            onClose={closeFilters}
            anchorRect={filtersAnchorRect}
          />
        ) : null}
        {shortcutsOpen ? <ShortcutsDialog onClose={closeShortcuts} anchorRect={shortcutsAnchorRect} /> : null}
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/95 backdrop-blur">
      <div className="grid h-16 w-full items-center gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
        <div className="flex min-w-0 items-center gap-3 pl-2 sm:pl-4">
          <StoneTrailLogo className="hidden lg:inline-flex shrink-0" showLabel={false} mode={mode} onToggleTheme={toggle} />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] font-medium text-[var(--text,#1F1E1B)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[var(--text-muted,#6B645B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] md:hidden"
            aria-label="Back to projects"
          >
            ← Projects
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <nav className="flex min-w-0 items-center gap-3 text-sm text-[var(--text-muted,#6B645B)]" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={onBack}
                className="font-medium text-[var(--text-muted,#6B645B)] transition-colors hover:text-[var(--text,#1F1E1B)]"
              >
                Projects
              </button>
              <span aria-hidden="true" className="text-base leading-none text-[var(--text-muted,#6B645B)]">
                ›
              </span>
              {editing ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleTitleKey}
                      onBlur={handleBlur}
                      disabled={renamePending}
                      aria-label="Project name"
                      className="h-9 min-w-[200px] max-w-[260px] rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 text-sm font-semibold text-[var(--text,#1F1E1B)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--stone-trail-brand-focus,#4A463F)]"
                    />
                    {renameError ? (
                      <span className="absolute -bottom-5 left-0 text-xs text-[#B42318]">{renameError}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void commitRename()}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-xs"
                    disabled={renamePending}
                    aria-label="Save project name"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-xs"
                    disabled={renamePending}
                    aria-label="Cancel renaming"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onDoubleClick={startEditing}
                  className="truncate text-left text-sm font-semibold text-[var(--text,#1F1E1B)]"
                  title="Rename project"
                >
                  {projectName}
                </button>
              )}
            </nav>
            {!editing ? (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-xs text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]"
                aria-label="Rename project"
              >
                ✎
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center overflow-hidden rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
            <button type="button" className={`${viewButtonClasses('grid')} border-r border-[var(--border,#E1D3B9)]`} onClick={() => onChangeView('grid')}>
              Grid
            </button>
            <button type="button" className={viewButtonClasses('detail')} onClick={() => onChangeView('detail')}>
              Detail
            </button>
          </div>
          <button
            type="button"
            className={`inline-flex h-9 min-w-[170px] flex-shrink-0 items-center justify-center gap-3 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
              stackPairsEnabled ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)]'
            } ${stackTogglePending ? 'cursor-not-allowed opacity-60' : ''}`}
            aria-pressed={stackPairsEnabled}
            onClick={() => onToggleStackPairs(!stackPairsEnabled)}
            disabled={stackTogglePending}
          >
            <span>{stackPairsEnabled ? 'Stacking' : 'Stack'}</span>
            <span>JPEG + RAW</span>
          </button>
          <button
            type="button"
            onClick={onOpenExport}
            disabled={!canExport}
            className={`inline-flex h-9 min-w-[150px] flex-shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 text-[12px] font-semibold text-[var(--text,#1F1E1B)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
              canExport ? 'hover:bg-[var(--sand-50,#F9F4EC)]' : 'text-[var(--text-muted,#6B645B)] cursor-not-allowed opacity-60'
            }`}
            aria-disabled={!canExport}
            title={canExport ? `Export ${selectedCount} photo${selectedCount === 1 ? '' : 's'}` : 'Select at least one photo to enable exporting'}
          >
            <span aria-hidden="true">⇣</span>
            <span>Export…</span>
            {canExport ? <CountBadge count={selectedCount} /> : null}
          </button>
          <div
            data-testid="top-bar-size-control"
            className="hidden h-9 flex-shrink-0 items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[11px] text-[var(--text-muted,#6B645B)] lg:flex"
            style={{ width: sizeControlWidth }}
          >
            <span className="text-[11px] font-medium text-[var(--text-muted,#6B645B)]">Size</span>
            {view === 'grid' ? (
              <input
                type="range"
                min={minGridSize}
                max={240}
                value={gridSize}
                onChange={(event) => onGridSizeChange(Number(event.target.value))}
                aria-label="Thumbnail size"
                className="h-1.5 flex-1 accent-[var(--text,#1F1E1B)]"
              />
            ) : (
              <span className="flex-1 text-right text-[10px] text-[var(--text-muted,#6B645B)]">Unavailable in detail view</span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-3 px-4 sm:px-6 lg:px-8">
          <ProjectSettingsButton onClick={onOpenSettings} label="Open application settings" title="Application settings" />
          <button
            type="button"
            ref={filtersButtonRef}
            onClick={() => {
              if (filtersOpen) {
                closeFilters()
              } else {
                setFiltersOpen(true)
                syncFiltersAnchor()
              }
            }}
            className={`inline-flex h-9 min-w-[110px] items-center justify-center gap-2 rounded-full border px-4 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
              filterCount ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
            }`}
            aria-haspopup="dialog"
            aria-controls={FILTERS_DIALOG_ID}
            aria-expanded={filtersOpen}
            title={filterLabel}
          >
            <span>Filters</span>
            {filterCount ? <CountBadge count={filterCount} /> : null}
          </button>
          <button
            type="button"
            ref={shortcutsButtonRef}
            onClick={() => {
              if (shortcutsOpen) {
                closeShortcuts()
              } else {
                setShortcutsOpen(true)
                syncShortcutsAnchor()
              }
            }}
            className={`inline-flex h-9 min-w-[130px] items-center justify-center gap-2 rounded-full border px-4 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
              shortcutsOpen ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
            }`}
            aria-haspopup="dialog"
            aria-expanded={shortcutsOpen}
            aria-controls={SHORTCUTS_LEGEND_ID}
          >
            <span aria-hidden="true">⌨</span>
            <span>Shortcuts</span>
          </button>
        </div>
      </div>
      {filtersOpen ? (
        <FiltersDialog
          controls={filters}
          onReset={() => {
            onResetFilters()
            closeFilters()
          }}
          onClose={closeFilters}
          anchorRect={filtersAnchorRect}
        />
      ) : null}
      {shortcutsOpen ? <ShortcutsDialog onClose={closeShortcuts} anchorRect={shortcutsAnchorRect} /> : null}
    </header>
  )
}

type OverlayDialogProps = {
  id?: string
  title: string
  onClose: () => void
  headerAction?: React.ReactNode
  children: React.ReactNode
  maxWidthClass?: string
  anchorRect?: DOMRect | null
}

function OverlayDialog({ id, title, onClose, headerAction, children, maxWidthClass = 'max-w-md', anchorRect }: OverlayDialogProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const anchored = Boolean(anchorRect)
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  const anchorStyle = anchorRect
    ? {
        position: 'absolute' as const,
        top: Math.min(anchorRect.bottom + 12, viewportHeight - 24),
        right: Math.max(16, viewportWidth - anchorRect.right),
        maxHeight: 'calc(100vh - 48px)',
      }
    : undefined

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] bg-black/20 px-4 py-8 ${anchored ? '' : 'flex items-center justify-center'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClass} rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[12px] shadow-xl`}
        style={anchorStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogHeader title={title} onClose={onClose} actions={headerAction} closeLabel={`Close ${title}`} />
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export type MobileWorkspacePanel = 'project' | 'photos' | 'details'

export function MobilePhotosModeToggle({ view, onChange }: { view: 'grid' | 'detail'; onChange: (next: 'grid' | 'detail') => void }) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="inline-flex w-full max-w-sm rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] p-1 text-[12px] font-medium text-[var(--text-muted,#6B645B)] shadow-[0_4px_12px_rgba(31,30,27,0.08)]">
        {(['grid', 'detail'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`flex-1 rounded-full px-3 py-1 capitalize transition ${
              view === mode ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)] shadow-[0_2px_8px_rgba(31,30,27,0.18)]' : ''
            }`}
            aria-pressed={view === mode}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MobileBottomBar({
  activePanel,
  onSelectPanel,
  onOpenExport,
  canExport,
  onToggleStack,
  stackEnabled,
  detailsDisabled,
  stackTogglePending = false,
}: {
  activePanel: MobileWorkspacePanel
  onSelectPanel: (panel: MobileWorkspacePanel) => void
  onOpenExport: () => void
  canExport: boolean
  onToggleStack: () => void
  stackEnabled: boolean
  detailsDisabled: boolean
  stackTogglePending?: boolean
}) {
  return (
    <nav className="border-t border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)]/95 px-3 pb-3 pt-2 text-[11px] text-[var(--text-muted,#6B645B)] shadow-[0_-6px_30px_rgba(31,30,27,0.08)]">
      <div className="grid grid-cols-5 gap-1">
        <MobileNavButton
          label="Project"
          icon={<LayoutListIcon className="h-5 w-5" aria-hidden="true" />}
          active={activePanel === 'project'}
          onClick={() => onSelectPanel('project')}
        />
        <MobileNavButton
          label="Photos"
          icon={<FrameIcon className="h-5 w-5" aria-hidden="true" />}
          active={activePanel === 'photos'}
          highlight
          onClick={() => onSelectPanel('photos')}
        />
        <MobileNavButton
          label="Details"
          icon={<InspectorIcon className="h-5 w-5" aria-hidden="true" />}
          active={activePanel === 'details'}
          onClick={() => onSelectPanel('details')}
          disabled={detailsDisabled}
        />
        <button
          type="button"
          onClick={onOpenExport}
          disabled={!canExport}
          className={`flex flex-col items-center justify-center rounded-2xl border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-center text-[11px] font-semibold transition ${
            canExport ? 'text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)] opacity-60'
          }`}
        >
          <ExportIcon className="h-5 w-5" aria-hidden="true" />
          <span>Export</span>
        </button>
        <button
          type="button"
          onClick={onToggleStack}
          aria-pressed={stackEnabled}
          disabled={stackTogglePending}
          className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-1 text-center text-[11px] font-semibold transition ${
            stackEnabled
              ? 'border-[var(--text,#1F1E1B)] bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)]'
              : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)]'
          } ${stackTogglePending ? 'opacity-60' : ''}`}
        >
          <StackIcon className="h-5 w-5" aria-hidden="true" />
          <span>Stack</span>
        </button>
      </div>
    </nav>
  )
}

function MobileNavButton({
  label,
  icon,
  onClick,
  active,
  highlight = false,
  disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  highlight?: boolean
  disabled?: boolean
}) {
  const activeClasses = active ? 'text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)]'
  const highlightClasses = highlight ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#EDE1C6)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center rounded-2xl border bg-[var(--surface,#FFFFFF)] px-2 py-1 text-center text-[11px] font-semibold transition ${
        disabled ? 'opacity-60' : ''
      } ${activeClasses} ${highlightClasses}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function FiltersDialog({ controls, onReset, onClose, anchorRect }: { controls: WorkspaceFilterControls; onReset: () => void; onClose: () => void; anchorRect?: DOMRect | null }) {
  return (
    <OverlayDialog
      id={FILTERS_DIALOG_ID}
      title="Filters"
      onClose={onClose}
      headerAction={
        <button type="button" onClick={onReset} className="text-[11px] font-medium text-[var(--river-500,#6B7C7A)] hover:underline">
          Reset
        </button>
      }
      anchorRect={anchorRect}
    >
      {controls.dateFilterActive ? (
        <div className="mb-3 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-3 py-2">
          <div className="text-[11px] font-semibold text-[var(--text,#1F1E1B)]">Date</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted,#6B645B)]">
            <span className="truncate">{controls.selectedDayLabel ?? 'Custom date range'}</span>
            <button type="button" onClick={() => { controls.clearDateFilter(); onClose() }} className="font-medium text-[var(--river-500,#6B7C7A)] hover:underline">
              Clear
            </button>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Rating</div>
          <MinStarRow value={controls.minStars} onChange={controls.setMinStars} />
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Color</div>
          <ColorFilter value={controls.filterColor} onChange={controls.setFilterColor} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input type="checkbox" checked={controls.showJPEG} onChange={(event) => controls.setShowJPEG(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
            JPEG
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input type="checkbox" checked={controls.showRAW} onChange={(event) => controls.setShowRAW(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
            RAW
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input type="checkbox" checked={controls.onlyPicked} onChange={(event) => controls.setOnlyPicked(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
            Picks only
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input type="checkbox" checked={controls.hideRejected} onChange={(event) => controls.setHideRejected(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
            Hide rejects
          </label>
        </div>
      </div>
    </OverlayDialog>
  )
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'G', description: 'Switch to the grid view' },
  { keys: 'D', description: 'Open detail view' },
  { keys: 'P', description: 'Toggle pick for the selection' },
  { keys: 'X', description: 'Reject the selected assets' },
  { keys: '1-5', description: 'Apply a star rating' },
  { keys: '6 / 7 / 8 / 9 / 0', description: 'Apply color labels (Red, Yellow, Green, Blue, Purple)' },
  { keys: 'Left / Right arrows', description: 'Move between photos' },
  { keys: 'Alt + [ / ]', description: 'Collapse or expand the date rail' },
]

function ShortcutsDialog({ onClose, anchorRect }: { onClose: () => void; anchorRect?: DOMRect | null }) {
  return (
    <OverlayDialog id={SHORTCUTS_LEGEND_ID} title="Keyboard shortcuts" onClose={onClose} maxWidthClass="max-w-2xl" anchorRect={anchorRect}>
      <ul className="grid gap-2 text-[11px] sm:grid-cols-2">
        {SHORTCUTS.map((shortcut) => (
          <li
            key={shortcut.keys}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2"
          >
            <span className="font-mono text-[11px] text-[var(--text-muted,#6B645B)]">{shortcut.keys}</span>
            <span className="text-right text-[var(--text,#1F1E1B)]">{shortcut.description}</span>
          </li>
        ))}
      </ul>
    </OverlayDialog>
  )
}

function MinStarRow({ value, onChange }: { value: 0 | 1 | 2 | 3 | 4 | 5; onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void }) {
  const stars = [0, 1, 2, 3, 4, 5] as const
  return (
    <div className="inline-flex items-center gap-1">
      {stars.map((s) => (
        <button
          key={s}
          type="button"
          className={`rounded-full px-2 py-0.5 text-[11px] ${value >= s ? 'border border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'}`}
          onClick={() => onChange(s)}
          aria-label={`Minimum ${s} star${s === 1 ? '' : 's'}`}
        >
          {s === 0 ? 'All' : '★'.repeat(s)}
        </button>
      ))}
    </div>
  )
}

function ColorFilter({ value, onChange }: { value: 'Any' | ColorTag; onChange: (v: 'Any' | ColorTag) => void }) {
  const options: Array<{ label: string; value: 'Any' | ColorTag }> = [
    { label: 'Any', value: 'Any' },
    { label: 'Red', value: 'Red' },
    { label: 'Green', value: 'Green' },
    { label: 'Blue', value: 'Blue' },
    { label: 'Yellow', value: 'Yellow' },
    { label: 'Purple', value: 'Purple' },
    { label: 'None', value: 'None' },
  ]
  return (
    <div className="relative w-full">
      <select
        className="w-full appearance-none rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-1 text-[12px] focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as 'Any' | ColorTag)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-[var(--text-muted,#6B645B)]">▾</span>
    </div>
  )
}

function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[var(--sand-100,#F3EBDD)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]${
        className ? ` ${className}` : ''
      }`}
    >
      {count}
    </span>
  )
}

const LEFT_PANEL_ID = 'workspace-project-panel'
const LEFT_PANEL_CONTENT_ID = `${LEFT_PANEL_ID}-content`
const LEFT_OVERVIEW_SECTION_ID = `${LEFT_PANEL_ID}-overview`
const LEFT_IMPORT_SECTION_ID = `${LEFT_PANEL_ID}-import`
const LEFT_DATE_SECTION_ID = `${LEFT_PANEL_ID}-date`
const LEFT_FOLDER_SECTION_ID = `${LEFT_PANEL_ID}-folder`

type LeftPanelTarget = 'overview' | 'import' | 'date' | 'folder'

export function Sidebar({
  dateTree,
  projectOverview,
  onRenameProject,
  renamePending,
  renameError,
  onProjectOverviewChange,
  projectOverviewPending,
  projectOverviewError,
  onOpenImport,
  onSelectDay,
  selectedDayKey,
  selectedDay,
  onClearDateFilter,
  collapsed,
  onCollapse,
  onExpand,
  mode = 'sidebar',
}: {
  dateTree: DateTreeYearNode[]
  projectOverview: ProjectOverviewData | null
  onRenameProject: (next: string) => Promise<void> | void
  renamePending?: boolean
  renameError?: string | null
  onProjectOverviewChange: (patch: { note?: string | null; client?: string | null; tags?: string[] }) => Promise<void> | void
  projectOverviewPending?: boolean
  projectOverviewError?: string | null
  onOpenImport: () => void
  onSelectDay: (day: DateTreeDayNode) => void
  selectedDayKey: string | null
  selectedDay: DateTreeDayNode | null
  onClearDateFilter: () => void
  collapsed: boolean
  onCollapse: () => void
  onExpand: () => void
  mode?: 'sidebar' | 'mobile'
}) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set())
  const [overviewSectionOpen, setOverviewSectionOpen] = useState(true)
  const [importSectionOpen, setImportSectionOpen] = useState(true)
  const [dateSectionOpen, setDateSectionOpen] = useState(true)
  const [folderSectionOpen, setFolderSectionOpen] = useState(true)
  const [pendingTarget, setPendingTarget] = useState<LeftPanelTarget | null>(null)
  const overviewSectionRef = useRef<HTMLDivElement | null>(null)
  const importSectionRef = useRef<HTMLDivElement | null>(null)
  const dateSectionRef = useRef<HTMLDivElement | null>(null)
  const folderSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const allowedYears = new Set(dateTree.map((year) => year.id))
    setExpandedYears((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowedYears.has(id)) next.add(id)
      })
      if (!next.size && dateTree[0]) next.add(dateTree[0].id)
      if (setsAreEqual(prev, next)) return prev
      return next
    })

    const allowedMonths = new Set<string>()
    dateTree.forEach((year) => year.months.forEach((month) => allowedMonths.add(month.id)))
    setExpandedMonths((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowedMonths.has(id)) next.add(id)
      })
      if (setsAreEqual(prev, next)) return prev
      return next
    })
  }, [dateTree])

  useEffect(() => {
    if (!selectedDay) return
    setExpandedYears((prev) => {
      if (prev.has(selectedDay.parentYearId)) return prev
      const next = new Set(prev)
      next.add(selectedDay.parentYearId)
      return next
    })
    setExpandedMonths((prev) => {
      if (prev.has(selectedDay.parentMonthId)) return prev
      const next = new Set(prev)
      next.add(selectedDay.parentMonthId)
      return next
    })
  }, [selectedDay])

  const ensureSectionOpen = useCallback((target: LeftPanelTarget) => {
    if (target === 'overview') setOverviewSectionOpen(true)
    else if (target === 'import') setImportSectionOpen(true)
    else if (target === 'date') setDateSectionOpen(true)
    else setFolderSectionOpen(true)
  }, [])

  const scrollToTarget = useCallback((target: LeftPanelTarget) => {
    const refMap: Record<LeftPanelTarget, React.RefObject<HTMLDivElement | null>> = {
      overview: overviewSectionRef,
      import: importSectionRef,
      date: dateSectionRef,
      folder: folderSectionRef,
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
    if (collapsed || !pendingTarget) return
    ensureSectionOpen(pendingTarget)
    scrollToTarget(pendingTarget)
    setPendingTarget(null)
  }, [collapsed, ensureSectionOpen, pendingTarget, scrollToTarget])

  const handleRailSelect = useCallback(
    (target: LeftPanelTarget) => {
      if (target === 'import') {
        onOpenImport()
        if (!collapsed) {
          ensureSectionOpen(target)
          scrollToTarget(target)
        }
        return
      }
      ensureSectionOpen(target)
      if (collapsed) {
        setPendingTarget(target)
        onExpand()
        return
      }
      scrollToTarget(target)
    },
    [collapsed, ensureSectionOpen, onExpand, onOpenImport, scrollToTarget],
  )

  const toggleYear = useCallback((yearId: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(yearId)) next.delete(yearId)
      else next.add(yearId)
      return next
    })
  }, [])

  const toggleMonth = useCallback((monthId: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthId)) next.delete(monthId)
      else next.add(monthId)
      return next
    })
  }, [])

  const yearHeaderRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const focusYearHeaderByIndex = useCallback(
    (index: number) => {
      const year = dateTree[index]
      if (!year) return
      const button = yearHeaderRefs.current[year.id]
      button?.focus()
    },
    [dateTree],
  )

  const handleYearKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number, year: DateTreeYearNode) => {
      if (dateTree.length === 0) return
      const lastIndex = dateTree.length - 1

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault()
        let targetIndex = index
        if (event.key === 'ArrowDown') targetIndex = Math.min(index + 1, lastIndex)
        else if (event.key === 'ArrowUp') targetIndex = Math.max(index - 1, 0)
        else if (event.key === 'Home') targetIndex = 0
        else if (event.key === 'End') targetIndex = lastIndex
        focusYearHeaderByIndex(targetIndex)
        return
      }

      if ((event.key === 'Enter' || event.key === ' ') && year.months.length > 0) {
        event.preventDefault()
        toggleYear(year.id)
      }
    },
    [dateTree, focusYearHeaderByIndex, toggleYear],
  )

  const renderTree = () => {
    if (!dateTree.length) {
      return (
        <div className="rounded-[14px] border border-dashed border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-4 text-center text-[11px] text-[var(--text-muted,#6B645B)]">
          No photos yet. Use the Project Overview tools to import photos and populate your folders.
        </div>
      )
    }

    return (
      <ul className="space-y-2">
        {dateTree.map((year, yearIndex) => {
          const yearExpanded = expandedYears.has(year.id)
          const hasMonths = year.months.length > 0
          const yearHeaderId = `date-year-header-${year.id}`
          const yearPanelId = `date-year-panel-${year.id}`
          return (
            <li key={year.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) yearHeaderRefs.current[year.id] = el
                  else delete yearHeaderRefs.current[year.id]
                }}
                id={yearHeaderId}
                onClick={() => {
                  if (hasMonths) toggleYear(year.id)
                }}
                onKeyDown={(event) => handleYearKeyDown(event, yearIndex, year)}
                aria-expanded={hasMonths ? yearExpanded : undefined}
                aria-controls={hasMonths ? yearPanelId : undefined}
                aria-disabled={!hasMonths}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${
                  yearExpanded ? 'bg-[var(--surface,#FFFFFF)] shadow-[0_12px_30px_rgba(31,30,27,0.08)]' : 'hover:bg-[var(--surface-hover,#F4EBDD)]'
                }`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] text-[11px] text-[var(--text-muted,#6B645B)]">
                  {hasMonths ? (yearExpanded ? '▾' : '▸') : '•'}
                </span>
                <span className="flex-1 truncate text-left text-[var(--text,#1F1E1B)]">{year.label}</span>
                <CountBadge count={year.count} />
              </button>
              {hasMonths && yearExpanded ? (
                <div id={yearPanelId} role="region" aria-labelledby={yearHeaderId} className="mt-2 space-y-1.5 rounded-[12px] border border-[var(--border,#EDE1C6)] bg-[var(--surface-frosted,#F8F0E4)] px-2 py-2">
                  <ul className="space-y-1">
                    {year.months.map((month) => {
                      const monthExpanded = expandedMonths.has(month.id)
                      const monthHasDays = month.days.length > 0
                      const monthHeaderId = `date-month-header-${month.id}`
                      const monthPanelId = `date-month-panel-${month.id}`
                      return (
                        <li key={month.id}>
                          <button
                            type="button"
                            id={monthHeaderId}
                            onClick={() => {
                              if (monthHasDays) toggleMonth(month.id)
                            }}
                            aria-expanded={monthHasDays ? monthExpanded : undefined}
                            aria-controls={monthHasDays ? monthPanelId : undefined}
                            className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1 text-left text-[12px] font-medium text-[var(--text,#1F1E1B)] hover:bg-[var(--surface,#FFFFFF)]"
                          >
                            <span className="inline-flex w-4 justify-center text-[11px] text-[var(--text-muted,#6B645B)]">
                              {monthHasDays ? (monthExpanded ? '▾' : '▸') : ''}
                            </span>
                            <span className="flex-1 truncate text-[var(--text,#1F1E1B)]">{month.label}</span>
                            <CountBadge count={month.count} />
                          </button>
                          {monthHasDays && monthExpanded ? (
                            <ul id={monthPanelId} aria-labelledby={monthHeaderId} className="mt-1 space-y-1 pl-6 text-[12px]">
                              {month.days.map((day) => {
                                const isSelected = day.id === selectedDayKey
                                return (
                                  <li key={day.id}>
                                    <button
                                      type="button"
                                      onClick={() => onSelectDay(day)}
                                      aria-pressed={isSelected}
                                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-1.5 text-left font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${
                                        isSelected
                                          ? 'border-[var(--border-strong,#CBB58F)] bg-[var(--accent,#D7C5A6)] text-[var(--on-accent,#3A2F23)] shadow-[0_6px_18px_rgba(31,30,27,0.12)]'
                                          : 'border-transparent text-[var(--text,#1F1E1B)] hover:border-[var(--border,#E1D3B9)] hover:bg-[var(--surface-hover,#F4EBDD)]'
                                      }`}
                                    >
                                      <span className="truncate">{day.label}</span>
                                      <CountBadge count={day.count} className={isSelected ? 'bg-[var(--surface,#FFFFFF)] text-[var(--on-accent,#3A2F23)]' : ''} />
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    )
  }

  const totalPhotos = useMemo(() => dateTree.reduce((sum, year) => sum + year.count, 0), [dateTree])

  const isMobilePanel = mode === 'mobile'
  const collapsedState = isMobilePanel ? false : collapsed
  const panelContainerClass = isMobilePanel
    ? 'flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-1'
    : 'flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] p-4 shadow-[0_30px_80px_rgba(31,30,27,0.16)]'
  const panelContentClass = isMobilePanel
    ? 'flex flex-1 min-h-0 flex-col gap-3 pb-4'
    : 'flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-2'

  return (
    <aside
      id={LEFT_PANEL_ID}
      role="complementary"
      aria-label="Project Overview panel"
      className={`relative h-full min-h-0 ${isMobilePanel ? 'px-3 py-4' : 'px-2 py-4'}`}
      data-state={collapsedState ? 'collapsed' : 'expanded'}
    >
      <div
        data-panel="body"
        aria-hidden={collapsedState}
        className={`h-full min-h-0 ${isMobilePanel ? '' : `transition-opacity duration-150 ${collapsedState ? 'pointer-events-none opacity-0' : 'opacity-100'}`}`}
      >
        <div className={panelContainerClass}>
          {!isMobilePanel ? (
            <header className="sticky top-0 z-10 border-b border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] pb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Collapse Project Overview panel"
                  aria-controls={LEFT_PANEL_CONTENT_ID}
                  onClick={onCollapse}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#EDE1C6)] text-[var(--text,#1F1E1B)] transition hover:border-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                >
                  <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
                </button>
                <LayoutListIcon className="h-4 w-4 text-[var(--text,#1F1E1B)]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Project Overview</span>
              </div>
            </header>
          ) : (
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-[var(--text,#1F1E1B)]">
              <LayoutListIcon className="h-4 w-4" aria-hidden="true" />
              Project Overview
            </div>
          )}
          <div id={LEFT_PANEL_CONTENT_ID} className={panelContentClass}>
            <InspectorSection
              id={LEFT_IMPORT_SECTION_ID}
              ref={importSectionRef}
              icon={<ImportIcon className="h-4 w-4" aria-hidden="true" />}
              label="Import Photos"
              open={importSectionOpen}
              onToggle={() => setImportSectionOpen((open) => !open)}
            >
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted,#6B645B)]">
                  The Import flow is the single entry for adding photos. Use the rail icon when collapsed to jump back here.
                </p>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm font-semibold text-[var(--text,#1F1E1B)] shadow-[0_1px_2px_rgba(31,30,27,0.08)] transition hover:shadow-[0_4px_12px_rgba(31,30,27,0.14)] active:shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                >
                  <PlusIcon className="h-4 w-4" aria-hidden="true" />
                  Open Import Flow
                </button>
                <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                </p>
              </div>
            </InspectorSection>
            <InspectorSection
              id={LEFT_OVERVIEW_SECTION_ID}
              ref={overviewSectionRef}
              icon={<LayoutListIcon className="h-4 w-4" aria-hidden="true" />}
              label="Project Overview"
              open={overviewSectionOpen}
              onToggle={() => setOverviewSectionOpen((open) => !open)}
            >
              {projectOverview ? (
                <ProjectOverviewDetails
                  data={projectOverview}
                  onRename={onRenameProject}
                  renamePending={renamePending}
                  renameError={renameError}
                  onUpdate={onProjectOverviewChange}
                  updatePending={projectOverviewPending}
                  updateError={projectOverviewError}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted,#6B645B)]">Project details unavailable.</p>
              )}
            </InspectorSection>
            <InspectorSection
              id={LEFT_DATE_SECTION_ID}
              ref={dateSectionRef}
              icon={<CalendarIcon className="h-4 w-4" aria-hidden="true" />}
              label="Date"
              open={dateSectionOpen}
              onToggle={() => setDateSectionOpen((open) => !open)}
              grow
            >
              <div className="flex min-h-0 flex-col gap-3">
                <div className="rounded-xl border border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2 text-[11px] text-[var(--text,#1F1E1B)]">
                  {selectedDay ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Viewing {selectedDay.label}</span>
                      <button type="button" onClick={onClearDateFilter} className="text-[11px] font-medium text-[var(--river-500,#6B7C7A)] hover:underline">
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className="text-[var(--text-muted,#6B645B)]">No date filter applied</span>
                  )}
                </div>
                <div className="flex-1 min-h-0 pr-1">{renderTree()}</div>
              </div>
            </InspectorSection>
            <InspectorSection
              id={LEFT_FOLDER_SECTION_ID}
              ref={folderSectionRef}
              icon={<FolderIcon className="h-4 w-4" aria-hidden="true" />}
              label="Folders"
              open={folderSectionOpen}
              onToggle={() => setFolderSectionOpen((open) => !open)}
            >
              <div className="space-y-3 text-left text-[12px] text-[var(--text,#1F1E1B)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Destination</span>
                  <span className="rounded-full border border-[var(--border,#EDE1C6)] px-2 py-0.5 text-[11px]">YYYY/MM/DD</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                  Imports create folders per capture date. Switch to a custom folder inside the Import flow if you prefer a different structure.
                </p>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] text-[var(--text-muted,#6B645B)]">Total photos</dt>
                    <dd className="text-base font-semibold text-[var(--text,#1F1E1B)]">{totalPhotos}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-[var(--text-muted,#6B645B)]">Years tracked</dt>
                    <dd className="text-base font-semibold text-[var(--text,#1F1E1B)]">{dateTree.length}</dd>
                  </div>
                </dl>
              </div>
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
            <LeftRail
              onExpand={onExpand}
              onOverview={() => handleRailSelect('overview')}
              onImport={() => handleRailSelect('import')}
              onDate={() => handleRailSelect('date')}
              onFolder={() => handleRailSelect('folder')}
              onSettings={() => handleRailSelect('folder')}
              overviewExpanded={overviewSectionOpen}
              importExpanded={importSectionOpen}
              dateExpanded={dateSectionOpen}
              folderExpanded={folderSectionOpen}
              hasDateFilter={Boolean(selectedDayKey)}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

function LeftRail({
  onExpand,
  onOverview,
  onImport,
  onDate,
  onFolder,
  onSettings,
  overviewExpanded,
  importExpanded,
  dateExpanded,
  folderExpanded,
  hasDateFilter,
}: {
  onExpand: () => void
  onOverview: () => void
  onImport: () => void
  onDate: () => void
  onFolder: () => void
  onSettings?: () => void
  overviewExpanded: boolean
  importExpanded: boolean
  dateExpanded: boolean
  folderExpanded: boolean
  hasDateFilter: boolean
}) {
  return (
    <div
      role="toolbar"
      aria-label="Project Overview panel rail"
      className="pointer-events-auto flex h-full w-full flex-col items-center rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-1 py-3 shadow-[0_20px_40px_rgba(31,30,27,0.18)]"
    >
      <div className="flex flex-col items-center gap-2">
        <InspectorRailButton icon={<ChevronRightIcon className="h-4 w-4" aria-hidden="true" />} label="Expand Project Overview panel" onClick={onExpand} />
        <RailDivider />
      </div>
      <div className="mt-3 flex flex-1 flex-col items-center gap-2">
        <InspectorRailButton
          icon={<LayoutListIcon className="h-4 w-4" aria-hidden="true" />}
          label="Project Overview"
          onClick={onOverview}
          ariaControls={LEFT_OVERVIEW_SECTION_ID}
          ariaExpanded={overviewExpanded}
        />
        <InspectorRailButton
          icon={<ImportIcon className="h-4 w-4" aria-hidden="true" />}
          label="Import"
          onClick={onImport}
          ariaControls={LEFT_IMPORT_SECTION_ID}
          ariaExpanded={importExpanded}
        />
        <InspectorRailButton
          icon={<CalendarIcon className="h-4 w-4" aria-hidden="true" />}
          label="Date"
          onClick={onDate}
          ariaControls={LEFT_DATE_SECTION_ID}
          ariaExpanded={dateExpanded}
          isActive={hasDateFilter}
        />
        <InspectorRailButton
          icon={<FolderIcon className="h-4 w-4" aria-hidden="true" />}
          label="Folders"
          onClick={onFolder}
          ariaControls={LEFT_FOLDER_SECTION_ID}
          ariaExpanded={folderExpanded}
        />
      </div>
      <div className="mt-auto flex flex-col items-center gap-2">
        <RailDivider />
        <InspectorRailButton
          icon={<SettingsIcon className="h-4 w-4" aria-hidden="true" />}
          label="Import settings"
          onClick={onSettings ?? onFolder}
        />
      </div>
    </div>
  )
}

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
  const [pendingTarget, setPendingTarget] = useState<RightPanelTarget | null>(null)
  const generalFields = keyMetadataSections?.general ?? []
  const captureFields = keyMetadataSections?.capture ?? []
  const metadataGroups = useMemo(() => groupMetadataEntries(metadataEntries), [metadataEntries])
  const metadataRows = useMemo(() => {
    if (!metadataGroups.length) return []
    return metadataGroups.flatMap((group) =>
      group.entries.map((entry) => ({
        label: entry.label,
        value: formatMetadataEntryValue(entry.value),
      })),
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
    if (collapsed || !pendingTarget) return
    ensureSectionOpen(pendingTarget)
    scrollToTarget(pendingTarget)
    setPendingTarget(null)
  }, [collapsed, ensureSectionOpen, pendingTarget, scrollToTarget])

  const handleRailSelect = useCallback(
    (target: RightPanelTarget) => {
      ensureSectionOpen(target)
      if (collapsed) {
        setPendingTarget(target)
        onExpand()
        return
      }
      scrollToTarget(target)
    },
    [collapsed, ensureSectionOpen, onExpand, scrollToTarget],
  )

  return (
    <aside
      id={RIGHT_PANEL_ID}
      role="complementary"
      aria-label="Image Details panel"
      className={`relative h-full min-h-0 ${isMobilePanel ? 'px-3 py-4' : 'px-2 py-4'}`}
      data-state={collapsedState ? 'collapsed' : 'expanded'}
    >
      <div
        data-panel="body"
        aria-hidden={collapsedState}
        className={`h-full min-h-0 ${isMobilePanel ? '' : `transition-opacity duration-150 ${collapsedState ? 'pointer-events-none opacity-0' : 'opacity-100'}`}`}
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
                <span className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Image Details</span>
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
                <p className="text-sm text-[var(--text-muted,#6B645B)]">Select a photo from the gallery to inspect its details.</p>
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
                <p className="text-sm text-[var(--text-muted,#6B645B)]">Select a photo to see where it is used.</p>
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
              {metadataLoading ? <p className="text-xs text-[var(--text-muted,#6B645B)]">Loading metadata…</p> : null}
              {metadataError ? <p className="text-xs text-[#B42318]">{metadataError}</p> : null}
              {metadataWarnings.length ? (
                <ul className="space-y-1 rounded-[12px] border border-[#F59E0B]/40 bg-[#FFF7ED] px-3 py-2 text-[11px] text-[#B45309]">
                  {metadataWarnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#F59E0B] text-[10px]">!</span>
                      <span className="flex-1 break-words">{warning}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hasSelection ? (
                metadataRows.length ? (
                  <KeyDataGrid rows={metadataRows} />
                ) : (
                  <p className="text-sm text-[var(--text-muted,#6B645B)]">No metadata available for this asset.</p>
                )
              ) : (
                <p className="text-sm text-[var(--text-muted,#6B645B)]">Select a photo to review metadata.</p>
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

  const previewMessage = hasSelection ? 'Preview unavailable for this asset.' : 'Select a photo to see it here.'

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!hasSelection) return
      event.preventDefault()
      if (event.deltaY < 0) onZoomIn()
      else onZoomOut()
    },
    [hasSelection, onZoomIn, onZoomOut],
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
    [hasSelection, onPanPreview, viewport],
  )

  const handlePreviewPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!preview || !viewport || !onPanPreview || !hasSelection) return
      event.preventDefault()
      previewDragRef.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      const bounds = event.currentTarget.getBoundingClientRect()
      emitPanFromRelative((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height)
    },
    [emitPanFromRelative, hasSelection, onPanPreview, preview, viewport],
  )

  const handlePreviewPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (previewDragRef.current !== event.pointerId) return
      if (!preview || !viewport || !onPanPreview || !hasSelection) return
      event.preventDefault()
      const bounds = event.currentTarget.getBoundingClientRect()
      emitPanFromRelative((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height)
    },
    [emitPanFromRelative, hasSelection, onPanPreview, preview, viewport],
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
          <span className="ml-auto text-xs font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">{zoomPercent}</span>
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
                  <img src={imageSrc} alt={preview.alt} className="max-h-full max-w-full object-contain" />
                ) : (
                  <RawPlaceholder ratio={preview.placeholderRatio} title={preview.alt} fit="contain" />
                )
              ) : (
                <p className="px-4 text-center text-sm text-[var(--text-muted,#6B645B)]">{previewMessage}</p>
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

function InspectorPreviewControlButton({ label, icon, onClick, disabled }: InspectorPreviewControlButtonProps) {
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

const InspectorSection = React.forwardRef<HTMLDivElement | null, InspectorSectionProps>(function InspectorSection(
  { id, icon, label, open, onToggle, children, grow = false },
  ref,
) {
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
        <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">{open ? 'Hide' : 'Show'}</span>
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
})

type ProjectOverviewDetailsProps = {
  data: ProjectOverviewData
  onRename: (next: string) => Promise<void> | void
  renamePending?: boolean
  renameError?: string | null
  onUpdate: (patch: { note?: string | null; client?: string | null; tags?: string[] }) => Promise<void> | void
  updatePending?: boolean
  updateError?: string | null
}

function ProjectOverviewDetails({ data, onRename, renamePending, renameError, onUpdate, updatePending, updateError }: ProjectOverviewDetailsProps) {
  const [name, setName] = useState(data.title)
  const [description, setDescription] = useState(data.description ?? '')
  const [client, setClient] = useState(data.client ?? '')
  const [tags, setTags] = useState<string[]>(data.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')

  useEffect(() => setName(data.title), [data.title])
  useEffect(() => setDescription(data.description ?? ''), [data.description])
  useEffect(() => setClient(data.client ?? ''), [data.client])
  useEffect(() => setTags(data.tags ?? []), [data.tags])

  const commitName = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(data.title)
      return
    }
    if (trimmed === data.title) return
    void onRename(trimmed)
  }, [name, data.title, onRename])

  const handleNameBlur = useCallback(() => {
    if (renamePending) return
    commitName()
  }, [commitName, renamePending])

  const handleNameKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitName()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setName(data.title)
      }
    },
    [commitName, data.title],
  )

  const commitDescription = useCallback(() => {
    const normalized = description.trim()
    const baseline = data.description ?? ''
    if (normalized === baseline) return
    void onUpdate({ note: normalized ? normalized : null })
  }, [description, data.description, onUpdate])

  const commitClient = useCallback(() => {
    const normalized = client.trim()
    const baseline = data.client ?? ''
    if (normalized === baseline) return
    void onUpdate({ client: normalized || null })
  }, [client, data.client, onUpdate])

  const handleDescriptionBlur = useCallback(() => {
    if (updatePending) return
    commitDescription()
  }, [commitDescription, updatePending])

  const handleClientBlur = useCallback(() => {
    if (updatePending) return
    commitClient()
  }, [commitClient, updatePending])

  const handleAddTag = useCallback(() => {
    if (updatePending) return
    const trimmed = tagDraft.trim()
    if (!trimmed) return
    if (tags.includes(trimmed)) {
      setTagDraft('')
      return
    }
    const nextTags = [...tags, trimmed]
    setTags(nextTags)
    setTagDraft('')
    void onUpdate({ tags: nextTags })
  }, [tagDraft, tags, onUpdate, updatePending])

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (updatePending) return
      if (!tags.includes(tag)) return
      const nextTags = tags.filter((t) => t !== tag)
      setTags(nextTags)
      void onUpdate({ tags: nextTags })
    },
    [tags, onUpdate, updatePending],
  )

  const createdLabel = useMemo(() => {
    if (!data.createdAt) return '—'
    const parsed = new Date(data.createdAt)
    if (Number.isNaN(parsed.getTime())) return '—'
    return PROJECT_DATE_FORMAT ? PROJECT_DATE_FORMAT.format(parsed) : parsed.toLocaleDateString()
  }, [data.createdAt])

  return (
    <div className="space-y-4 text-sm">
      <label className="block text-xs text-[var(--text-muted,#6B645B)]">
        Project name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          disabled={renamePending}
          className="mt-1 w-full rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm font-semibold text-[var(--text,#1F1E1B)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)]"
        />
        {renameError ? <span className="mt-1 block text-[11px] text-[#B42318]">{renameError}</span> : null}
      </label>
      <label className="block text-xs text-[var(--text-muted,#6B645B)]">
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={handleDescriptionBlur}
          disabled={updatePending}
          rows={2}
          className="mt-1 w-full rounded-[16px] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm text-[var(--text,#1F1E1B)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)]"
        />
      </label>
      <label className="block text-xs text-[var(--text-muted,#6B645B)]">
        Client
        <input
          value={client}
          onChange={(event) => setClient(event.target.value)}
          onBlur={handleClientBlur}
          disabled={updatePending}
          className="mt-1 w-full rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm text-[var(--text,#1F1E1B)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)]"
        />
      </label>
      <div>
        <p className="text-xs text-[var(--text-muted,#6B645B)]">Tags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.length ? (
            tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={updatePending}
                aria-label={`Remove tag ${tag}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 py-0.5 text-[11px] text-[var(--text,#1F1E1B)] transition hover:border-[var(--text,#1F1E1B)]"
              >
                <span>{tag}</span>
                <span aria-hidden="true">✕</span>
              </button>
            ))
          ) : (
            <span className="text-[12px] text-[var(--text-muted,#6B645B)]">No tags</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleAddTag()
              }
            }}
            disabled={updatePending}
            placeholder="Add tag"
            className="h-9 flex-1 rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] text-[var(--text,#1F1E1B)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)]"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={updatePending}
            className="inline-flex h-9 items-center rounded-full border border-[var(--border,#EDE1C6)] px-4 text-[12px] font-semibold text-[var(--text,#1F1E1B)]"
          >
            Add
          </button>
        </div>
      </div>
      <div className="grid gap-2 rounded-[18px] border border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] p-3 text-[12px] text-[var(--text-muted,#6B645B)] sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Total images</p>
          <p className="mt-1 text-base font-semibold text-[var(--text,#1F1E1B)]">{data.assetCount}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide">Created</p>
          <p className="mt-1 text-sm text-[var(--text,#1F1E1B)]">{createdLabel}</p>
        </div>
      </div>
      {updateError ? <p className="text-[11px] text-[#B42318]">{updateError}</p> : null}
    </div>
  )
}

type KeyDataRow = { label: string; value: React.ReactNode }

function KeyDataGrid({ rows }: { rows: KeyDataRow[] }) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-4 text-sm">
          <dt className="w-32 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            {row.label}
          </dt>
          <dd className="flex-1 text-right text-sm font-semibold text-[var(--text,#1F1E1B)]">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ColorLabelValue({ value }: { value: ColorTag }) {
  const swatch = COLOR_MAP[value] ?? COLOR_MAP.None
  return (
    <span className="inline-flex w-full items-center justify-end gap-2 text-right">
      <span className="h-3 w-3 rounded-full border border-[var(--border,#EDE1C6)]" style={{ backgroundColor: swatch }} />
      {value}
    </span>
  )
}

function formatRatingValue(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 'Unrated'
  return `${value} / 5`
}

function InspectorRail({ onExpand, onKeyData, onProjects, onMetadata }: {
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
        <InspectorRailButton icon={<ChevronLeftIcon className="h-4 w-4" />} label="Expand Image Details panel" onClick={onExpand} />
        <RailDivider />
      </div>
      <div className="mt-3 flex flex-1 flex-col items-center gap-2">
        <InspectorRailButton icon={<InfoIcon className="h-4 w-4" />} label="Key data" onClick={onKeyData} />
        <InspectorRailButton icon={<FolderIcon className="h-4 w-4" />} label="Projects" onClick={onProjects} />
        <InspectorRailButton icon={<CameraIcon className="h-4 w-4" />} label="Metadata" onClick={onMetadata} />
        <InspectorRailButton icon={<CalendarClockIcon className="h-4 w-4" />} label="Dates" onClick={onMetadata} />
      </div>
      <div className="mt-auto flex flex-col items-center gap-2">
        <RailDivider />
        <InspectorRailButton icon={<SettingsIcon className="h-4 w-4" />} label="Image Details settings" onClick={onMetadata} />
      </div>
    </div>
  )
}

function InspectorRailButton({
  icon,
  label,
  onClick,
  ariaControls,
  ariaExpanded,
  isActive = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  ariaControls?: string
  ariaExpanded?: boolean
  isActive?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-transparent text-[var(--text,#1F1E1B)] transition hover:bg-[var(--surface-subtle,#FBF7EF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${
        isActive ? 'border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)]' : ''
      }`}
    >
      {icon}
    </button>
  )
}

function RailDivider() {
  return <div className="h-px w-8 rounded-full bg-[var(--border,#EDE1C6)]" aria-hidden="true" />
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
  const activeProject = metadataSourceId === CURRENT_CONFIG_SOURCE_ID ? null : projects.find((project) => project.id === metadataSourceId) ?? null
  const activeTitle =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID ? 'Current configuration' : activeProject?.name ?? 'Project unavailable'
  const activeSubtitle =
    metadataSourceId === CURRENT_CONFIG_SOURCE_ID ? "This image's own settings." : activeProject?.lastUpdatedLabel ?? 'Last updated —'
  const activePreview = metadataSourceId === CURRENT_CONFIG_SOURCE_ID ? null : activeProject?.previewImageUrl ?? null
  const activeFallback = metadataSourceId === CURRENT_CONFIG_SOURCE_ID ? 'CFG' : projectInitials(activeProject?.name ?? '')

  const handleSelect = (nextId: MetadataSourceId) => {
    if (metadataSourceBusy || metadataSourceId === nextId) return
    onChangeMetadataSource(nextId)
  }

  return (
    <div className="space-y-4 text-[var(--text,#1F1E1B)]">
      <div>
        <h3 className="text-sm font-semibold">Metadata source</h3>
        <p className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
          Select which configuration should provide the metadata for this image. Switching sources is non-destructive and you can
          always return to the current configuration.
        </p>
        {actionError ? <p className="mt-2 text-xs text-[#B42318]">{actionError}</p> : null}
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Active source</div>
        <ActiveSourceSummaryCard title={activeTitle} subtitle={activeSubtitle} previewImageUrl={activePreview} fallbackLabel={activeFallback} />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Available sources</div>
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
            <p className="text-sm text-[var(--text-muted,#6B645B)]">No other projects use this image.</p>
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
        selected ? 'border-[var(--river-400,#69A3AE)] bg-[var(--river-50,#F0F7F6)]' : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] hover:border-[var(--text,#1F1E1B)]'
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

function MetadataSourceThumbnail({ previewImageUrl, fallbackLabel }: { previewImageUrl: string | null; fallbackLabel: string }) {
  if (previewImageUrl) {
    return <img src={previewImageUrl} alt="" className="h-9 w-9 rounded-[8px] object-cover" loading="lazy" />
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] text-[11px] font-semibold uppercase text-[var(--text,#1F1E1B)]">
      {fallbackLabel || '—'}
    </div>
  )
}

function InspectorBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'danger' }) {
  const tones: Record<string, string> = {
    neutral: 'border border-[var(--border,#EDE1C6)] text-[var(--text-muted,#6B645B)]',
    primary: 'bg-[var(--river-100,#E3F2F4)] text-[var(--river-700,#2F5F62)]',
    success: 'bg-[#ECFDF3] text-[#027A48]',
    danger: 'bg-[#FEF3F2] text-[#B42318]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone] || tones.neutral}`}>
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
  return METADATA_GROUP_ORDER
    .map((category) => ({
      id: category.id,
      label: category.label,
      entries: buckets[category.id].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .filter((group) => group.entries.length > 0)
}

function categorizeMetadataKey(normalizedKey: string): MetadataCategory {
  const key = normalizedKey.split(':').pop() ?? normalizedKey
  if (key.includes('lens')) return 'lens'
  if (key.includes('camera') || key.includes('model') || key.includes('body')) return 'camera'
  if (key.includes('exposure') || key.includes('aperture') || key.includes('shutter') || key.includes('iso') || key.includes('speed')) return 'exposure'
  if (key.includes('gps') || key.includes('latitude') || key.includes('longitude') || key.includes('location')) return 'gps'
  if (key.includes('software') || key.includes('firmware') || key.includes('application') || key.includes('program') || key.includes('version')) return 'software'
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

function ChevronLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 3 5 8l5 5" />
    </svg>
  )
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 3 5 5-5 5" />
    </svg>
  )
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7v4" />
      <path d="M8 5.25h.01" />
    </svg>
  )
}

function LayoutListIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="2" />
      <path d="M5 6.5h6M5 9.5h6M5 12.5h3" />
    </svg>
  )
}

function PreviewIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="2" />
      <path d="M4.5 10.5 6.5 8l2 2.5 1.5-1.5L12 12" />
      <circle cx="6" cy="6.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 5.5h10a1.5 1.5 0 0 1 1.5 1.5v4.5A1.5 1.5 0 0 1 13 13h-10A1.5 1.5 0 0 1 1.5 11.5V7a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M5.5 5.5 6.8 3.8a1 1 0 0 1 .8-.3h0.8a1 1 0 0 1 .8.3l1.3 1.7" />
      <circle cx="8" cy="9" r="2" />
    </svg>
  )
}

function CalendarClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2v2m8-2v2m-9 2h10" />
      <rect x="2.5" y="3" width="11" height="10" rx="2" />
      <circle cx="10.5" cy="10" r="2.25" />
      <path d="M10.5 8.75V10l.8.8" />
    </svg>
  )
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

function MinusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 8h10" />
    </svg>
  )
}

function FrameIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 3H3v2" />
      <path d="M11 3h2v2" />
      <path d="M5 13H3v-2" />
      <path d="M11 13h2v-2" />
    </svg>
  )
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2v2m8-2v2m-9 2h10m-11 6V4.8A1.8 1.8 0 0 1 3.8 3h8.4A1.8 1.8 0 0 1 14 4.8V12a1.8 1.8 0 0 1-1.8 1.8H3.8A1.8 1.8 0 0 1 2 12Z" />
    </svg>
  )
}

function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 4.5h4l1.5 2h5.5v5A1.5 1.5 0 0 1 12 13h-9A1.5 1.5 0 0 1 1.5 11.5v-6A1 1 0 0 1 2.5 4.5Z" />
    </svg>
  )
}

function InspectorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="6.5" cy="6.5" r="3.5" />
      <path d="m10 10 3 3" />
    </svg>
  )
}

function ImportIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.25 9.5h9.5a1.25 1.25 0 0 1 1.25 1.25V12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-1.25A1.25 1.25 0 0 1 3.25 9.5Z" />
      <path d="M8 2v6.5" />
      <path d="m5.75 6.25 2.25 2.25 2.25-2.25" />
    </svg>
  )
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.5 8.5 6.7 11.5 12.5 4.5" />
    </svg>
  )
}

function FilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5h12" />
      <path d="M6.5 10h7" />
      <path d="M9 15h2" />
      <circle cx="8" cy="10" r="1.5" />
      <circle cx="12" cy="15" r="1.5" />
    </svg>
  )
}

function ShortcutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" />
    </svg>
  )
}

function ExportIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 13V4" />
      <path d="m6.5 7.5 3.5-3.5 3.5 3.5" />
      <path d="M4 12.5v3A1.5 1.5 0 0 0 5.5 17h9A1.5 1.5 0 0 0 16 15.5v-3" />
    </svg>
  )
}

function StackIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4.5" y="5" width="11" height="6" rx="1.2" />
      <rect x="6" y="9" width="11" height="6" rx="1.2" />
    </svg>
  )
}

export function GridView({
  items,
  size,
  gap = 12,
  containerWidth,
  onOpen,
  onSelect,
  selectedIds,
}: {
  items: Photo[]
  size: number
  gap?: number
  containerWidth: number
  onOpen: (idx: number) => void
  onSelect?: (idx: number, options?: GridSelectOptions) => void
  selectedIds?: Set<string>
}) {
  const cols = computeCols(containerWidth, size, gap)
  const twoLine = cols >= 4
  const template = `repeat(auto-fill, minmax(${size}px, 1fr))`
  return (
    <div className="p-3 grid" style={{ gridTemplateColumns: template, gap }}>
      {items.map((p, idx) => (
        <div
          key={p.id}
          className={`group border bg-[var(--surface,#FFFFFF)] flex flex-col transition-shadow ${
            selectedIds?.has(p.id) ? 'border-[var(--charcoal-800,#1F1E1B)] shadow-[0_0_0_1px_var(--charcoal-800,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'
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
                <RawPlaceholder ratio={p.placeholderRatio} title={p.name || 'Placeholder image'} fit="contain" />
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

  const rootClass = ['grid', 'h-full', 'w-full', 'min-h-0', 'min-w-0', className].filter(Boolean).join(' ')
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
  const dragStateRef = useRef<{ pointerId: number | null; lastX: number; lastY: number } | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const clampZoomValue = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return minZoom
      return Math.min(maxZoom, Math.max(minZoom, value))
    },
    [minZoom, maxZoom],
  )

  const zoomValue = useMemo(() => {
    return clampZoomValue(zoom)
  }, [zoom, clampZoomValue])

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
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && parts[1] !== 0) {
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
    [maxOffsetX, maxOffsetY],
  )

  const clampPanState = useCallback(
    (next: { x: number; y: number }) => ({
      x: clampPanValue(next.x, 'x'),
      y: clampPanValue(next.y, 'y'),
    }),
    [clampPanValue],
  )

  useEffect(() => {
    setPan((prev) => clampPanState(prev))
  }, [clampPanState])

  useEffect(() => {
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

    setPan({
      x: computePanFromNormalized(targetX, 'x'),
      y: computePanFromNormalized(targetY, 'y'),
    })
  }, [
    clampPanValue,
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
      dragStateRef.current = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY }
      setIsDragging(true)
    },
    [zoomValue],
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
    [clampPanState],
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
    [clampZoomValue, cur, onZoomChange, zoomStep, zoomValue],
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
        <RawPlaceholder ratio={cur.placeholderRatio} title={cur.name || 'Placeholder image'} fit="contain" />
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
  }, [containerSize.height, containerSize.width, cur, onViewportChange, pan.x, pan.y, scaledHeight, scaledWidth])

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

  return (
    <div className={rootClass} style={{ gridTemplateRows: `minmax(0,1fr) ${STRIP_H}px` }}>
      <div className="relative min-h-0 min-w-0 overflow-hidden">
        {cur ? (
          <>
            <div className="absolute inset-0 bg-[var(--placeholder-bg-beige,#F3EBDD)] p-6">
              <div ref={viewerRef} className="relative h-full w-full overflow-hidden rounded-[var(--r-lg,20px)]">
                <div
                  className="absolute inset-0"
                  style={{ cursor: interactionCursor }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endPointerInteraction}
                  onPointerLeave={endPointerInteraction}
                  onPointerCancel={endPointerInteraction}
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
            <RawPlaceholderFrame ratio="16x9" className="w-[380px] h-[240px] rounded-xl border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
          </div>
        )}
      </div>

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
              <RawPlaceholderFrame ratio="3x2" className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
            </div>
          ) : (
            <div className="flex min-w-0 items-end gap-6 pr-6">
              {items.map((p, i) => (
                <div key={p.id} className="flex shrink-0 w-[96px] max-w-[96px] flex-col items-stretch text-[10px] leading-tight">
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
                    className={`relative overflow-hidden rounded border focus:outline-none focus:ring-2 focus:ring-[var(--sand-200,#EDE1C6)] ${
                      selectedIds?.has(p.id)
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
                        <img src={p.thumbSrc} alt={p.name} className="h-full w-full object-contain" />
                      ) : (
                        <RawPlaceholder ratio={p.placeholderRatio} title={p.name || 'Placeholder image'} fit="contain" />
                      )}
                    </div>
                  </button>
                  <div className="mt-1 truncate text-center font-medium text-[var(--text,#1F1E1B)]">{p.name}</div>
                  <div className="mt-1 rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-1 py-0.5">
                    <div className="flex flex-col gap-0.5 text-[9px]">
                      <span className="flex items-center justify-between gap-1">
                        <span className="font-medium">Rating</span>
                        <span>{p.rating}★</span>
                      </span>
                      <span className="flex items-center justify-between gap-1">
                        <span className="font-medium">Color</span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: COLOR_MAP[p.tag] }} aria-hidden />
                          <span className="truncate">{p.tag}</span>
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-1">
                        <span className="font-medium">Status</span>
                        <span className={p.rejected ? 'text-[#B91C1C]' : p.picked ? 'text-[#166534]' : 'text-[var(--text-muted,#6B645B)]'}>
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
    </div>
  )
}

// ----- Overlays, Filters, etc. -----
export function ThumbContent({ p }: { p: Photo }) {
  return (
    <div className="pointer-events-none absolute top-1 left-1 flex items-center gap-1 text-[10px]">
      <span className="px-1 py-0.5 rounded border border-[var(--border,#E1D3B9)] bg-[var(--surface-frosted,#F8F0E4)]">{p.displayType ?? p.type}</span>
      <span className="w-2.5 h-2.5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: COLOR_MAP[p.tag] }} aria-hidden />
    </div>
  )
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'muted' | 'accent'
type BadgeConfig = { label: string; tone: BadgeTone; icon?: string; ariaLabel: string }

const BADGE_TONE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-[var(--success,#34B37A)] text-white',
  warning: 'bg-[var(--warning,#E4AD07)] text-[var(--text,#1F1E1B)]',
  danger: 'bg-[var(--danger,#C73A37)] text-white',
  muted: 'bg-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)]',
  accent: 'bg-[var(--accent,#D7C5A6)] text-[var(--on-accent,#3A2F23)]',
}

function Badge({ label, tone = 'muted', icon, ariaLabel }: { label: string; tone?: BadgeTone; icon?: string; ariaLabel?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold tracking-wide ${BADGE_TONE_STYLES[tone]}`}
      aria-label={ariaLabel ?? label}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span className="leading-none">{label}</span>
    </span>
  )
}

export function ThumbOverlay({ p, twoLine }: { p: Photo; twoLine?: boolean }) {
  // leben via DOM-Custom-Events (gleiche Mechanik wie im Monolith)
  const emit = (name: 'rate' | 'pick' | 'reject' | 'color', detail: any) => {
    const ev = new CustomEvent(name, { detail }); window.dispatchEvent(ev)
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
        return { label: 'Processing', tone: 'warning', icon: '⏳', ariaLabel: `Status: ${p.status}` }
    }
  })()

  return (
    <div className="border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-[11px]">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[12px] font-semibold text-[var(--text,#1F1E1B)] truncate">{p.name}</span>
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
            <button className={`px-1 border rounded ${p.picked ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('pick', { id: p.id })} title="Pick (P)">P</button>
            <button className={`px-1 border rounded ${p.rejected ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('reject', { id: p.id })} title="Reject (X)">X</button>
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
            <button className={`px-1 border rounded ${p.picked ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('pick', { id: p.id })} title="Pick (P)">P</button>
            <button className={`px-1 border rounded ${p.rejected ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('reject', { id: p.id })} title="Reject (X)">X</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function StarRow({ value, onChange }: { value: number; onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void }) {
  const stars = [1, 2, 3, 4, 5] as const
  return (
    <div className="inline-flex items-center gap-1">
      {stars.map((s) => (
        <button key={s} className={`px-1 py-0.5 border rounded ${value >= s ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'}`} onClick={() => onChange(s)} aria-label={`Rate ${s} stars`}>
          ★
        </button>
      ))}
    </div>
  )
}

export function ColorSwatch({ value, onPick }: { value: ColorTag; onPick: (t: ColorTag) => void }) {
  const map: Record<ColorTag, string> = { None: '#E5E7EB', Red: '#F87171', Green: '#34D399', Blue: '#60A5FA', Yellow: '#FBBF24', Purple: '#C084FC' }
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button aria-label={`Color ${value}`} title={`Color ${value}`} className="w-5 h-5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: map[value] }} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="absolute right-0 z-10 mt-1 min-w-[140px] rounded border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 shadow">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(map) as ColorTag[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-label={k}
                title={k}
                className="w-6 h-6 rounded-full border border-[var(--border,#E1D3B9)]"
                style={{ backgroundColor: map[k] }}
                onClick={() => {
                  onPick(k)
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function EmptyState() {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-4 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <RawPlaceholderFrame ratio="3x2" className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
        <div className="text-base font-semibold">Start your project</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">
          Use the Import side panel to add your first photos. That is now the single entry point for importing, and it will auto-organize files by date (YYYY/MM/DD) unless you switch to a custom folder name inside the Import flow.
        </div>
      </div>
    </div>
  )
}

export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <div className="text-base font-semibold">No matches</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">Your filters hide all photos. Try lowering the minimum rating or clearing the color/type filters.</div>
        <button onClick={onReset} className="mt-1 px-3 py-2 rounded-md border border-[var(--border,#E1D3B9)] text-xs">Reset filters</button>
      </div>
    </div>
  )
}
