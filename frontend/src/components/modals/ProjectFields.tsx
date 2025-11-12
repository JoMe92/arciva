import React from 'react';

export interface ProjectFieldsProps {
  title: string;
  setTitle: (v: string) => void;
  desc: string;
  setDesc: (v: string) => void;
  client: string;
  setClient: (v: string) => void;
  selTags: string[];
  setSelTags: (v: string[]) => void;
  newTag: string;
  setNewTag: (v: string) => void;
  existingTags: string[];
}

/**
 * Shared form fields for both Create and Edit modals. Manages the
 * title, description, client and tag selection. Tag management
 * includes adding new tags and toggling existing ones.
 */
const ProjectFields: React.FC<ProjectFieldsProps> = ({
  title,
  setTitle,
  desc,
  setDesc,
  client,
  setClient,
  selTags,
  setSelTags,
  newTag,
  setNewTag,
  existingTags,
}) => {
  const toggleTag = (t: string) => {
    setSelTags(selTags.includes(t) ? selTags.filter(x => x !== t) : [...selTags, t]);
  };

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!existingTags.includes(t)) {
      existingTags.push(t);
    }
    if (!selTags.includes(t)) {
      setSelTags([...selTags, t]);
    }
    setNewTag('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="block text-xs text-[var(--text-muted,#6B645B)] md:col-span-2">
        Project name
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-sm"
          placeholder="Untitled project"
        />
      </label>
      <label className="block text-xs text-[var(--text-muted,#6B645B)] md:col-span-2">
        Description (optional)
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-sm"
          placeholder="Short note"
        />
      </label>
      <label className="block text-xs text-[var(--text-muted,#6B645B)]">
        Client
        <input
          value={client}
          onChange={e => setClient(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-sm"
          placeholder="Client name"
        />
      </label>
      <div className="text-xs text-[var(--text-muted,#6B645B)]">
        <div className="mb-1">Tags</div>
        <div className="aspect-square rounded-xl border border-[var(--border,#E1D3B9)] p-2 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {existingTags.map(t => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`px-2 py-1 rounded-full text-[11px] border ${
                  selTags.includes(t)
                    ? 'bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)] border-[var(--primary,#A56A4A)]'
                    : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text-muted,#6B645B)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add new tag"
            className="h-8 flex-1 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 text-[12px] outline-none"
          />
          <button onClick={addTag} className="h-8 px-3 rounded-full border border-[var(--border,#E1D3B9)] text-[12px]">
            Add
          </button>
        </div>
        {selTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selTags.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-[var(--sand-500,#D7C5A6)] text-[11px]">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectFields;
