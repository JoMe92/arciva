import React, { useEffect, useMemo, useState } from 'react';
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

  const previews = useMemo(() => {
    if (!project?.previewImages?.length) return [];
    return [...project.previewImages].sort((a, b) => a.order - b.order);
  }, [project]);

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
      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium text-[var(--text,#1F1E1B)]">Preview images</h3>
        {previews.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previews.map((img, idx) => {
              const key = img.assetId ?? `${img.url}-${idx}`;
              const isPrimary = idx === 0;
              return (
                <div key={key} className="group relative overflow-hidden rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                  {img.url ? (
                    <img src={img.url} alt={`${project.title} preview ${idx + 1}`} className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center text-[10px] text-[var(--text-muted,#6B645B)]">
                      No preview
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/45 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
                    <span>{isPrimary ? 'Primary' : `Preview ${idx + 1}`}</span>
                    <span className="text-[10px] font-medium text-white/80">
                      {img.width && img.height ? `${img.width}×${img.height}` : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">
            Pick images in the project workspace to feature them on the project card.
          </p>
        )}
      </div>
    </ModalShell>
  );
};

export default EditModal;
