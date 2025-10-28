import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import StoneTrailIcon from '../components/StoneTrailIcon'
import Splash from '../components/Splash'
import { Project } from '../features/projects/types'
import { unique } from '../features/projects/utils'
import { PROJECTS } from '../features/projects/data'
import { useArchive } from '../features/projects/archive'
import { useLastOpened } from '../features/projects/useLastOpened'
import ProjectGrid from '../components/ProjectGrid'
import StateHint from '../components/StateHint'
import CreateModal from '../components/modals/CreateModal'
import EditModal from '../components/modals/EditModal'
import { createProject, listProjects, type ProjectApiResponse } from '../shared/api/projects'

const AppBar: React.FC<{ onCreate: () => void; onToggleArchive: () => void; archiveMode: boolean }> = ({ onCreate, onToggleArchive, archiveMode }) => (
  <div className="sticky top-0 z-40 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur">
    <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
          <StoneTrailIcon size={18} />
        </span>
        <span className="text-sm font-medium text-[var(--text,#1F1E1B)]">Stone Trail</span>
      </div>
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
  return (
    <div className="mb-8 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title…" className="h-8 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[12px] outline-none placeholder:text-[var(--text-muted,#6B645B)]" />
        <select value={client} onChange={(e) => setClient(e.target.value)} className="h-8 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[12px] outline-none">
          <option value="">All clients</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-1">
          {allTags.map((t) => (
            <button key={t} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              className={`px-2 py-1 rounded-full text-[11px] border ${tags.includes(t) ? 'bg-[var(--basalt-700,#4A463F)] text-white border-transparent' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text-muted,#6B645B)]'}`}>
              {t}
            </button>
          ))}
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

  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t) }, [])

  const { data: apiProjects, isLoading: loadingProjects, isError: projectsError, error: projectsErrorObj } = useQuery<ProjectApiResponse[], Error>({
    queryKey: ['projects'],
    queryFn: listProjects,
  })

  const dynamicProjects = useMemo<Project[]>(() => {
    if (!apiProjects) return []
    return apiProjects.map((proj) => ({
      id: proj.id,
      title: proj.title,
      client: proj.client ?? 'Unassigned',
      note: proj.note,
      aspect: 'portrait',
      image: null,
      tags: [],
      assetCount: proj.asset_count,
      createdAt: proj.created_at,
      updatedAt: proj.updated_at,
      source: 'api',
    }))
  }, [apiProjects])

  const baseProjects = useMemo(() => [...dynamicProjects, ...PROJECTS], [dynamicProjects])

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

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (proj) => {
      setCreateError(null)
      closeCreateModal()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      const newId = proj.id
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

  const handleToggleArchive = () => setArchiveMode(a => !a)
  const hasAnyFilters = Boolean(q || client || tags.length)
  const clearFilters = () => { setQ(''); setClient(''); setTags([]) }

  return (
    <div className="min-h-screen bg-[var(--surface-subtle,#FBF7EF)]">
      <div className="sticky top-0 z-40">
        <AppBar onCreate={openCreateModal} onToggleArchive={handleToggleArchive} archiveMode={archiveMode} />
        <AnimatePresence>{!ready && <Splash />}</AnimatePresence>
      </div>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text,#1F1E1B)]">
            {archiveMode ? 'Archive' : 'Projects'}
          </h1>
          <p className="text-sm text-[var(--text-muted,#6B645B)]">
            {archiveMode ? 'Archived projects are hidden from the main view.' : 'Choose a project — the app is project-first.'}
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

        <ProjectGrid
          items={filtered}
          onOpen={onOpen}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onCreate={openCreateModal}
          archiveMode={archiveMode}
          onEdit={openEditor}
        />

        <EditModal
          open={editOpen}
          project={editProject}
          onClose={() => setEditOpen(false)}
          onSave={() => setEditOpen(false)}
          onOpen={(id) => { update(id); navigate(`/projects/${id}`) }}
          archived={editProject ? isArchived(editProject.id) : false}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          existingTags={allTags}
        />
      </main>

      <CreateModal
        open={modalOpen}
        onClose={closeCreateModal}
        onCreate={createProjectHandler}
        existingTags={allTags}
        busy={createMutation.isPending}
      />
    </div>
  )
}
