import React, { useState } from 'react'
import ModalShell from './ModalShell'
import ProjectFields from './ProjectFields'

export interface CreateModalProps {
  open: boolean
  onClose: () => void
  onCreate: (title: string, desc: string, client: string, tags: string[]) => void
  existingTags: string[]
  busy?: boolean
}

const CreateModalContent: React.FC<Omit<CreateModalProps, 'open'>> = ({
  onClose,
  onCreate,
  existingTags,
  busy = false,
}) => {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [client, setClient] = useState('')
  const [selTags, setSelTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)

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

  const submit = () => {
    if (busy || !validateTitle()) return
    onCreate(title.trim(), desc.trim(), client.trim() || 'Unassigned', selTags)
  }

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault()
    submit()
  }

  return (
    <ModalShell
      title="New project"
      subtitle="Project settings"
      onClose={onClose}
      onPrimary={submit}
      primaryLabel={busy ? 'Creating…' : 'Create project'}
      primaryDisabled={busy}
    >
      <form onSubmit={handleSubmit} className="space-y-8">
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
        <section>
          <header className="mb-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
              Preview images
            </p>
            <p className="text-[12px] text-[var(--text-muted,#6B645B)]">
              Pick images in the project workspace to feature them on the project card.
            </p>
          </header>
          <div className="rounded-2xl border border-dashed border-[var(--border,#E1D3B9)] px-4 py-6 text-center text-[12px] text-[var(--text-muted,#6B645B)]">
            Preview images will appear here once a project is created and images are selected inside
            its workspace.
          </div>
        </section>
        <button type="submit" className="sr-only">
          Create project
        </button>
      </form>
    </ModalShell>
  )
}

/**
 * Modal for creating a new project. It collects title, description,
 * client and tag information and passes the values to the onCreate
 * handler. The modal remains mounted only when open is true.
 */
const CreateModal: React.FC<CreateModalProps> = (props) => {
  if (!props.open) return null
  const { open: _open, ...rest } = props
  return <CreateModalContent {...rest} />
}

export default CreateModal
