import React, { useEffect, useMemo, useState } from 'react';
import ModalShell from './ModalShell';
import ProjectFields from './ProjectFields';
import type { Project, ProjectPreviewImage } from '../../features/projects/types';

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
  onSetPrimaryPreview?: (project: Project, preview: ProjectPreviewImage) => Promise<void>;
  previewBusy?: boolean;
  previewError?: string | null;
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
  onSetPrimaryPreview,
  previewBusy = false,
  previewError = null,
}) => {
  const [title, setTitle] = useState(project?.title || '');
  const [desc, setDesc] = useState(project?.blurb || '');
  const [client, setClient] = useState(project?.client || '');
  const [selTags, setSelTags] = useState<string[]>(project?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [pendingPreviewId, setPendingPreviewId] = useState<string | null>(null);

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
    setPendingPreviewId(null);
  }, [project]);

  const handleMakePrimary = async (img: ProjectPreviewImage) => {
    if (!project || !onSetPrimaryPreview) return;
    const key = img.assetId ?? img.url ?? '';
    if (!key) return;
    setPendingPreviewId(key);
    try {
      await onSetPrimaryPreview(project, img);
    } catch (err) {
      // parent handles error messaging; swallow to keep modal open
    } finally {
      setPendingPreviewId(null);
    }
  };

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
              const busyKey = img.assetId ?? img.url ?? '';
              const isBusy = previewBusy || (busyKey !== '' && busyKey === pendingPreviewId);
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
                    {!isPrimary && img.url ? (
                      <button
                        type="button"
                        className="rounded-full border border-white/60 px-2 py-0.5 text-[10px] font-medium text-white/90 hover:bg-white/20 disabled:opacity-60"
                        onClick={() => handleMakePrimary(img)}
                        disabled={isBusy}
                      >
                        {isBusy ? 'Updating…' : 'Set as cover'}
                      </button>
                    ) : (
                      <span className="text-[10px] font-medium text-white/80">Current</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">
            Mark preview images in the project workspace inspector to customise thumbnails.
          </p>
        )}
        {previewError ? (
          <p className="mt-2 text-[12px] text-red-600">{previewError}</p>
        ) : null}
      </div>
    </ModalShell>
  );
};

export default EditModal;
