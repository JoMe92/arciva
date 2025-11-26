import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { RawPlaceholder, RawPlaceholderFrame } from '../../../components/RawPlaceholder'
import {
  ChevronRightIcon,
  PlusIcon,
  MinusIcon,
  FolderIcon,
  CalendarClockIcon,
  CameraIcon,
  PreviewIcon,
  SettingsIcon,
  LayoutListIcon,
  ImportIcon,
  CalendarIcon,
  ChevronLeftIcon,
} from './icons'
import { InspectorRailButton, RailDivider } from './Buttons'
import { DateTreeYearNode, DateTreeMonthNode, DateTreeDayNode, ProjectOverviewData } from '../types'
import {
  projectInitials,
  localizedMonthLabel,
  makeMonthKey,
  makeDayKey,
  PROJECT_DATE_FORMAT,
} from '../utils'
import { CountBadge } from './Common'
const LEFT_PANEL_ID = 'workspace-sidebar'
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
  onProjectOverviewChange: (patch: {
    note?: string | null
    client?: string | null
    tags?: string[]
  }) => Promise<void> | void
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
  const pendingTargetRef = useRef<LeftPanelTarget | null>(null)
  const overviewSectionRef = useRef<HTMLDivElement | null>(null)
  const importSectionRef = useRef<HTMLDivElement | null>(null)
  const dateSectionRef = useRef<HTMLDivElement | null>(null)
  const folderSectionRef = useRef<HTMLDivElement | null>(null)

  const toggleYear = (id: string) => {
    const next = new Set(expandedYears)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedYears(next)
  }

  const toggleMonth = (id: string) => {
    const next = new Set(expandedMonths)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedMonths(next)
  }

  const ensureSectionOpen = useCallback((target: LeftPanelTarget) => {
    if (target === 'overview') setOverviewSectionOpen(true)
    else if (target === 'import') setImportSectionOpen(true)
    else if (target === 'date') setDateSectionOpen(true)
    else if (target === 'folder') setFolderSectionOpen(true)
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
    if (collapsed) return
    const target = pendingTargetRef.current
    if (!target) return
    ensureSectionOpen(target)
    scrollToTarget(target)
    pendingTargetRef.current = null
  }, [collapsed, ensureSectionOpen, scrollToTarget])

  const handleRailSelect = useCallback(
    (target: LeftPanelTarget) => {
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

  const isMobilePanel = mode === 'mobile'
  const collapsedState = isMobilePanel ? false : collapsed
  const panelShellClass = isMobilePanel
    ? 'flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-1'
    : 'flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] p-4 shadow-[0_30px_80px_rgba(31,30,27,0.16)]'
  const panelContentClass = isMobilePanel
    ? 'flex flex-1 min-h-0 flex-col gap-3 pb-4'
    : 'flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-2'

  const hasDateFilter = !!selectedDayKey

  return (
    <aside
      id={LEFT_PANEL_ID}
      role="complementary"
      aria-label="Sidebar"
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
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] pb-3">
              <button
                type="button"
                aria-label="Collapse sidebar"
                aria-controls={LEFT_PANEL_CONTENT_ID}
                onClick={onCollapse}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border,#EDE1C6)] text-[var(--text,#1F1E1B)] transition hover:border-[var(--text,#1F1E1B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
              >
                <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <LayoutListIcon className="h-4 w-4 text-[var(--text,#1F1E1B)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Project</span>
            </header>
          ) : (
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-[var(--text,#1F1E1B)]">
              <LayoutListIcon className="h-4 w-4" aria-hidden="true" />
              Project
            </div>
          )}

          <div id={LEFT_PANEL_CONTENT_ID} className={panelContentClass}>
            <InspectorSection
              id={LEFT_OVERVIEW_SECTION_ID}
              ref={overviewSectionRef}
              icon={<LayoutListIcon className="h-4 w-4" aria-hidden="true" />}
              label="Overview"
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
                <p className="text-sm text-[var(--text-muted,#6B645B)]">Loading project details…</p>
              )}
            </InspectorSection>

            <InspectorSection
              id={LEFT_IMPORT_SECTION_ID}
              ref={importSectionRef}
              icon={<ImportIcon className="h-4 w-4" aria-hidden="true" />}
              label="Import"
              open={importSectionOpen}
              onToggle={() => setImportSectionOpen((open) => !open)}
            >
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted,#6B645B)]">
                  Add photos to this project.
                </p>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--text,#1F1E1B)] px-4 py-2 text-sm font-semibold text-[var(--surface,#FFFFFF)] shadow-sm transition hover:bg-[var(--text-muted,#6B645B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                >
                  <ImportIcon className="h-4 w-4" aria-hidden="true" />
                  Import Photos
                </button>
              </div>
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
              {dateTree.length ? (
                <ul className="space-y-1">
                  {dateTree.map((yearNode) => {
                    const isYearExpanded = expandedYears.has(yearNode.id)
                    return (
                      <li key={yearNode.id}>
                        <button
                          type="button"
                          onClick={() => toggleYear(yearNode.id)}
                          aria-expanded={isYearExpanded}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-medium text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]"
                        >
                          <ChevronRightIcon
                            className={`h-3 w-3 text-[var(--text-muted,#6B645B)] transition-transform ${isYearExpanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                          <span>{yearNode.year}</span>
                          <span className="ml-auto text-xs text-[var(--text-muted,#6B645B)]">
                            {yearNode.count}
                          </span>
                        </button>
                        {isYearExpanded ? (
                          <ul className="ml-4 mt-1 space-y-1 border-l border-[var(--border,#EDE1C6)] pl-2">
                            {yearNode.months.map((monthNode) => {
                              const isMonthExpanded = expandedMonths.has(monthNode.id)
                              return (
                                <li key={monthNode.id}>
                                  <button
                                    type="button"
                                    onClick={() => toggleMonth(monthNode.id)}
                                    aria-expanded={isMonthExpanded}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-medium text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]"
                                  >
                                    <ChevronRightIcon
                                      className={`h-3 w-3 text-[var(--text-muted,#6B645B)] transition-transform ${isMonthExpanded ? 'rotate-90' : ''}`}
                                      aria-hidden="true"
                                    />
                                    <span>{monthNode.label}</span>
                                    <span className="ml-auto text-[10px] text-[var(--text-muted,#6B645B)]">
                                      {monthNode.count}
                                    </span>
                                  </button>
                                  {isMonthExpanded ? (
                                    <ul className="ml-4 mt-1 space-y-0.5 border-l border-[var(--border,#EDE1C6)] pl-2">
                                      {monthNode.days.map((dayNode) => {
                                        const isSelected = selectedDayKey === dayNode.id
                                        return (
                                          <li key={dayNode.id}>
                                            <button
                                              type="button"
                                              onClick={() => onSelectDay(dayNode)}
                                              aria-current={isSelected ? 'date' : undefined}
                                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition ${isSelected
                                                ? 'bg-[var(--river-100,#E3F2F4)] font-semibold text-[var(--river-700,#2F5F62)]'
                                                : 'text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]'
                                                }`}
                                            >
                                              <span>{dayNode.label}</span>
                                              <span className="ml-auto text-[10px] opacity-70">
                                                {dayNode.count}
                                              </span>
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
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-xs text-[var(--text-muted,#6B645B)]">No dates available.</p>
              )}
            </InspectorSection>

            <InspectorSection
              id={LEFT_FOLDER_SECTION_ID}
              ref={folderSectionRef}
              icon={<FolderIcon className="h-4 w-4" aria-hidden="true" />}
              label="Folders"
              open={folderSectionOpen}
              onToggle={() => setFolderSectionOpen((open) => !open)}
            >
              <p className="text-xs text-[var(--text-muted,#6B645B)]">Folder view coming soon.</p>
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
            <div
              role="toolbar"
              aria-label="Sidebar rail"
              className="pointer-events-auto flex h-full w-full flex-col items-center rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-1 py-3 shadow-[0_20px_40px_rgba(31,30,27,0.18)]"
            >
              <div className="flex flex-col items-center gap-2">
                <InspectorRailButton
                  icon={<ChevronRightIcon className="h-4 w-4" aria-hidden="true" />}
                  label="Expand Project Overview panel"
                  onClick={onExpand}
                />
                <RailDivider />
              </div>
              <div className="mt-3 flex flex-1 flex-col items-center gap-2">
                <InspectorRailButton
                  icon={<LayoutListIcon className="h-4 w-4" aria-hidden="true" />}
                  label="Overview"
                  onClick={() => handleRailSelect('overview')}
                  ariaControls={LEFT_OVERVIEW_SECTION_ID}
                  ariaExpanded={overviewSectionOpen}
                />
                <InspectorRailButton
                  icon={<ImportIcon className="h-4 w-4" aria-hidden="true" />}
                  label="Import"
                  onClick={() => handleRailSelect('import')}
                  ariaControls={LEFT_IMPORT_SECTION_ID}
                  ariaExpanded={importSectionOpen}
                />
                <InspectorRailButton
                  icon={<CalendarIcon className="h-4 w-4" aria-hidden="true" />}
                  label="Date"
                  onClick={() => handleRailSelect('date')}
                  ariaControls={LEFT_DATE_SECTION_ID}
                  ariaExpanded={dateSectionOpen}
                  isActive={hasDateFilter}
                />
                <InspectorRailButton
                  icon={<FolderIcon className="h-4 w-4" aria-hidden="true" />}
                  label="Folders"
                  onClick={() => handleRailSelect('folder')}
                  ariaControls={LEFT_FOLDER_SECTION_ID}
                  ariaExpanded={folderSectionOpen}
                />
              </div>
              <div className="mt-auto flex flex-col items-center gap-2">
                <RailDivider />
                <InspectorRailButton
                  icon={<SettingsIcon className="h-4 w-4" aria-hidden="true" />}
                  label="Import settings"
                  onClick={() => handleRailSelect('folder')} // Placeholder
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
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

type ProjectOverviewDetailsProps = {
  data: ProjectOverviewData
  onRename: (next: string) => Promise<void> | void
  renamePending?: boolean
  renameError?: string | null
  onUpdate: (patch: {
    note?: string | null
    client?: string | null
    tags?: string[]
  }) => Promise<void> | void
  updatePending?: boolean
  updateError?: string | null
}

function ProjectOverviewDetails({
  data,
  onRename,
  renamePending,
  renameError,
  onUpdate,
  updatePending,
  updateError,
}: ProjectOverviewDetailsProps) {
  const [name, setName] = useState(data.title)
  const [description, setDescription] = useState(data.description ?? '')
  const [client, setClient] = useState(data.client ?? '')
  const [tags, setTags] = useState<string[]>(data.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')

  useEffect(() => setName(data.title), [data.title]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => setDescription(data.description ?? ''), [data.description]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => setClient(data.client ?? ''), [data.client]) // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => setTags(data.tags ?? []), [data.tags]) // eslint-disable-line react-hooks/set-state-in-effect

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
    [commitName, data.title]
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
    [tags, onUpdate, updatePending]
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
        {renameError ? (
          <span className="mt-1 block text-[11px] text-[#B42318]">{renameError}</span>
        ) : null}
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
          <p className="mt-1 text-base font-semibold text-[var(--text,#1F1E1B)]">
            {data.assetCount}
          </p>
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
