import React, { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import ProjectFields from './ProjectFields';
import type { Project } from '../../features/projects/types';

export interface EditModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (p: Project) => void;
  onOpen: (id: string) => void;
  archived: boolean;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  existingTags: string[];
}

/**
 * Modal for editing an existing project. It mirrors the structure of
 * the CreateModal but also offers options to archive/unarchive and
 * apply changes. The primary action opens the project in the editor.
 */
const EditModal: React.FC<EditModalProps> = ({
  open,
  project,
  onClose,
  onSave,
  onOpen,
  archived,
  onArchive,
  onUnarchive,
  existingTags,
}) => {
  const [title, setTitle] = useState(project?.title || '');
  const [desc, setDesc] = useState(project?.blurb || '');
  const [client, setClient] = useState(project?.client || '');
  const [selTags, setSelTags] = useState<string[]>(project?.tags || []);
  const [newTag, setNewTag] = useState('');

  // Synchronise state when project changes
  useEffect(() => {
    setTitle(project?.title || '');
    setDesc(project?.blurb || '');
    setClient(project?.client || '');
    setSelTags(project?.tags || []);
  }, [project]);

  if (!open || !project) return null;

  const save = () => {
    onSave({
      ...project,
      title: title || 'Untitled project',
      blurb: desc || 'New project',
      client: client || 'Unassigned',
      tags: selTags,
    });
  };

  return (
    <ModalShell
      title={`Edit — ${project.title}`}
      onClose={onClose}
      onPrimary={() => onOpen(project.id)}
      primaryLabel="Open"
      footerLeft={
        <>
          <button onClick={save} className="h-8 rounded-full border border-[var(--border,#E1D3B9)] px-3 text-[12px]">
            Apply changes
          </button>
          {archived ? (
            <button onClick={() => onUnarchive(project.id)} className="h-8 rounded-full border border-[var(--border,#E1D3B9)] px-3 text-[12px]">
              Unarchive
            </button>
          ) : (
            <button onClick={() => onArchive(project.id)} className="h-8 rounded-full border border-[var(--border,#E1D3B9)] px-3 text-[12px]">
              Archive
            </button>
          )}
        </>
      }
    >
      <ProjectFields
        title={title}
        setTitle={setTitle}
        desc={desc}
        setDesc={setDesc}
        client={client}
        setClient={setClient}
        selTags={selTags}
        setSelTags={setSelTags}
        newTag={newTag}
        setNewTag={setNewTag}
        existingTags={existingTags}
      />
    </ModalShell>
  );
};

export default EditModal;