import React, { useEffect, useMemo, useState } from 'react'
import ModalShell from './ModalShell'
import type { Project } from '../../features/projects/types'

type DeleteModalProps = {
  open: boolean
  project: Project | null
  onClose: () => void
  onConfirm: (payload: { confirmTitle: string; deleteAssets: boolean }) => void
  busy?: boolean
  error?: string | null
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  open,
  project,
  onClose,
  onConfirm,
  busy = false,
  error = null,
}) => {
  const [confirmation, setConfirmation] = useState('')
  const [deleteAssets, setDeleteAssets] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmation('')
      setDeleteAssets(false)
    }
  }, [open, project?.id])

  const normalizedTitle = useMemo(
    () => (project?.title ? project.title.trim() : ''),
    [project?.title]
  )

  if (!open || !project) return null
  const confirmationMatches = confirmation.trim() === normalizedTitle

  const submit = () => {
    if (busy || !confirmationMatches) return
    onConfirm({ confirmTitle: confirmation.trim(), deleteAssets })
  }

  return (
    <ModalShell
      title="Delete project"
      onClose={busy ? () => {} : onClose}
      onPrimary={submit}
      primaryLabel={busy ? 'Deleting…' : 'Delete project'}
      primaryDisabled={!confirmationMatches || busy}
      headerRight={
        <span className="rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-0.5 text-[11px] text-[var(--text-muted,#6B645B)]">
          {project.assetCount ?? 0} image{(project.assetCount ?? 0) === 1 ? '' : 's'}
        </span>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <p className="font-medium">This action cannot be undone.</p>
          <p>
            Deleting <strong>{project.title}</strong> removes it from the project list.
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-[12px] font-medium text-[var(--text,#1F1E1B)]">
            Type <span className="font-semibold">&ldquo;{normalizedTitle}&rdquo;</span> to confirm
          </label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
            placeholder={normalizedTitle}
            className="w-full rounded-lg border border-[var(--border,#E1D3B9)] px-3 py-2 text-[13px] outline-none focus-visible:border-red-400 focus-visible:ring-1 focus-visible:ring-red-200"
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[12px] font-medium text-[var(--text,#1F1E1B)]">
            Images linked to this project
          </legend>
          <label className="flex items-start gap-2 rounded-lg border border-[var(--border,#E1D3B9)] px-3 py-2 text-[12px] hover:border-[var(--text-muted,#6B645B)]">
            <input
              type="radio"
              name="delete-assets"
              value="keep"
              checked={!deleteAssets}
              disabled={busy}
              onChange={() => setDeleteAssets(false)}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-[var(--text,#1F1E1B)]">
                Keep images in the image hub
              </div>
              <div className="text-[11px] text-[var(--text-muted,#6B645B)]">
                You can still reuse them in other projects later.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-[var(--border,#E1D3B9)] px-3 py-2 text-[12px] hover:border-red-300">
            <input
              type="radio"
              name="delete-assets"
              value="delete"
              checked={deleteAssets}
              disabled={busy}
              onChange={() => setDeleteAssets(true)}
              className="mt-0.5"
            />
            <div>
              <div className="font-medium text-red-700">Delete images permanently</div>
              <div className="text-[11px] text-red-600">
                Images will be removed from the hub when no other project uses them.
              </div>
            </div>
          </label>
        </fieldset>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

export default DeleteModal
