import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Button } from '../../../components/Button'

// ...

import {
  ChevronRightIcon,
  FolderIcon,
  SettingsIcon,
  LayoutListIcon,
  ImportIcon,
  CalendarIcon,
  ChevronLeftIcon,
} from './icons'
import { RailDivider } from './Buttons'
import { DateTreeYearNode, DateTreeMonthNode, DateTreeDayNode, ProjectOverviewData } from '../types'
import {
  projectInitials,
  localizedMonthLabel,
  makeMonthKey,
  makeDayKey,
  PROJECT_DATE_FORMAT,
} from '../utils'
const LEFT_PANEL_ID = 'workspace-sidebar'
const LEFT_PANEL_CONTENT_ID = `${LEFT_PANEL_ID}-content`

type SidebarTab = 'files' | 'info'

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
  const [activeTab, setActiveTab] = useState<SidebarTab>('files')
  const [filesViewMode, setFilesViewMode] = useState<'folder' | 'date'>('date')
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set())

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

  const isMobilePanel = mode === 'mobile'
  const collapsedState = isMobilePanel ? false : collapsed

  // Base classes for the outer container
  // We want a cohesive container look.
  const panelShellClass = isMobilePanel
    ? 'flex h-full min-h-0 flex-col overflow-hidden bg-[var(--surface,#FFFFFF)]'
    : 'flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--r-lg,20px)] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] shadow-[0_30px_80px_rgba(31,30,27,0.16)]'

  const TabSwitcher = () => (
    <div className="mx-4 mb-4 grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-muted,#F3EBDD)] p-1">
      <button
        type="button"
        onClick={() => setActiveTab('files')}
        className={`rounded-md py-1.5 text-xs font-semibold transition-all ${activeTab === 'files'
          ? 'bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] shadow-sm'
          : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]'
          }`}
      >
        Files
      </button>
      <button
        type="button"
        onClick={() => setActiveTab('info')}
        className={`rounded-md py-1.5 text-xs font-semibold transition-all ${activeTab === 'info'
          ? 'bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] shadow-sm'
          : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]'
          }`}
      >
        Project Info
      </button>
    </div>
  )

  const FilesContent = () => (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {/* Import Action (Sticky-ish if we wanted, but top of flow is fine) */}
      <div>
        <Button
          onClick={onOpenImport}
          data-testid="nav-import-action"
          className="w-full gap-2 justify-center"
          variant="outline" // "Ghost" / Outline style
        >
          <ImportIcon className="h-4 w-4" aria-hidden="true" />
          Import Photos
        </Button>
      </div>

      {/* HEADER: Label + View Icons */}
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted,#6B645B)] mt-2 border-b border-[var(--border,#EDE1C6)] pb-2">
        {/* Left Side: Label based on current view */}
        <div className="flex items-center gap-2">
          {filesViewMode === 'date' ? (
            <>
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Dates</span>
            </>
          ) : (
            <>
              <FolderIcon className="h-3.5 w-3.5" />
              <span>Folders</span>
            </>
          )}
        </div>

        {/* Right Side: Tiny Icon Toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilesViewMode('date')}
            title="Date View"
            className={`p-1.5 rounded-md transition-colors ${filesViewMode === 'date'
                ? 'bg-[var(--surface-muted,#F3EBDD)] text-[var(--text,#1F1E1B)]'
                : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]'
              }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setFilesViewMode('folder')}
            title="Folder View"
            className={`p-1.5 rounded-md transition-colors ${filesViewMode === 'folder'
                ? 'bg-[var(--surface-muted,#F3EBDD)] text-[var(--text,#1F1E1B)]'
                : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]'
              }`}
          >
            <FolderIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Date Filter Status (only relevant if actually active) */}
      {selectedDayKey && filesViewMode === 'date' && (
        <div className="rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-3 py-2 -mt-1">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted,#6B645B)]">
            <span className="truncate font-medium">{selectedDay?.label ?? 'Selection'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClearDateFilter()
              }}
              className="text-[10px] font-medium text-[var(--river-500,#6B7C7A)] hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Content Area Switch */}
      {filesViewMode === 'date' ? (
        dateTree.length ? (
          <ul className="space-y-0.5">
            {dateTree.map((yearNode) => {
              const isYearExpanded = expandedYears.has(yearNode.id)
              return (
                <li key={yearNode.id}>
                  <button
                    type="button"
                    onClick={() => toggleYear(yearNode.id)}
                    aria-expanded={isYearExpanded}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]"
                  >
                    <ChevronRightIcon
                      className={`h-3 w-3 text-[var(--text-muted,#6B645B)] transition-transform ${isYearExpanded ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{yearNode.year}</span>
                    <span className="ml-auto text-xs text-[var(--text-muted,#6B645B)] opacity-60">
                      {yearNode.count}
                    </span>
                  </button>
                  {isYearExpanded ? (
                    <ul className="ml-[11px] mt-0.5 space-y-0.5 border-l border-[var(--border,#EDE1C6)] pl-2">
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
                              <span className="ml-auto text-[10px] text-[var(--text-muted,#6B645B)] opacity-60">
                                {monthNode.count}
                              </span>
                            </button>
                            {isMonthExpanded ? (
                              <ul className="ml-[11px] mt-0.5 space-y-0.5 border-l border-[var(--border,#EDE1C6)] pl-2">
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
                                        <span className="ml-auto text-[10px] opacity-60">
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
          <p className="px-2 text-xs italic text-[var(--text-muted,#6B645B)] mt-4">No dates available.</p>
        )
      ) : (
        // Folder View
        <div className="mt-2 rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface-subtle,#FBF7EF)] p-4 text-center">
          <p className="text-xs text-[var(--text-muted,#6B645B)]">Folder structure view coming soon.</p>
        </div>
      )}
    </div>
  )

  const InfoContent = () => (
    <div className="px-4 pb-4">
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
        <div className="py-4 text-center text-sm text-[var(--text-muted,#6B645B)]">Loading details…</div>
      )}
    </div>
  )

  return (
    <aside
      id={LEFT_PANEL_ID}
      role="complementary"
      aria-label="Sidebar"
      className={`relative h-full min-h-0 ${isMobilePanel ? 'px-0 py-0' : 'px-2 py-4'}`}
      data-state={collapsedState ? 'collapsed' : 'expanded'}
    >
      <div
        data-panel="body"
        aria-hidden={collapsedState}
        className={`h-full min-h-0 ${isMobilePanel ? '' : `transition-opacity duration-150 ${collapsedState ? 'pointer-events-none opacity-0' : 'opacity-100'}`}`}
      >
        <div className={panelShellClass}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text,#1F1E1B)]">
              <LayoutListIcon className="h-4 w-4" aria-hidden="true" />
              <span>Project</span>
            </div>
            {!isMobilePanel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCollapse}
                className="h-6 w-6 text-[var(--text-muted,#6B645B)]"
                aria-label="Collapse sidebar"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Tabs - Only show active content area */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden pt-4">
            <TabSwitcher />
            <div id={LEFT_PANEL_CONTENT_ID} className="flex-1 overflow-y-auto">
              {activeTab === 'files' ? <FilesContent /> : <InfoContent />}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsed Rail View */}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-[12px] h-10 w-10"
                  onClick={onExpand}
                  aria-label="Expand Project panel"
                >
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
                <RailDivider />
              </div>
              <div className="mt-3 flex flex-1 flex-col items-center gap-4">
                {/* Mini Icons for quick access - could toggle expanding to specific tab */}
                <button
                  onClick={() => { setActiveTab('files'); onExpand(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted,#6B645B)] hover:bg-[var(--surface-subtle,#FBF7EF)] hover:text-[var(--text,#1F1E1B)]"
                  title="Files"
                >
                  <FolderIcon className="h-5 w-5" />
                </button>
                <div className="h-px w-6 bg-[var(--border,#EDE1C6)]" />
                <button
                  onClick={() => { setActiveTab('files'); onExpand(); }} // Date is in files now
                  className={`flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--surface-subtle,#FBF7EF)] ${selectedDayKey ? 'text-[var(--river-700,#2F5F62)] bg-[var(--river-100,#E3F2F4)]' : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]'}`}
                  title="Dates"
                >
                  <CalendarIcon className="h-5 w-5" />
                </button>
                <div className="h-px w-6 bg-[var(--border,#EDE1C6)]" />
                <button
                  onClick={() => { setActiveTab('info'); onExpand(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted,#6B645B)] hover:bg-[var(--surface-subtle,#FBF7EF)] hover:text-[var(--text,#1F1E1B)]"
                  title="Info"
                >
                  <SettingsIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

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
              <Button
                key={tag}
                variant="outline"
                size="sm"
                onClick={() => handleRemoveTag(tag)}
                disabled={updatePending}
                aria-label={`Remove tag ${tag}`}
                rightIcon={<span aria-hidden="true">✕</span>}
                className="h-7 px-3 py-0.5 text-[11px] font-normal"
              >
                {tag}
              </Button>
            ))
          ) : (
            <span className="text-[12px] text-[var(--text-muted,#6B645B)]">No tags</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:flex-nowrap">
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
            className="h-9 min-w-0 flex-auto basis-full rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] text-[var(--text,#1F1E1B)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring,#1A73E8)] sm:basis-[65%]"
          />
          <Button
            onClick={handleAddTag}
            disabled={updatePending}
            className="h-9 flex-none px-4 text-[12px] font-semibold border border-[var(--border,#EDE1C6)] bg-transparent hover:bg-[var(--surface-subtle,#FBF7EF)]"
            variant="ghost"
          >
            Add
          </Button>
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
