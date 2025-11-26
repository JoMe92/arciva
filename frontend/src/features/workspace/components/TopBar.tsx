import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react'
import { ChevronLeftIcon, FilterIcon, StackIcon } from './icons'
import ProjectSettingsButton from '../../../components/ProjectSettingsButton'
import StoneTrailLogo from '../../../components/StoneTrailLogo'
import { useTheme } from '../../../shared/theme'
import { WorkspaceFilterControls, ColorTag } from '../types'
import { OverlayDialog, CountBadge } from './Common'

const SHORTCUTS_LEGEND_ID = 'shortcuts-legend'
const FILTERS_DIALOG_ID = 'workspace-filters-dialog'

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
  accountControl,
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
  accountControl?: React.ReactNode
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleTitleKey = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commitRename()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelEditing()
      }
    },
    [cancelEditing, commitRename]
  )

  const handleBlur = useCallback(() => {
    if (renamePending) return
    void commitRename()
  }, [commitRename, renamePending])

  const filterLabel = useMemo(() => {
    if (filterCount === 0) return 'Filters'
    return `Filters · ${filterCount}`
  }, [filterCount])

  const viewButtonClasses = (mode: 'grid' | 'detail') =>
    `inline-flex h-9 w-[88px] items-center justify-center text-[12px] font-medium transition-colors ${view === mode
      ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)]'
      : 'text-[var(--text-muted,#6B645B)]'
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
                {renameError ? (
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-[#B42318]">
                    {renameError}
                  </span>
                ) : null}
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
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${filtersOpen ? 'bg-[var(--sand-100,#F3EBDD)]' : 'bg-[var(--surface,#FFFFFF)]'
                }`}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              aria-controls={FILTERS_DIALOG_ID}
              title={filterLabel}
            >
              <FilterIcon className="h-5 w-5" aria-hidden="true" />
              {filterCount ? (
                <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--text,#1F1E1B)] px-1 text-[10px] font-semibold text-[var(--surface,#FFFFFF)]">
                  {filterCount}
                </span>
              ) : null}
              <span className="sr-only">{filterLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleStackPairs(!stackPairsEnabled)}
              disabled={stackTogglePending}
              aria-pressed={stackPairsEnabled}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-[var(--text,#1F1E1B)] transition ${stackPairsEnabled
                ? 'border-[var(--text,#1F1E1B)] bg-[var(--sand-100,#F3EBDD)]'
                : 'border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]'
                } ${stackTogglePending ? 'cursor-not-allowed opacity-60' : ''}`}
              title="Toggle JPEG+RAW stacking"
            >
              <StackIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">
                {stackPairsEnabled ? 'Disable JPEG+RAW stacking' : 'Enable JPEG+RAW stacking'}
              </span>
            </button>
            <ProjectSettingsButton
              onClick={onOpenSettings}
              label="Open application settings"
              title="Application settings"
            />
            {accountControl ? <div className="flex items-center">{accountControl}</div> : null}
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
        {shortcutsOpen ? (
          <ShortcutsDialog onClose={closeShortcuts} anchorRect={shortcutsAnchorRect} />
        ) : null}
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/95 backdrop-blur">
      <div
        className="grid h-16 w-full items-center gap-4"
        style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}
      >
        <div className="flex min-w-0 items-center gap-3 pl-2 sm:pl-4">
          <StoneTrailLogo
            className="hidden lg:inline-flex shrink-0"
            showLabel={false}
            mode={mode}
            onToggleTheme={toggle}
          />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] font-medium text-[var(--text,#1F1E1B)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[var(--text-muted,#6B645B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] md:hidden"
            aria-label="Back to projects"
          >
            ← Projects
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <nav
              className="flex min-w-0 items-center gap-3 text-sm text-[var(--text-muted,#6B645B)]"
              aria-label="Breadcrumb"
            >
              <button
                type="button"
                onClick={onBack}
                className="font-medium text-[var(--text-muted,#6B645B)] transition-colors hover:text-[var(--text,#1F1E1B)]"
              >
                Projects
              </button>
              <span
                aria-hidden="true"
                className="text-base leading-none text-[var(--text-muted,#6B645B)]"
              >
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
                      <span className="absolute -bottom-5 left-0 text-xs text-[#B42318]">
                        {renameError}
                      </span>
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
            <button
              type="button"
              className={`${viewButtonClasses('grid')} border-r border-[var(--border,#E1D3B9)]`}
              onClick={() => onChangeView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={viewButtonClasses('detail')}
              onClick={() => onChangeView('detail')}
            >
              Detail
            </button>
          </div>
          <button
            type="button"
            className={`inline-flex h-9 min-w-[170px] flex-shrink-0 items-center justify-center gap-3 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${stackPairsEnabled
              ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)]'
              : 'text-[var(--text-muted,#6B645B)]'
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
            className={`inline-flex h-9 min-w-[150px] flex-shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 text-[12px] font-semibold text-[var(--text,#1F1E1B)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${canExport
              ? 'hover:bg-[var(--sand-50,#F9F4EC)]'
              : 'text-[var(--text-muted,#6B645B)] cursor-not-allowed opacity-60'
              }`}
            aria-disabled={!canExport}
            title={
              canExport
                ? `Export ${selectedCount} photo${selectedCount === 1 ? '' : 's'}`
                : 'Select at least one photo to enable exporting'
            }
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
              <span className="flex-1 text-right text-[10px] text-[var(--text-muted,#6B645B)]">
                Unavailable in detail view
              </span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-3 px-4 sm:px-6 lg:px-8">
          <ProjectSettingsButton
            onClick={onOpenSettings}
            label="Open application settings"
            title="Application settings"
          />
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
            className={`inline-flex h-9 min-w-[110px] items-center justify-center gap-2 rounded-full border px-4 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${filterCount
              ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]'
              : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
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
            className={`inline-flex h-9 min-w-[130px] items-center justify-center gap-2 rounded-full border px-4 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${shortcutsOpen
              ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]'
              : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
              }`}
            aria-haspopup="dialog"
            aria-expanded={shortcutsOpen}
            aria-controls={SHORTCUTS_LEGEND_ID}
          >
            <span aria-hidden="true">⌨</span>
            <span>Shortcuts</span>
          </button>
          {accountControl ? <div className="flex items-center">{accountControl}</div> : null}
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
      {shortcutsOpen ? (
        <ShortcutsDialog onClose={closeShortcuts} anchorRect={shortcutsAnchorRect} />
      ) : null}
    </header>
  )
}

export function FiltersDialog({
  controls,
  onReset,
  onClose,
  anchorRect,
}: {
  controls: WorkspaceFilterControls
  onReset: () => void
  onClose: () => void
  anchorRect?: DOMRect | null
}) {
  return (
    <OverlayDialog
      id={FILTERS_DIALOG_ID}
      title="Filters"
      onClose={onClose}
      headerAction={
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-[var(--river-500,#6B7C7A)] hover:underline"
        >
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
            <button
              type="button"
              onClick={() => {
                controls.clearDateFilter()
                onClose()
              }}
              className="font-medium text-[var(--river-500,#6B7C7A)] hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            Rating
          </div>
          <MinStarRow value={controls.minStars} onChange={controls.setMinStars} />
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            Color
          </div>
          <ColorFilter value={controls.filterColor} onChange={controls.setFilterColor} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input
              type="checkbox"
              checked={controls.showJPEG}
              onChange={(event) => controls.setShowJPEG(event.target.checked)}
              className="accent-[var(--text,#1F1E1B)]"
            />
            JPEG
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input
              type="checkbox"
              checked={controls.showRAW}
              onChange={(event) => controls.setShowRAW(event.target.checked)}
              className="accent-[var(--text,#1F1E1B)]"
            />
            RAW
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input
              type="checkbox"
              checked={controls.onlyPicked}
              onChange={(event) => controls.setOnlyPicked(event.target.checked)}
              className="accent-[var(--text,#1F1E1B)]"
            />
            Picks only
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
            <input
              type="checkbox"
              checked={controls.hideRejected}
              onChange={(event) => controls.setHideRejected(event.target.checked)}
              className="accent-[var(--text,#1F1E1B)]"
            />
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
  {
    keys: '6 / 7 / 8 / 9 / 0',
    description: 'Apply color labels (Red, Yellow, Green, Blue, Purple)',
  },
  { keys: 'Left / Right arrows', description: 'Move between photos' },
  { keys: 'Alt + [ / ]', description: 'Collapse or expand the date rail' },
]

export function ShortcutsDialog({
  onClose,
  anchorRect,
}: {
  onClose: () => void
  anchorRect?: DOMRect | null
}) {
  return (
    <OverlayDialog
      id={SHORTCUTS_LEGEND_ID}
      title="Keyboard shortcuts"
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      anchorRect={anchorRect}
    >
      <ul className="grid gap-2 text-[11px] sm:grid-cols-2">
        {SHORTCUTS.map((shortcut) => (
          <li
            key={shortcut.keys}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2"
          >
            <span className="font-mono text-[11px] text-[var(--text-muted,#6B645B)]">
              {shortcut.keys}
            </span>
            <span className="text-right text-[var(--text,#1F1E1B)]">{shortcut.description}</span>
          </li>
        ))}
      </ul>
    </OverlayDialog>
  )
}

function MinStarRow({
  value,
  onChange,
}: {
  value: 0 | 1 | 2 | 3 | 4 | 5
  onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void
}) {
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

function ColorFilter({
  value,
  onChange,
}: {
  value: 'Any' | ColorTag
  onChange: (v: 'Any' | ColorTag) => void
}) {
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
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-[var(--text-muted,#6B645B)]">
        ▾
      </span>
    </div>
  )
}
