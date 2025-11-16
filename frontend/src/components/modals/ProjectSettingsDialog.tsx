import React, { useEffect, useMemo, useState, useId } from 'react'
import ModalShell from './ModalShell'
import ProjectFields from './ProjectFields'
import type { Project } from '../../features/projects/types'

export interface ProjectSettingsDialogProps {
  open: boolean
  project: Project | null
  onClose: () => void
  onSave: (p: Project) => void | Promise<void>
  onOpen?: (id: string) => void
  archived: boolean
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  existingTags: string[]
  onRequestDelete?: (project: Project) => void
}

/**
 * Modal for editing project level metadata. It can archive/unarchive,
 * delete (when supported) and returns updated project data to the caller.
 */
const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({
  open,
  project,
  onClose,
  onSave,
  onOpen,
  archived,
  onArchive,
  onUnarchive,
  existingTags,
  onRequestDelete,
}) => {
  const [title, setTitle] = useState(project?.title || '')
  const [desc, setDesc] = useState(project?.blurb || '')
  const [client, setClient] = useState(project?.client || '')
  const [selTags, setSelTags] = useState<string[]>(project?.tags || [])
  const [newTag, setNewTag] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const formId = useId()

  const previews = useMemo(() => {
    if (!project?.previewImages?.length) return []
    return [...project.previewImages].sort((a, b) => a.order - b.order)
  }, [project])

  // Synchronise state when project changes
  useEffect(() => {
    setTitle(project?.title || '')
    setDesc(project?.blurb || '')
    setClient(project?.client || '')
    setSelTags(project?.tags || [])
    setNewTag('')
    setTitleError(null)
    setSubmitError(null)
    setSaving(false)
  }, [project, open])

  if (!open || !project) return null

  const validateTitle = () => {
    if (!title.trim()) {
      setTitleError('Project name is required.')
      return false
    }
    setTitleError(null)
    return true
  }

  const handleTitleChange = (value: string) => {
    if (titleError) {
      setTitleError(null)
    }
    setTitle(value)
  }

  const save = async () => {
    if (!validateTitle()) return
    const trimmedDesc = desc.trim()
    const payload: Project = {
      ...project,
      title: title.trim(),
      blurb: trimmedDesc,
      note: trimmedDesc || null,
      client: client.trim() || 'Unassigned',
      tags: selTags,
    }
    try {
      setSubmitError(null)
      const maybePromise = onSave(payload)
      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
        setSaving(true)
        await maybePromise
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save project')
      return
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault()
    void save()
  }

  const archiveAction = archived ? () => onUnarchive(project.id) : () => onArchive(project.id)
  const canDelete = Boolean(onRequestDelete && project.source === 'api')

  return (
    <ModalShell
      title={`Edit — ${project.title}`}
      subtitle="Project settings"
      onClose={onClose}
      footerLeft={
        <>
          <button
            type="button"
            onClick={archiveAction}
            className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px]"
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
          {canDelete && onRequestDelete ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onRequestDelete(project)
              }}
              className="h-9 rounded-full border border-red-200 bg-red-50 px-4 text-[13px] text-red-700 hover:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            >
              Delete…
            </button>
          ) : null}
        </>
      }
      footerRight={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[13px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="h-9 rounded-full border border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] px-4 text-[13px] text-[var(--primary-contrast,#FFFFFF)] hover:bg-[var(--primary-strong,#8D5336)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Saving…' : 'Apply changes'}
          </button>
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(project.id)}
              className="h-9 rounded-full border border-transparent px-4 text-[13px] text-[var(--text,#1F1E1B)] hover:bg-[var(--surface,#FFFFFF)]/60"
            >
              Open
            </button>
          ) : null}
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-8">
        <ProjectFields
          title={title}
          setTitle={handleTitleChange}
          desc={desc}
          setDesc={setDesc}
          client={client}
          setClient={setClient}
          selTags={selTags}
          setSelTags={setSelTags}
          newTag={newTag}
          setNewTag={setNewTag}
          existingTags={existingTags}
          titleError={titleError}
        />
        {submitError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            {submitError}
          </div>
        ) : null}
        <section>
          <header className="mb-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Preview images</p>
            <p className="text-[12px] text-[var(--text-muted,#6B645B)]">Pick images in the project workspace to feature them on the project card.</p>
          </header>
          {previews.length ? (
            <div className="flex gap-3 overflow-x-auto rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-3">
              {previews.map((img, idx) => {
                const key = img.assetId ?? `${img.url}-${idx}`
                const isPrimary = idx === 0
                return (
                  <div
                    key={key}
                    className={`relative h-24 w-32 shrink-0 overflow-hidden rounded-xl border ${isPrimary ? 'border-[var(--primary,#A56A4A)]' : 'border-[var(--border,#E1D3B9)] opacity-90'}`}
                    title={isPrimary ? 'Current cover' : `Preview ${idx + 1}`}
                  >
                    {img.url ? (
                      <img src={img.url} alt={`${project.title} preview ${idx + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--text-muted,#6B645B)]">No preview</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                      {isPrimary ? 'Cover' : `#${idx + 1}`}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border,#E1D3B9)] px-4 py-6 text-center text-[12px] text-[var(--text-muted,#6B645B)]">
              No preview images yet.
            </div>
          )}
        </section>
        <button type="submit" className="sr-only">
          Save project
        </button>
      </form>
    </ModalShell>
  )
}

export default ProjectSettingsDialog
