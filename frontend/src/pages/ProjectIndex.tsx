import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StoneTrailLogo from '../components/StoneTrailLogo'
import { useTheme } from '../shared/theme'
import Splash from '../components/Splash'
import { Project } from '../features/projects/types'
import { unique, projectFromApi } from '../features/projects/utils'
import { PROJECTS } from '../features/projects/data'
import { useArchive } from '../features/projects/archive'
import { useLastOpened } from '../features/projects/useLastOpened'
import ProjectGrid from '../components/ProjectGrid'
import ProjectGridSkeleton from '../components/ProjectGridSkeleton'
import StateHint from '../components/StateHint'
import CreateModal from '../components/modals/CreateModal'
import ProjectSettingsDialog from '../components/modals/ProjectSettingsDialog'
import GeneralSettingsDialog from '../components/modals/GeneralSettingsDialog'
import { createProject, deleteProject, listProjects, type ProjectApiResponse } from '../shared/api/projects'
import { updateAssetPreview } from '../shared/api/assets'
import DeleteModal from '../components/modals/DeleteModal'
import ProjectSettingsButton from '../components/ProjectSettingsButton'
import { useGeneralSettings } from '../shared/settings/general'
import type { GeneralSettings } from '../shared/settings/general'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const FILTER_PANEL_ID = 'project-filters-panel'

