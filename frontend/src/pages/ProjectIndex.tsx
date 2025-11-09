import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StoneTrailLogo from '../components/StoneTrailLogo'
import Splash from '../components/Splash'
import { Project } from '../features/projects/types'
import { unique } from '../features/projects/utils'
import { PROJECTS } from '../features/projects/data'
import { useArchive } from '../features/projects/archive'
import { useLastOpened } from '../features/projects/useLastOpened'
import ProjectGrid from '../components/ProjectGrid'
import ProjectGridSkeleton from '../components/ProjectGridSkeleton'
import StateHint from '../components/StateHint'
import CreateModal from '../components/modals/CreateModal'
import EditModal from '../components/modals/EditModal'
import { createProject, deleteProject, listProjects, type ProjectApiResponse } from '../shared/api/projects'
import { updateAssetPreview } from '../shared/api/assets'
import { withBase } from '../shared/api/base'
import DeleteModal from '../components/modals/DeleteModal'

const AppBar: React.FC<{ onCreate: () => void; onToggleArchive: () => void; archiveMode: boolean }> = ({ onCreate, onToggleArchive, archiveMode }) => (
  <div className="sticky top-0 z-40 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur">
    <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
      <StoneTrailLogo className="shrink-0" />
      <div className="ml-auto flex items-center gap-2">
        <button onClick={onToggleArchive} className="inline-flex h-8 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] hover:border-[var(--text-muted,#6B645B)]">
          {archiveMode ? 'Exit archive' : 'Enter archive'}
        </button>
        <button onClick={onCreate} className="inline-flex h-8 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] hover:border-[var(--text-muted,#6B645B)]">
          <span className="mr-1">＋</span> New project
          <kbd className="ml-2 hidden lg:inline text-[10px] text-[var(--text-muted,#6B645B)]">⌘/Ctrl+N</kbd>
        </button>
      </div>
    </div>
  </div>
)

const FilterBar: React.FC<{
  projects: Project[]; q: string; setQ: (s: string) => void; client: string; setClient: (s: string) => void; tags: string[]; setTags: (t: string[]) => void;
}> = ({ projects, q, setQ, client, setClient, tags, setTags }) => {
  const clients = useMemo(() => unique(projects.map((p) => p.client)), [projects])
  const allTags = useMemo(() => unique(projects.flatMap((p) => p.tags || [])), [projects])
  const [tagSearch, setTagSearch] = React.useState('')
  const visibleTags = useMemo(() => {
    if (!tagSearch) return allTags
    const s = tagSearch.toLowerCase()
    return allTags.filter((t) => t.toLowerCase().includes(s))
  }, [allTags, tagSearch])

  return (
    <div className="mb-8">
      {/* Single row with compact tag area and improved tag search */}
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title…"
          className="h-9 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[12px] outline-none placeholder:text-[var(--text-muted,#6B645B)]"
        />
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="h-9 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[12px] outline-none"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Better looking tag search */}
        <div className="relative">
          <input
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            placeholder="Find tag…"
            className="h-9 w-[160px] rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 pr-6 text-[12px] outline-none placeholder:text-[var(--text-muted,#6B645B)]"
          />
          {tagSearch && (
            <button
              onClick={() => setTagSearch('')}
              aria-label="Clear tag search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted,#6B645B)]"
            >
              ×
            </button>
          )}
        </div>

        {/* Compact, horizontally scrollable tag strip (expanded) */}
        <div className="flex-1 min-w-[200px] rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 h-9 flex items-center">
          <div className="flex gap-1 overflow-x-auto w-full whitespace-nowrap py-1">
            {visibleTags.length ? (
              visibleTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${tags.includes(t) ? 'bg-[var(--basalt-700,#4A463F)] text-white border-transparent' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text-muted,#6B645B)]'}`}
                >
                  {t}
                </button>
              ))
            ) : (
              <span className="text-[12px] text-[var(--text-muted,#6B645B)]">No tags</span>
            )}
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

  const [q, setQ] = useState(''); const [client, setClient] = useState(''); const [tags, setTags] = useState<string[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const { archived, isArchived, archive, unarchive } = useArchive()
  const [archiveMode, setArchiveMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t) }, [])

  const { data: apiProjects, isLoading: loadingProjects, isError: projectsError, error: projectsErrorObj } = useQuery<ProjectApiResponse[], Error>({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  // Local overlays for edits so tags and other changes reflect immediately
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Project>>>({})

  const dynamicProjects = useMemo<Project[]>(() => {
    if (!apiProjects) return []
    return apiProjects.map((proj) => {
      const previewImages = (proj.preview_images || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((img, idx) => {
          const url = withBase(img.thumb_url)
          if (!url) return null
          return {
            assetId: img.asset_id,
            url,
            order: idx,
            width: img.width ?? null,
            height: img.height ?? null,
          }
        })
        .filter((img): img is NonNullable<typeof img> => Boolean(img))

      const primaryPreview = previewImages[0]?.url ?? null

      const derivedAspect = (() => {
        const candidate = previewImages.find((img) => (img.width ?? 0) > 0 && (img.height ?? 0) > 0)
        if (!candidate) return 'portrait' as Project['aspect']
        const w = candidate.width ?? 0
        const h = candidate.height ?? 0
        if (w === h) return 'square'
        return w > h ? 'landscape' : 'portrait'
      })()

      return {
        id: proj.id,
        title: proj.title,
        client: proj.client ?? 'Unassigned',
        note: proj.note,
        aspect: derivedAspect,
        image: primaryPreview,
        previewImages,
        tags: [],
        assetCount: proj.asset_count,
        createdAt: proj.created_at,
        updatedAt: proj.updated_at,
        source: 'api',
      }
    })
  }, [apiProjects])

  const baseProjects = useMemo(() => {
    const combined = [...dynamicProjects, ...PROJECTS]
    return combined.map((p) => ({ ...p, ...(localEdits[p.id] || {}) }))
  }, [dynamicProjects, localEdits])

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
  const filtered = useMemo(() => visible.filter((p) =>
      (!q || p.title.toLowerCase().includes(q.toLowerCase())) && (!client || p.client === client) && (!tags.length || (p.tags || []).some((t) => tags.includes(t)))),
    [q, client, tags, visible])

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

  const onOpen = (id: string) => { update(id); navigate(`/projects/${id}`) }
  const onArchive = (id: string) => archive(id)
  const onUnarchive = (id: string) => unarchive(id)

  const [editOpen, setEditOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const openEditor = (p: Project) => { setEditProject(p); setEditOpen(true) }
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

  const handleToggleArchive = () => setArchiveMode(a => !a)
  const hasAnyFilters = Boolean(q || client || tags.length)
  const clearFilters = () => { setQ(''); setClient(''); setTags([]) }
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
        <AppBar onCreate={openCreateModal} onToggleArchive={handleToggleArchive} archiveMode={archiveMode} />
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

        {!archiveMode && <FilterBar projects={baseProjects} q={q} setQ={setQ} client={client} setClient={setClient} tags={tags} setTags={setTags} />}
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

        <EditModal
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
    </div>
  )
}
