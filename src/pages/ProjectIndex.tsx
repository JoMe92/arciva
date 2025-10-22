// File: src/pages/ProjectIndex.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
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

const AppBar: React.FC<{ onCreate: () => void; onToggleArchive: () => void; archiveMode: boolean }> = ({
  onCreate,
  onToggleArchive,
  archiveMode,
}) => (
  <div className="sticky top-0 z-40 border-b border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]/90 backdrop-blur">
    <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
          <StoneTrailIcon size={18} />
        </span>
        <span className="text-sm font-medium text-[var(--text,#1F1E1B)]">Stone Trail</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onToggleArchive}
          className="inline-flex h-8 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] hover:border-[var(--text-muted,#6B645B)]"
        >
          {archiveMode ? 'Exit archive' : 'Enter archive'}
        </button>
        <button
          onClick={onCreate}
          className="inline-flex h-8 items-center rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] hover:border-[var(--text-muted,#6B645B)]"
        >
          <span className="mr-1">＋</span> New project
          <kbd className="ml-2 hidden lg:inline text-[10px] text-[var(--text-muted,#6B645B)]">⌘/Ctrl+N</kbd>
        </button>
      </div>
    </div>
  </div>
)

const FilterBar: React.FC<{
  projects: Project[]
  q: string
  setQ: (s: string) => void
  client: string
  setClient: (s: string) => void
  tags: string[]
  setTags: (t: string[]) => void
}> = ({ projects, q, setQ, client, setClient, tags, setTags }) => {
  const clients = useMemo(() => unique(projects.map((p) => p.client)), [projects])
  const allTags = useMemo(() => unique(projects.flatMap((p) => p.tags || [])), [projects])
  return (
    <div className="mb-8 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title…"
          className="h-8 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[12px] outline-none placeholder:text-[var(--text-muted,#6B645B)]"
        />
        <select
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="h-8 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[12px] outline-none"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-1">
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              className={`px-2 py-1 rounded-full text-[11px] border ${
                tags.includes(t)
                  ? 'bg-[var(--basalt-700,#4A463F)] text-white border-transparent'
                  : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text-muted,#6B645B)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProjectIndex() {
  const [ready, setReady] = useState(false)
  const { update } = useLastOpened()

  const [q, setQ] = useState('')
  const [client, setClient] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const { archived, isArchived, archive, unarchive } = useArchive()
  const [archiveMode, setArchiveMode] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
  }, [])

  const allTags = useMemo(() => unique(PROJECTS.flatMap((p) => p.tags || [])), [])
  const visible = useMemo(
    () => PROJECTS.filter((p) => (archiveMode ? isArchived(p.id) : !isArchived(p.id))),
    [archiveMode, archived] // archived triggers recompute when set changes
  )
  const filtered = useMemo(
    () =>
      visible.filter(
        (p) =>
          (!q || p.title.toLowerCase().includes(q.toLowerCase())) &&
          (!client || p.client === client) &&
          (!tags.length || (p.tags || []).some((t) => tags.includes(t)))
      ),
    [q, client, tags, visible]
  )

  function createProject() {
    setModalOpen(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setModalOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onCreate = (name: string, desc: string, clientName: string, tgs: string[]) => {
    alert(`Created: ${name}\nClient: ${clientName}\nTags: ${tgs.join(', ') || '-'}\n${desc}`)
  }

  const onArchive = (id: string) => archive(id)
  const onUnarchive = (id: string) => unarchive(id)

  const [editOpen, setEditOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const openEditor = (p: Project) => {
    setEditProject(p)
    setEditOpen(true)
  }

  const handleToggleArchive = () => setArchiveMode((a) => !a)

  const hasAnyFilters = Boolean(q || client || tags.length)

  let body: React.ReactNode
  if (archiveMode) {
    if (archived.length === 0) {
      body = (
        <section role="status" aria-live="polite" className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-[var(--border,#E1D3B9)] bg-white p-6 sm:p-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
              <StoneTrailIcon size={24} />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--text,#1F1E1B)]">
              Your archive is empty
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted,#6B645B)]">
              Archived projects will live here. To archive, go to{' '}
              <span className="font-medium">Projects</span>, hover a card and click{' '}
              <span className="italic">Archive</span>, or open a project and use{' '}
              <span className="italic">Edit → Archive</span>.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setArchiveMode(false)}
                className="h-9 rounded-full bg-[var(--basalt-700,#4A463F)] text-white px-4 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus,#6B7C7A)]"
              >
                Back to Projects
              </button>
              {hasAnyFilters && (
                <button
                  onClick={() => {
                    setQ('')
                    setClient('')
                    setTags([])
                  }}
                  className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[12px]"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </section>
      )
    } else {
      body = (
        <ProjectGrid
          items={filtered}
          onOpen={(id) => {
            update(id)
            window.location.hash = `#/projects/${id}`
          }}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onCreate={createProject}
          archiveMode={archiveMode}
          onEdit={openEditor}
        />
      )
    }
  } else {
    body = (
      <>
        {filtered.length === 0 && hasAnyFilters && (
          <StateHint
            message="No projects match your filters."
            actionLabel={hasAnyFilters ? 'Clear filters' : undefined}
            onAction={() => {
              setQ('')
              setClient('')
              setTags([])
            }}
          />
        )}
        <ProjectGrid
          items={filtered}
          onOpen={(id) => {
            update(id)
            window.location.hash = `#/projects/${id}`
          }}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onCreate={createProject}
          archiveMode={archiveMode}
          onEdit={openEditor}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--surface-subtle,#FBF7EF)]">
      <div className="sticky top-0 z-40">
        <AppBar onCreate={createProject} onToggleArchive={handleToggleArchive} archiveMode={archiveMode} />
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

        {!archiveMode && (
          <FilterBar
            projects={PROJECTS}
            q={q}
            setQ={setQ}
            client={client}
            setClient={setClient}
            tags={tags}
            setTags={setTags}
          />
        )}

        {body}

        <EditModal
          open={editOpen}
          project={editProject}
          onClose={() => setEditOpen(false)}
          onSave={() => {
            setEditOpen(false)
          }}
          onOpen={(id) => {
            update(id)
            window.location.hash = `#/projects/${id}`
          }}
          archived={editProject ? isArchived(editProject.id) : false}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          existingTags={allTags}
        />
      </main>

      <CreateModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={onCreate} existingTags={allTags} />
    </div>
  )
}