const AppBar: React.FC<{
  onCreate: () => void
  onToggleArchive: () => void
  archiveMode: boolean
  onOpenSettings: () => void
  filtersOpen: boolean
  onToggleFilters: () => void
  filterCount: number
}> = ({ onCreate, onToggleArchive, archiveMode, onOpenSettings, filtersOpen, onToggleFilters, filterCount }) => {
  const { mode, toggle } = useTheme()
  const filterButtonActive = filtersOpen || filterCount > 0

  return (
    <div className="border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
        <StoneTrailLogo className="shrink-0" mode={mode} onToggleTheme={toggle} />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onToggleArchive} className="inline-flex h-8 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] hover:border-[var(--text-muted,#6B645B)]">
            {archiveMode ? 'Exit archive' : 'Enter archive'}
          </button>
          <button
            type="button"
            onClick={onToggleFilters}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--stone-trail-brand-focus,#4A463F)] ${
              filterButtonActive ? 'border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text-muted,#6B645B)]'
            }`}
            aria-expanded={filtersOpen}
            aria-controls={FILTER_PANEL_ID}
            title="Toggle project filters"
          >
            {filterCount ? `Filters (${filterCount})` : 'Filters'}
          </button>
          <button onClick={onCreate} className="inline-flex h-8 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] hover:border-[var(--text-muted,#6B645B)]">
            <span className="mr-1">＋</span> New project
            <kbd className="ml-2 hidden lg:inline text-[10px] text-[var(--text-muted,#6B645B)]">⌘/Ctrl+N</kbd>
          </button>
          <ProjectSettingsButton onClick={onOpenSettings} label="Open application settings" title="Application settings" />
        </div>
      </div>
    </div>
  )
}

const FilterBar: React.FC<{
  projects: Project[]
  q: string
  setQ: (s: string) => void
  client: string
  setClient: (s: string) => void
  year: string
  setYear: (value: string) => void
  month: string
  setMonth: (value: string) => void
  tags: string[]
  setTags: (t: string[]) => void
  onClearFilters: () => void
  id?: string
}> = ({ projects, q, setQ, client, setClient, year, setYear, month, setMonth, tags, setTags, onClearFilters, id }) => {
  const clients = useMemo(() => unique(projects.map((p) => p.client)), [projects])
  const allTags = useMemo(() => unique(projects.flatMap((p) => p.tags || [])), [projects])
  const years = useMemo(() => {
    const collected: number[] = []
    projects.forEach((p) => {
      if (!p.createdAt) return
      const parsed = new Date(p.createdAt)
      if (Number.isNaN(parsed.getTime())) return
      collected.push(parsed.getFullYear())
    })
    const set = Array.from(new Set(collected))
    return set.sort((a, b) => b - a).map(String)
  }, [projects])
  const [tagPickerOpen, setTagPickerOpen] = React.useState(false)
  const [tagSearch, setTagSearch] = React.useState('')
  const tagButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const popoverRef = React.useRef<HTMLDivElement | null>(null)
  const filteredTags = useMemo(() => {
    if (!tagSearch) return allTags
    const lower = tagSearch.toLowerCase()
    return allTags.filter((tag) => tag.toLowerCase().includes(lower))
  }, [allTags, tagSearch])
  const toggleTag = React.useCallback(
    (value: string) => {
      setTags(tags.includes(value) ? tags.filter((t) => t !== value) : [...tags, value])
    },
    [setTags, tags],
  )
  const closePicker = React.useCallback(() => setTagPickerOpen(false), [])

  React.useEffect(() => {
    if (!tagPickerOpen) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (
        target &&
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        tagButtonRef.current &&
        !tagButtonRef.current.contains(target)
      ) {
        closePicker()
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [closePicker, tagPickerOpen])

  const handleClearAll = React.useCallback(() => {
    onClearFilters()
    setTagPickerOpen(false)
    setTagSearch('')
  }, [onClearFilters])

  const monthLabel = month ? MONTHS[Number(month) - 1] ?? null : null
  const hasFilterSelections = Boolean(client || year || month || tags.length)
  const activePills: Array<{ label: string; onClear: () => void }> = []
  if (client) activePills.push({ label: `Client: ${client}`, onClear: () => setClient('') })
  if (year) activePills.push({ label: `Year: ${year}`, onClear: () => setYear('') })
  if (month && monthLabel) activePills.push({ label: `Month: ${monthLabel}`, onClear: () => setMonth('') })

  return (
    <div
      id={id}
      role="region"
      aria-label="Project filters"
      className="mb-8 rounded-3xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-4 shadow-[0_8px_26px_rgba(31,30,27,0.05)]"
    >
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            <span className="mb-1 block">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[13px] outline-none placeholder:text-[var(--text-muted,#6B645B)]"
            />
          </label>
        </div>

        <div className="w-[160px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            <span className="mb-1 block">Client</span>
            <select
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[13px] outline-none"
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="w-[140px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            <span className="mb-1 block">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[13px] outline-none"
            >
              <option value="">All years</option>
              {years.map((optionYear) => (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="w-[150px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
            <span className="mb-1 block">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[13px] outline-none"
            >
              <option value="">All months</option>
              {MONTHS.map((label, idx) => {
                const value = String(idx + 1)
                return (
                  <option key={label} value={value}>
                    {label}
                  </option>
                )
              })}
            </select>
          </label>
        </div>

        <div className="relative w-[160px]">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Tags</span>
          <button
            type="button"
            ref={tagButtonRef}
            onClick={() => setTagPickerOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-left text-[13px] text-[var(--text,#1F1E1B)] shadow-sm"
            aria-haspopup="dialog"
            aria-expanded={tagPickerOpen}
          >
            <span className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden className="text-[var(--text-muted,#6B645B)]">
                <path
                  d="M5 3h10a1 1 0 0 1 .94.66l2.5 7a1 1 0 0 1-.94 1.34H2.5a1 1 0 0 1-.95-1.31l2.5-7A1 1 0 0 1 5 3zm5 12.5a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 10 15.5z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{tags.length ? `${tags.length} selected` : 'Choose tags'}</span>
            </span>
            <span className="text-[var(--text-muted,#6B645B)]">{tagPickerOpen ? '▲' : '▼'}</span>
          </button>
          {tagPickerOpen && (
            <div
              ref={popoverRef}
              className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 shadow-xl"
            >
              <div className="mb-2">
                <input
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Find tag…"
                  className="w-full rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-1.5 text-[12px] outline-none placeholder:text-[var(--text-muted,#6B645B)]"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto pr-1">
                {filteredTags.length ? (
                  filteredTags.map((tag) => (
                    <label
                      key={tag}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-subtle,#FBF7EF)]"
                    >
                      <input
                        type="checkbox"
                        checked={tags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                        className="accent-[var(--primary,#A56A4A)]"
                      />
                      <span className="flex-1">{tag}</span>
                    </label>
                  ))
                ) : (
                  <div className="px-1.5 py-2 text-[12px] text-[var(--text-muted,#6B645B)]">No tags found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[240px] rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Selected tags</div>
          <div className="tag-strip flex w-full flex-nowrap gap-1.5">
            {tags.length ? (
              tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2.5 py-0.5 text-[11px] text-[var(--text,#1F1E1B)]"
                >
                  <span>{tag}</span>
                  <span aria-hidden>×</span>
                </button>
              ))
            ) : (
              <span className="inline-flex items-center text-[12px] text-[var(--text-muted,#6B645B)]">No tags selected</span>
            )}
          </div>
        </div>

        <div className="flex min-w-[200px] flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {activePills.length ? (
              activePills.map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={pill.onClear}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-1 text-[11px] text-[var(--text,#1F1E1B)]"
                >
                  <span>{pill.label}</span>
                  <span aria-hidden>×</span>
                </button>
              ))
            ) : (
              <span className="text-[12px] text-[var(--text-muted,#6B645B)]">No additional filters</span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={!hasFilterSelections}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-1.5 text-[12px] text-[var(--text,#1F1E1B)] disabled:opacity-60"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjectIndex() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const { update } = useLastOpened()
  const queryClient = useQueryClient()

  const [q, setQ] = useState('')
  const [client, setClient] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const { archived, isArchived, archive, unarchive } = useArchive()
  const [archiveMode, setArchiveMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { settings: generalSettings, setSettings: setGeneralSettings } = useGeneralSettings()
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false)
  const openGeneralSettings = useCallback(() => setGeneralSettingsOpen(true), [])
  const closeGeneralSettings = useCallback(() => setGeneralSettingsOpen(false), [])
  const handleGeneralSettingsSave = useCallback((nextSettings: GeneralSettings) => {
    setGeneralSettings(nextSettings)
    setGeneralSettingsOpen(false)
  }, [setGeneralSettings])

  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t) }, [])

  const { data: apiProjects, isLoading: loadingProjects, isError: projectsError, error: projectsErrorObj } = useQuery<ProjectApiResponse[], Error>({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  // Local overlays for edits so tags and other changes reflect immediately
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Project>>>({})

  const dynamicProjects = useMemo<Project[]>(() => {
    if (!apiProjects) return []
    return apiProjects.map((proj) => projectFromApi(proj))
  }, [apiProjects])

  const includeDemoProjects = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_PROJECTS !== 'false'

  const baseProjects = useMemo(() => {
    const combined = includeDemoProjects ? [...dynamicProjects, ...PROJECTS] : [...dynamicProjects]
    return combined.map((p) => ({ ...p, ...(localEdits[p.id] || {}) }))
  }, [dynamicProjects, includeDemoProjects, localEdits])

  const previewMutation = useMutation({
    mutationFn: ({ projectId, assetId }: { projectId: string; assetId: string }) =>
      updateAssetPreview(projectId, assetId, true, { makePrimary: true }),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ projectId, confirmTitle, deleteAssets }: { projectId: string; confirmTitle: string; deleteAssets: boolean }) =>
      deleteProject(projectId, { confirmTitle, deleteAssets }),
    onSuccess: (_data, vars) => {
      setDeleteError(null)
      setDeleteTarget(null)
      setEditProject((prev) => (prev && prev.id === vars.projectId ? null : prev))
      setEditOpen(false)
      setLocalEdits((prev) => {
        if (!(vars.projectId in prev)) return prev
        const { [vars.projectId]: _omit, ...rest } = prev
        return rest
      })
      unarchive(vars.projectId)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: unknown) => {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete project')
    },
  })

  const handleSelectPrimary = useCallback(async (projectId: string, assetId: string) => {
    const project = baseProjects.find((p) => p.id === projectId)
    if (!project) return
    const previews = (project.previewImages ?? []).slice().sort((a, b) => a.order - b.order)
    const index = previews.findIndex((img) => img.assetId === assetId)
    if (index <= 0) return

    await previewMutation.mutateAsync({ projectId, assetId })

    const reordered = previews.slice()
    const [selected] = reordered.splice(index, 1)
    reordered.unshift({ ...selected })
    const normalized = reordered.map((img, order) => ({ ...img, order }))
    const primaryUrl = normalized[0]?.url ?? null

    setLocalEdits((prev) => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || {}),
        previewImages: normalized,
        image: primaryUrl,
      },
    }))

    setEditProject((prev) => (prev && prev.id === projectId ? { ...prev, previewImages: normalized, image: primaryUrl } : prev))

    queryClient.setQueryData<ProjectApiResponse[] | undefined>(['projects'], (old) => {
      if (!old) return old
      const idx = old.findIndex((p) => p.id === projectId)
      if (idx === -1) return old
      const next = old.slice()
      const existing = next[idx].preview_images ?? []
      const srcIdx = existing.findIndex((img) => img.asset_id === assetId)
      if (srcIdx > 0) {
        const clone = existing.slice()
        const [entry] = clone.splice(srcIdx, 1)
        clone.unshift({ ...entry })
        next[idx] = {
          ...next[idx],
          preview_images: clone.map((img, order) => ({ ...img, order })),
        }
      }
      return next
    })

    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [baseProjects, previewMutation, queryClient, setLocalEdits])

  const allTags = useMemo(() => unique(baseProjects.flatMap((p) => p.tags || [])), [baseProjects])
  const visible = useMemo(() => baseProjects.filter((p) => (archiveMode ? isArchived(p.id) : !isArchived(p.id))), [archiveMode, baseProjects, isArchived])
  const filtered = useMemo(
    () =>
      visible.filter((p) => {
        const title = p.title || ''
        const matchesSearch = !q || title.toLowerCase().includes(q.toLowerCase())
        const matchesClient = !client || p.client === client
        const projectTags = p.tags || []
        const matchesTags = !tags.length || projectTags.some((t) => tags.includes(t))
        let createdYear: string | null = null
        let createdMonth: string | null = null
        if (p.createdAt) {
          const parsed = new Date(p.createdAt)
          if (!Number.isNaN(parsed.getTime())) {
            createdYear = String(parsed.getFullYear())
            createdMonth = String(parsed.getMonth() + 1)
          }
        }
        const matchesYear = !year || (createdYear !== null && createdYear === year)
        const matchesMonth = !month || (createdMonth !== null && createdMonth === month)
        return matchesSearch && matchesClient && matchesYear && matchesMonth && matchesTags
      }),
    [client, month, q, tags, visible, year],
  )

  const closeCreateModal = useCallback(() => {
    setModalOpen(false)
    setCreateError(null)
  }, [])

  const openCreateModal = useCallback(() => {
    setCreateError(null)
    setModalOpen(true)
  }, [])

  const createTagsRef = useRef<string[] | null>(null)

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (proj) => {
      setCreateError(null)
      closeCreateModal()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      const newId = proj.id
      // Overlay tags chosen during creation so filters include them
      if (createTagsRef.current && createTagsRef.current.length) {
        setLocalEdits((prev) => ({
          ...prev,
          [newId]: { ...(prev[newId] || {}), tags: [...createTagsRef.current!] },
        }))
      }
      createTagsRef.current = null
      update(newId)
      navigate(`/projects/${newId}`)
    },
    onError: (err: unknown) => {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    },
  })

  function createProjectHandler(title: string, desc: string, clientName: string, tgs: string[]) {
    const payload = {
      title: title || 'Untitled project',
      client: clientName || undefined,
      note: desc || undefined,
    }
    // Persist tags locally after creation succeeds
    createTagsRef.current = tgs || []
    createMutation.mutate(payload)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); openCreateModal() } }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [openCreateModal])

  const onOpen = useCallback((id: string) => {
    update(id)
    navigate(`/projects/${id}`)
  }, [navigate, update])
  const onArchive = (id: string) => archive(id)
  const onUnarchive = (id: string) => unarchive(id)

  const [editOpen, setEditOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const openEditor = useCallback((p: Project) => {
    setEditProject(p)
    setEditOpen(true)
  }, [])
  const closeEditor = () => { setEditOpen(false) }

  // Apply edits locally so the grid reflects changes immediately.
  // We optimistically update the React Query cache for 'projects'.
  const handleSave = (updated: Project) => {
    // Keep modal state in sync
    setEditProject(updated)

    // Update API-backed projects in cache so derived lists re-render
    queryClient.setQueryData<ProjectApiResponse[] | undefined>(['projects'], (old) => {
      if (!old) return old
      const idx = old.findIndex((p) => p.id === updated.id)
      if (idx === -1) return old
      const next = old.slice()
      next[idx] = {
        ...next[idx],
        title: updated.title,
        client: updated.client || null,
        // Map optional description fields; prefer 'note' if present, fallback to 'blurb'
        note: updated.note ?? updated.blurb ?? next[idx].note ?? null,
        // Touch updated_at to reflect change locally
        updated_at: new Date().toISOString(),
      }
      return next
    })

    // Overlay tags and other edits locally (works for API + static projects)
    setLocalEdits((prev) => ({
      ...prev,
      [updated.id]: {
        ...(prev[updated.id] || {}),
        title: updated.title,
        client: updated.client,
        note: updated.note ?? updated.blurb,
        tags: updated.tags,
      },
    }))

    closeEditor()
  }

  const filterCount = useMemo(() => {
    let count = 0
    if (q.trim()) count += 1
    if (client) count += 1
    if (year) count += 1
    if (month) count += 1
    if (tags.length) count += tags.length
    return count
  }, [client, month, q, tags, year])
  const handleToggleArchive = () => setArchiveMode(a => !a)
  const hasAnyFilters = Boolean(q || client || year || month || tags.length)
  const toggleFilters = useCallback(() => {
    setFiltersOpen((open) => !open)
  }, [])
  const clearFilters = () => { setQ(''); setClient(''); setYear(''); setMonth(''); setTags([]) }

  const handleRequestDelete = useCallback((project: Project) => {
    setDeleteTarget(project)
    setDeleteError(null)
  }, [])

  const closeDeleteModal = useCallback(() => {
    if (deleteMutation.isPending) return
    setDeleteTarget(null)
    setDeleteError(null)
  }, [deleteMutation.isPending])

  const handleDeleteConfirm = useCallback(
    ({ confirmTitle, deleteAssets }: { confirmTitle: string; deleteAssets: boolean }) => {
      if (!deleteTarget) return
      setDeleteError(null)
      deleteMutation.mutate({ projectId: deleteTarget.id, confirmTitle, deleteAssets })
    },
    [deleteMutation, deleteTarget],
  )

  const showLoadingSkeleton = loadingProjects && !apiProjects

  return (
    <div className="min-h-screen bg-[var(--surface-subtle,#FBF7EF)]">
      <div className="sticky top-0 z-40">
        <AppBar
          onCreate={openCreateModal}
          onToggleArchive={handleToggleArchive}
          archiveMode={archiveMode}
          onOpenSettings={openGeneralSettings}
          filtersOpen={filtersOpen}
          onToggleFilters={toggleFilters}
          filterCount={filterCount}
        />
        <div
          className="border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur"
          hidden={!filtersOpen}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
            <FilterBar
              id={FILTER_PANEL_ID}
              projects={baseProjects}
              q={q}
              setQ={setQ}
              client={client}
              setClient={setClient}
              year={year}
              setYear={setYear}
              month={month}
              setMonth={setMonth}
              tags={tags}
              setTags={setTags}
              onClearFilters={clearFilters}
            />
          </div>
        </div>
        <AnimatePresence>{!ready && <Splash />}</AnimatePresence>
      </div>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text,#1F1E1B)]">
            {archiveMode ? 'Archive' : 'Project Cards'}
          </h1>
          <p className="text-sm text-[var(--text-muted,#6B645B)]">
            {archiveMode ? 'Archived projects are hidden from the main view.' : 'A Project Card is your project hub—context, assets, and progress, neatly linked and searchable.'}
          </p>
        </header>

        {projectsError && (
          <StateHint message={`Could not load projects from server: ${projectsErrorObj?.message ?? 'Unknown error'}`} />
        )}
        {createError && (
          <StateHint message={`Project could not be created: ${createError}`} actionLabel="Try again" onAction={openCreateModal} />
        )}
        {!loadingProjects && !filtered.length && (
          <StateHint
            message={hasAnyFilters ? 'No projects match your current filters.' : 'No projects yet — create one to get started.'}
            actionLabel={hasAnyFilters ? 'Clear filters' : 'Create project'}
            onAction={hasAnyFilters ? clearFilters : openCreateModal}
          />
        )}

        {showLoadingSkeleton ? (
          <ProjectGridSkeleton />
        ) : (
          <ProjectGrid
            items={filtered}
            onOpen={onOpen}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onCreate={openCreateModal}
            archiveMode={archiveMode}
            onEdit={openEditor}
            onSelectPrimary={handleSelectPrimary}
          />
        )}

        <ProjectSettingsDialog
          open={editOpen}
          project={editProject}
          onClose={closeEditor}
          onSave={handleSave}
          onOpen={(id) => { update(id); navigate(`/projects/${id}`) }}
          archived={editProject ? isArchived(editProject.id) : false}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          existingTags={allTags}
          onRequestDelete={handleRequestDelete}
        />
      </main>

      <CreateModal
        open={modalOpen}
        onClose={closeCreateModal}
        onCreate={createProjectHandler}
        existingTags={allTags}
        busy={createMutation.isPending}
      />
      <DeleteModal
        open={Boolean(deleteTarget)}
        project={deleteTarget}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        busy={deleteMutation.isPending}
        error={deleteError}
      />
      <GeneralSettingsDialog open={generalSettingsOpen} settings={generalSettings} onClose={closeGeneralSettings} onSave={handleGeneralSettingsSave} />
    </div>
  )
}
