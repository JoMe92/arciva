import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RawPlaceholder, RawPlaceholderFrame } from '../../components/RawPlaceholder'
import StoneTrailLogo from '../../components/StoneTrailLogo'
import { TOKENS } from './utils'
import type { Photo, ImgType, ColorTag } from './types'

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

export type SidebarMode = 'expanded' | 'slim' | 'hidden'

function setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
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

export function TopBar({
  projectName,
  onBack,
  onRename,
  renamePending,
  renameError,
  onImport,
  view,
  onChangeView,
  gridSize,
  minGridSize,
  onGridSizeChange,
  filters,
  filterCount,
  onResetFilters,
  visibleCount,
  selectedDayLabel,
  loadingAssets,
  loadError,
}: {
  projectName: string
  onBack: () => void
  onRename: (next: string) => Promise<void> | void
  renamePending?: boolean
  renameError?: string | null
  onImport: () => void
  view: 'grid' | 'detail'
  onChangeView: (next: 'grid' | 'detail') => void
  gridSize: number
  minGridSize: number
  onGridSizeChange: (value: number) => void
  filters: WorkspaceFilterControls
  filterCount: number
  onResetFilters: () => void
  visibleCount: number
  selectedDayLabel: string | null
  loadingAssets: boolean
  loadError: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(projectName)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filtersRef = useRef<HTMLDivElement | null>(null)
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const shortcutsButtonRef = useRef<HTMLButtonElement | null>(null)
  const shortcutsLegendRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!filtersOpen) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (filtersRef.current?.contains(target)) return
      if (filtersButtonRef.current?.contains(target)) return
      setFiltersOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [filtersOpen])

  useEffect(() => {
    if (!shortcutsOpen) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (shortcutsLegendRef.current?.contains(target)) return
      if (shortcutsButtonRef.current?.contains(target)) return
      setShortcutsOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShortcutsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [shortcutsOpen])

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
    `inline-flex h-9 items-center px-4 text-[12px] font-medium transition-colors ${
      view === mode ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)]'
    }`

  const photoCountText = `${visibleCount} photos${selectedDayLabel ? ` • ${selectedDayLabel}` : ''}`

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/95 backdrop-blur">
      <div
        className="mx-auto grid h-16 max-w-7xl items-center gap-[var(--s-3)] px-4 sm:px-6 lg:px-8"
        style={{ gridTemplateColumns: 'auto 1fr auto' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <StoneTrailLogo className="hidden lg:inline-flex shrink-0" showLabel={false} />
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] font-medium text-[var(--text,#1F1E1B)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-[var(--text-muted,#6B645B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] md:hidden"
            aria-label="Back to projects"
          >
            ← Projects
          </button>
          <nav className="hidden items-center text-sm text-[var(--text-muted,#6B645B)] md:flex">
            <button type="button" onClick={onBack} className="font-medium text-[var(--text,#1F1E1B)] hover:underline focus:outline-none">
              Projects
            </button>
            <span className="mx-2">›</span>
            <span className="max-w-[180px] truncate font-medium text-[var(--text,#1F1E1B)]" title={projectName}>
              {projectName}
            </span>
          </nav>
        </div>

        <div className="flex flex-1 flex-col items-center text-center">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleTitleKey}
                onBlur={handleBlur}
                disabled={renamePending}
                className="h-11 min-w-[200px] rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-center text-xl font-semibold text-[var(--text,#1F1E1B)] shadow-inner focus:outline-none focus:ring-2 focus:ring-[var(--stone-trail-brand-focus,#4A463F)]"
              />
              <button
                type="button"
                onClick={() => void commitRename()}
                className="h-9 w-9 rounded-full border border-[var(--border,#E1D3B9)] text-sm"
                disabled={renamePending}
                aria-label="Save project name"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="h-9 w-9 rounded-full border border-[var(--border,#E1D3B9)] text-sm"
                disabled={renamePending}
                aria-label="Cancel renaming"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold leading-tight tracking-tight text-[var(--text,#1F1E1B)]"
                onDoubleClick={startEditing}
                title="Double-click to rename"
              >
                {projectName}
              </h1>
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-sm text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]"
                aria-label="Rename project"
              >
                ✎
              </button>
            </div>
          )}
          {renameError ? (
            <p className="mt-1 text-xs text-[#B42318]">{renameError}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-[var(--s-3)] text-[12px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onImport}
              className="inline-flex h-9 items-center rounded-full border border-transparent bg-[var(--charcoal-800,#1F1E1B)] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[var(--charcoal-700,#2B2824)]"
            >
              Import
            </button>
            <div className="inline-flex items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
              <button type="button" className={`${viewButtonClasses('grid')} rounded-l-full`} onClick={() => onChangeView('grid')}>
                Grid
              </button>
              <button type="button" className={`${viewButtonClasses('detail')} rounded-r-full`} onClick={() => onChangeView('detail')}>
                Detail
              </button>
            </div>
            {view === 'grid' ? (
              <label className="hidden items-center gap-2 whitespace-nowrap text-[11px] text-[var(--text-muted,#6B645B)] lg:flex">
                Size
                <input
                  type="range"
                  min={minGridSize}
                  max={240}
                  value={gridSize}
                  onChange={(event) => onGridSizeChange(Number(event.target.value))}
                  aria-label="Thumbnail size"
                />
              </label>
            ) : null}
            <div className="relative">
              <button
                type="button"
                ref={filtersButtonRef}
                onClick={() => setFiltersOpen((open) => !open)}
                className={`inline-flex h-9 items-center rounded-full border px-4 text-[12px] font-medium ${
                  filterCount ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
                }`}
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
              >
                {filterLabel}
              </button>
              {filtersOpen ? (
                <FiltersPopover
                  ref={filtersRef}
                  controls={filters}
                  onReset={() => {
                    onResetFilters()
                    setFiltersOpen(false)
                  }}
                  onClose={() => setFiltersOpen(false)}
                />
              ) : null}
            </div>
            <button
              type="button"
              ref={shortcutsButtonRef}
              onClick={() => setShortcutsOpen((open) => !open)}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-[12px] font-medium ${
                shortcutsOpen ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'
              }`}
              aria-expanded={shortcutsOpen}
              aria-controls={SHORTCUTS_LEGEND_ID}
            >
              ⌨ Shortcuts
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#E1D3B9)] text-lg text-[var(--text-muted,#6B645B)]"
              aria-label="More actions"
            >
              …
            </button>
          </div>
          <div
            data-testid="top-bar-status-slot"
            className="flex flex-col items-end justify-center text-[11px] text-[var(--text-muted,#6B645B)]"
            style={{ minWidth: 200, maxWidth: 220 }}
          >
            <div className="flex items-center gap-2 text-right">
              <span
                className={`transition-opacity duration-200 ${loadingAssets ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                aria-live="polite"
              >
                Syncing…
              </span>
              <span
                className={`transition-opacity duration-200 ${loadError ? 'opacity-100 visible text-[#B42318]' : 'opacity-0 invisible'}`}
                aria-live="polite"
              >
                {loadError}
              </span>
              <span className="transition-opacity duration-200 opacity-100 visible text-[var(--text,#1F1E1B)]" aria-live="polite" title={photoCountText}>
                {photoCountText}
              </span>
            </div>
          </div>
        </div>
      </div>
      {shortcutsOpen && <ShortcutsLegend ref={shortcutsLegendRef} onClose={() => setShortcutsOpen(false)} />}
    </header>
  )
}

const FiltersPopover = React.forwardRef<HTMLDivElement, {
  controls: WorkspaceFilterControls
  onReset: () => void
  onClose: () => void
}>(({ controls, onReset, onClose }, ref) => {
  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-3 w-80 rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 text-[12px] shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold text-[var(--text,#1F1E1B)]">Filters</div>
        <button type="button" onClick={onReset} className="text-[11px] text-[var(--river-500,#6B7C7A)] hover:underline">
          Reset
        </button>
      </div>
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
    </div>
  )
})
FiltersPopover.displayName = 'FiltersPopover'

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'G', description: 'Switch to the grid view' },
  { keys: 'D', description: 'Open detail view' },
  { keys: 'P', description: 'Pick or preview the selection' },
  { keys: 'X', description: 'Reject the selected assets' },
  { keys: '1-5', description: 'Apply a star rating' },
  { keys: 'Left / Right arrows', description: 'Move between photos' },
  { keys: 'Alt + [ / ]', description: 'Collapse or expand the date rail' },
]

const ShortcutsLegend = React.forwardRef<HTMLDivElement, { onClose: () => void }>(({ onClose }, ref) => (
  <div ref={ref} id={SHORTCUTS_LEGEND_ID} role="region" aria-label="Keyboard shortcuts" className="w-full">
    <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:px-8 pb-3 pt-2">
      <div className="rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Keyboard shortcuts</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts legend"
            className="text-sm text-[var(--text-muted,#6B645B)] transition hover:text-[var(--text,#1F1E1B)]"
          >
            ✕
          </button>
        </div>
        <ul className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
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
      </div>
    </div>
  </div>
))
ShortcutsLegend.displayName = 'ShortcutsLegend'

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

const DATE_RAIL_ID = 'date-folders-rail'

export function Sidebar({
  dateTree,
  onOpenImport,
  onSelectDay,
  selectedDayKey,
  selectedDay,
  onClearDateFilter,
  mode,
  onModeChange,
  onCollapse,
  onExpand,
}: {
  dateTree: DateTreeYearNode[]
  onOpenImport: () => void
  onSelectDay: (day: DateTreeDayNode) => void
  selectedDayKey: string | null
  selectedDay: DateTreeDayNode | null
  onClearDateFilter: () => void
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
  onCollapse: () => void
  onExpand: () => void
}) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set())
  const [slimHover, setSlimHover] = useState(false)
  const [peekHover, setPeekHover] = useState(false)
  const slimHoverTimeoutRef = useRef<number | null>(null)
  const peekHoverTimeoutRef = useRef<number | null>(null)

  const clearHoverTimeout = (ref: React.MutableRefObject<number | null>) => {
    if (typeof window === 'undefined') return
    if (ref.current !== null) {
      window.clearTimeout(ref.current)
      ref.current = null
    }
  }

  const scheduleHoverToggle = (ref: React.MutableRefObject<number | null>, setter: React.Dispatch<React.SetStateAction<boolean>>, next: boolean) => {
    clearHoverTimeout(ref)
    if (next) {
      setter(true)
      return
    }
    if (typeof window === 'undefined') {
      setter(false)
      return
    }
    ref.current = window.setTimeout(() => {
      setter(false)
      ref.current = null
    }, 120)
  }

  useEffect(() => {
    return () => {
      clearHoverTimeout(slimHoverTimeoutRef)
      clearHoverTimeout(peekHoverTimeoutRef)
    }
  }, [])

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

  const ensureYearExpanded = useCallback((yearId: string) => {
    setExpandedYears((prev) => {
      if (prev.has(yearId)) return prev
      const next = new Set(prev)
      next.add(yearId)
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
    [dateTree]
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
    [dateTree, focusYearHeaderByIndex, toggleYear]
  )

  const handleSlimYearClick = useCallback(
    (yearId: string) => {
      ensureYearExpanded(yearId)
      onModeChange('expanded')
    },
    [ensureYearExpanded, onModeChange]
  )

  const renderTree = () => {
    if (!dateTree.length) {
      return (
        <div className="rounded-[14px] border border-dashed border-[var(--sand-300,#E1D3B9)] bg-white/40 px-3 py-4 text-center text-[11px] text-[var(--text-muted,#6B645B)]">
          No photos yet. Import to populate your date folders.
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
                  yearExpanded ? 'bg-[var(--surface,#FFFFFF)] shadow-[0_12px_30px_rgba(31,30,27,0.08)]' : 'hover:bg-white/70'
                }`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--sand-300,#E1D3B9)] bg-white text-[11px] text-[var(--text-muted,#6B645B)]">
                  {hasMonths ? (yearExpanded ? '▾' : '▸') : '•'}
                </span>
                <span className="flex-1 truncate text-left text-[var(--text,#1F1E1B)]">{year.label}</span>
                <CountBadge count={year.count} />
              </button>
              {hasMonths && yearExpanded ? (
                <div id={yearPanelId} role="region" aria-labelledby={yearHeaderId} className="mt-2 space-y-1.5 rounded-[12px] border border-[var(--sand-300,#E1D3B9)] bg-white/80 px-2 py-2">
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
                            aria-disabled={!monthHasDays}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] transition ${
                              monthExpanded ? 'bg-white/70 shadow-inner' : 'hover:bg-white/60'
                            }`}
                          >
                            <span className="inline-flex w-4 justify-center text-[11px] text-[var(--text-muted,#6B645B)]">
                              {monthHasDays ? (monthExpanded ? '▾' : '▸') : ''}
                            </span>
                            <span className="flex-1 truncate text-[var(--text,#1F1E1B)]">{month.label}</span>
                            <CountBadge count={month.count} />
                          </button>
                          {monthHasDays && monthExpanded ? (
                            <ul
                              id={monthPanelId}
                              aria-labelledby={monthHeaderId}
                              className="mt-1 space-y-1 pl-5 text-[12px]"
                            >
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
                                          : 'border-transparent text-[var(--text,#1F1E1B)] hover:border-[var(--border,#E1D3B9)] hover:bg-white/70'
                                      }`}
                                    >
                                      <span className="truncate">{day.label}</span>
                                      <CountBadge
                                        count={day.count}
                                        className={isSelected ? 'bg-[var(--surface,#FFFFFF)] text-[var(--on-accent,#3A2F23)]' : ''}
                                      />
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

  const showPeek = mode === 'slim' && (slimHover || peekHover)

  const railCard = (variant: 'inline' | 'overlay' = 'inline') => (
    <div
      className={`flex h-full min-h-0 flex-col gap-3 rounded-[16px] border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-4 ${
        variant === 'overlay' ? 'shadow-[0_22px_40px_rgba(31,30,27,0.25)]' : 'shadow-[0_18px_30px_rgba(31,30,27,0.14)]'
      }`}
    >
      <button
        onClick={onOpenImport}
        className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[var(--charcoal-800,#1F1E1B)] px-4 text-[13px] font-semibold tracking-wide text-white shadow-[0_10px_22px_rgba(31,30,27,0.28)] transition hover:translate-y-[1px]"
      >
        Import photos…
      </button>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-[var(--text,#1F1E1B)]">Date folders</div>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted,#6B645B)]">Alt+[ / Alt+] to toggle</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/70 px-1.5 py-0.5 shadow-inner" role="group" aria-label="Toggle date folders rail">
          <button
            type="button"
            aria-label="Collapse date folders rail (Alt+[)"
            aria-controls={DATE_RAIL_ID}
            aria-expanded={mode !== 'hidden'}
            onClick={onCollapse}
            disabled={mode === 'hidden'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold text-[var(--text,#1F1E1B)] transition hover:bg-white disabled:opacity-50"
          >
            «
          </button>
          <button
            type="button"
            aria-label="Expand date folders rail (Alt+])"
            aria-controls={DATE_RAIL_ID}
            aria-expanded={mode === 'expanded'}
            onClick={onExpand}
            disabled={mode === 'expanded'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold text-[var(--text,#1F1E1B)] transition hover:bg-white disabled:opacity-50"
          >
            »
          </button>
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--sand-300,#E1D3B9)] bg-white/70 px-3 py-2 text-[11px] text-[var(--text,#1F1E1B)]">
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

      <div className="folder-tree flex-1 min-h-0 overflow-y-auto pr-1">{renderTree()}</div>
    </div>
  )

  if (mode === 'hidden') {
    return <aside id={DATE_RAIL_ID} role="complementary" aria-label="Date folders" aria-hidden="true" className="h-full min-h-0" />
  }

  const slimRail = (
    <div
      className="flex h-full flex-col items-center gap-3 rounded-[16px] border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-4 text-[10px] shadow-[0_12px_24px_rgba(31,30,27,0.12)]"
      onMouseEnter={() => scheduleHoverToggle(slimHoverTimeoutRef, setSlimHover, true)}
      onMouseLeave={() => scheduleHoverToggle(slimHoverTimeoutRef, setSlimHover, false)}
    >
      <button
        onClick={onOpenImport}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--charcoal-800,#1F1E1B)] text-[18px] text-white shadow-[0_14px_26px_rgba(31,30,27,0.3)]"
        aria-label="Import photos"
        title="Import photos"
      >
        ＋
      </button>
      <div className="h-px w-9 rounded-full bg-[var(--sand-300,#E1D3B9)]" />
      <div className="flex-1 w-full overflow-y-auto">
        <ul className="flex flex-col items-center gap-2">
          {dateTree.map((year) => {
            const isActive = selectedDay?.parentYearId === year.id
            return (
              <li key={year.id} className="flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => handleSlimYearClick(year.id)}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border text-[11px] font-semibold transition ${
                    isActive ? 'border-[var(--charcoal-800,#1F1E1B)] bg-[var(--sand-50,#FBF7EF)]' : 'border-[var(--sand-200,#E8DFC9)] bg-[var(--surface,#FFFFFF)] hover:border-[var(--sand-500,#D7C5A6)]'
                  }`}
                  aria-label={`Jump to year ${year.label}`}
                >
                  {year.label.slice(-2)}
                  <span className="absolute -top-1.5 -right-1 rounded-full bg-[var(--sand-500,#D7C5A6)] px-1 text-[9px] font-semibold text-[var(--charcoal-800,#1F1E1B)]">
                    {year.count}
                  </span>
                </button>
                <span className="mt-1 w-12 truncate text-[10px] text-[var(--text-muted,#6B645B)]">{year.label}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )

  return (
    <aside
      id={DATE_RAIL_ID}
      role="complementary"
      aria-label="Aufnahmedatum"
      className="relative h-full min-h-0 px-3 py-4 text-xs"
      data-mode={mode}
    >
      {mode === 'expanded' ? railCard() : slimRail}
      {showPeek ? (
        <div
          className="pointer-events-auto absolute inset-y-4 left-[calc(100%+12px)] z-30 w-[296px]"
          onMouseEnter={() => scheduleHoverToggle(peekHoverTimeoutRef, setPeekHover, true)}
          onMouseLeave={() => scheduleHoverToggle(peekHoverTimeoutRef, setPeekHover, false)}
        >
          {railCard('overlay')}
        </div>
      ) : null}
    </aside>
  )
}

// ----- Grid & Detail -----
export function computeCols(containerWidth: number, size: number, gap: number) {
  return Math.max(1, Math.floor((containerWidth + gap) / (size + gap)))
}

export type GridSelectOptions = {
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
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
}: {
  items: Photo[]
  index: number
  setIndex: (n: number) => void
  className?: string
  selectedIds?: Set<string>
  onSelect?: (idx: number, options?: GridSelectOptions) => void
  paginatorRef?: React.Ref<HTMLDivElement>
}) {
  const cur = items[index]
  const canPrev = index > 0
  const canNext = index < items.length - 1
  const STRIP_H = 136
  const THUMB = 96

  const rootClass = ['grid', 'h-full', 'min-h-0', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} style={{ gridTemplateRows: `minmax(0,1fr) ${STRIP_H}px` }}>
      <div className="relative min-h-0 overflow-hidden">
        {cur ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--placeholder-bg-beige,#F3EBDD)] p-6">
              {cur.previewSrc ? (
                <img src={cur.previewSrc} alt={cur.name} className="max-h-full max-w-full object-contain" />
              ) : cur.thumbSrc ? (
                <img src={cur.thumbSrc} alt={cur.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <RawPlaceholder ratio={cur.placeholderRatio} title={cur.name || 'Placeholder image'} fit="contain" />
              )}
            </div>
            <div
              ref={paginatorRef}
              tabIndex={-1}
              aria-label="Image paginator"
              className="absolute left-1/2 bottom-4 z-10 flex items-center gap-3 overflow-visible rounded-full bg-[rgba(31,30,27,0.55)] px-4 py-2 text-[13px] font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
            >
              <button
                type="button"
                disabled={!canPrev}
                aria-label="Previous asset"
                onClick={() => setIndex(Math.max(0, index - 1))}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/30 bg-white/10 px-3 py-2 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] disabled:border-white/20 disabled:bg-white/5"
              >
                <span aria-hidden className="text-[16px] leading-none">
                  ←
                </span>
              </button>
              <span className="text-[13px] font-semibold tracking-wide">
                {index + 1}/{items.length}
              </span>
              <button
                type="button"
                disabled={!canNext}
                aria-label="Next asset"
                onClick={() => setIndex(Math.min(items.length - 1, index + 1))}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/30 bg-white/10 px-3 py-2 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] disabled:border-white/20 disabled:bg-white/5"
              >
                <span aria-hidden className="text-[16px] leading-none">
                  →
                </span>
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <RawPlaceholderFrame ratio="16x9" className="w-[380px] h-[240px] rounded-xl border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
          </div>
        )}
      </div>

      <div className="thumb-strip border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] relative">
        {items.length === 0 ? (
          <div className="h-full grid place-items-center">
            <RawPlaceholderFrame ratio="3x2" className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
          </div>
        ) : (
          <div className="flex items-end gap-6 pr-6">
            {items.map((p, i) => (
              <div key={p.id} className="flex shrink-0 w-[96px] max-w-[96px] flex-col items-stretch text-[10px] leading-tight">
                <button
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
                  className={`relative overflow-hidden rounded border focus:outline-none focus:ring-2 focus:ring-[var(--sand200,#E8DFC9)] ${
                    selectedIds?.has(p.id)
                      ? 'border-[var(--charcoal-800,#1F1E1B)] shadow-[0_0_0_1px_var(--charcoal-800,#1F1E1B)]'
                      : i === index
                        ? 'border-[var(--text,#1F1E1B)]'
                        : 'border-[var(--border,#E1D3B9)]'
                  }`}
                  style={{ width: THUMB, height: THUMB }}
                  aria-label={`View ${p.name}`}
                >
                  <span className="absolute top-1 left-1 rounded bg-white/90 px-1 py-[2px] text-[9px] font-medium border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)]">
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
                <div className="mt-1 rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand50,#F9F4EB)] px-1 py-0.5">
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
  )
}

// ----- Overlays, Filters, etc. -----
export function ThumbContent({ p }: { p: Photo }) {
  return (
    <div className="pointer-events-none absolute top-1 left-1 flex items-center gap-1 text-[10px]">
      <span className="px-1 py-0.5 bg-white/85 border border-[var(--border,#E1D3B9)] rounded">{p.type}</span>
      <span className="w-2.5 h-2.5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: COLOR_MAP[p.tag] }} aria-hidden />
    </div>
  )
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'muted' | 'accent'

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
  const pickBadge = p.picked
    ? { label: 'Picked', tone: 'success', icon: '✔', ariaLabel: 'Picked asset' }
    : p.rejected
      ? { label: 'Rejected', tone: 'danger', icon: '✕', ariaLabel: 'Rejected asset' }
      : { label: 'Pending', tone: 'muted', icon: '•', ariaLabel: 'Pick or reject pending' }

  const ratingBadgeLabel = `★${p.rating > 0 ? p.rating : '—'}`
  const ratingBadge = { label: ratingBadgeLabel, tone: 'accent' as BadgeTone, ariaLabel: `Rating: ${p.rating} star${p.rating === 1 ? '' : 's'}` }

  const statusBadge = (() => {
    switch (p.status) {
      case 'READY':
        return { label: 'Ready', tone: 'success' as BadgeTone, icon: '✔', ariaLabel: 'Asset ready' }
      case 'PROCESSING':
      case 'QUEUED':
      case 'UPLOADING':
        return { label: 'Processing', tone: 'warning' as BadgeTone, icon: '⏳', ariaLabel: 'Asset processing' }
      case 'ERROR':
        return { label: 'Error', tone: 'danger' as BadgeTone, icon: '⚠', ariaLabel: 'Processing error' }
      case 'MISSING_SOURCE':
        return { label: 'Missing source', tone: 'danger' as BadgeTone, icon: '⚠', ariaLabel: 'Missing source' }
      case 'DUPLICATE':
        return { label: 'Duplicate', tone: 'muted' as BadgeTone, icon: '≡', ariaLabel: 'Duplicate asset' }
      default:
        return { label: 'Processing', tone: 'warning' as BadgeTone, icon: '⏳', ariaLabel: `Status: ${p.status}` }
    }
  })()

  return (
    <div className="border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-[11px]">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[12px] font-semibold text-[var(--text,#1F1E1B)] truncate">{p.name}</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Badge {...pickBadge} />
          <Badge {...ratingBadge} />
          <Badge {...statusBadge} />
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
        <div className="absolute right-0 mt-1 bg-white border border-[var(--border,#E1D3B9)] rounded shadow p-2 grid grid-cols-6 gap-1 z-10">
          {(Object.keys(map) as ColorTag[]).map((k) => (
            <button key={k} aria-label={k} title={k} className="w-5 h-5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: map[k] }} onClick={() => { onPick(k); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-4 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <RawPlaceholderFrame ratio="3x2" className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
        <div className="text-base font-semibold">Start your project</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">Import photos to begin. You can auto-organize by date (YYYY/MM/DD) or choose a custom folder name.</div>
        <button onClick={onImport} className="mt-1 px-3 py-2 rounded-md text-xs font-medium" style={{ backgroundColor: TOKENS.clay500, color: '#fff' }}>
          Import photos…
        </button>
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
