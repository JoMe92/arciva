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
  titleError?: string | null;
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
  titleError,
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
    <div className="space-y-8">
      <section>
        <header className="mb-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Project details</p>
        </header>
        <div className="space-y-4">
          <label className="block text-[13px] font-medium text-[var(--text,#1F1E1B)]">
            Project name
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoFocus
              className={`mt-1 w-full rounded-2xl border bg-[var(--surface,#FFFFFF)] px-4 py-3 text-[14px] outline-none transition-colors ${
                titleError ? 'border-red-300 focus-visible:border-red-400 focus-visible:ring-1 focus-visible:ring-red-200' : 'border-[var(--border,#E1D3B9)] focus-visible:border-[var(--text,#1F1E1B)] focus-visible:ring-1 focus-visible:ring-[var(--text-muted,#6B645B)]/30'
              }`}
              placeholder="Project name"
            />
          </label>
          {titleError && <p className="text-[12px] text-red-600">{titleError}</p>}
          <label className="block text-[13px] font-medium text-[var(--text,#1F1E1B)]">
            Description <span className="text-[var(--text-muted,#6B645B)] font-normal">(optional)</span>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-3 text-[14px] outline-none focus-visible:border-[var(--text,#1F1E1B)] focus-visible:ring-1 focus-visible:ring-[var(--text-muted,#6B645B)]/30"
              placeholder="What makes this project special?"
            />
          </label>
          <label className="block text-[13px] font-medium text-[var(--text,#1F1E1B)]">
            Client
            <input
              value={client}
              onChange={e => setClient(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-3 text-[14px] outline-none focus-visible:border-[var(--text,#1F1E1B)] focus-visible:ring-1 focus-visible:ring-[var(--text-muted,#6B645B)]/30"
              placeholder="Client name"
            />
          </label>
        </div>
      </section>

      <section>
        <header className="mb-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Tags</p>
          <p className="text-[12px] text-[var(--text-muted,#6B645B)]">Add tags to categorize and find this project faster.</p>
        </header>
        <div className="rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] p-3">
          {existingTags.length ? (
            <div className="flex flex-wrap gap-2">
              {existingTags.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    selTags.includes(t)
                      ? 'border-[var(--primary,#A56A4A)] bg-[var(--primary,#A56A4A)] text-[var(--primary-contrast,#FFFFFF)]'
                      : 'border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[var(--text-muted,#6B645B)] hover:border-[var(--text,#1F1E1B)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[var(--text-muted,#6B645B)]">No tags yet.</p>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex-1 text-[12px] font-medium text-[var(--text,#1F1E1B)] sm:font-normal">
            <span className="sr-only">New tag</span>
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
              className="h-10 w-full rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 text-[13px] outline-none focus-visible:border-[var(--text,#1F1E1B)] focus-visible:ring-1 focus-visible:ring-[var(--text-muted,#6B645B)]/30"
            />
          </label>
          <button
            type="button"
            onClick={addTag}
            className="h-10 rounded-full border border-[var(--border,#E1D3B9)] px-4 text-[12px] font-medium text-[var(--text,#1F1E1B)] hover:border-[var(--text,#1F1E1B)]"
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
};

export default ProjectFields;
