import React, { memo, useMemo, useCallback } from 'react'

// ActionGrid25 – Data-related actions only (Case 1)
// Self‑contained: no external deps; production‑ready structure, a11y, and lightweight styling.

// -----------------------------
// Types
// -----------------------------
export type Variant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'ghost'
export type Tone =
  | 'copper'
  | 'sand'
  | 'bronze'
  | 'leather'
  | 'cocoa'
  | 'umber'
  | 'moss'
  | 'fern'
  | 'olive'
  | 'sage'
  | 'gold'
  | 'amber'
  | 'rose'
  | 'brick'
  | 'wine'
  | 'stone'
  | 'slate'
  | 'ash'
  | 'cloud'
  | 'ink'
  | 'latte'
  | 'dune'
  | 'wheat'

export interface ActionItem {
  id: string
  label: string
  variant?: Variant
  disabled?: boolean
  tone?: Tone
}

interface ButtonProps {
  label: string
  variant?: Variant
  disabled?: boolean
  onClick?: () => void
  testId?: string
  icon?: React.ReactNode
  tone?: Tone
}

// -----------------------------
// Helpers
// -----------------------------
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

const Button = memo(function Button({
  label,
  variant = 'secondary',
  disabled,
  onClick,
  testId,
  icon,
  tone,
}: ButtonProps) {
  const className = useMemo(
    () =>
      cx('btn', `btn--${variant}`, tone ? `btn--tone-${tone}` : null, disabled && 'is-disabled'),
    [variant, tone, disabled]
  )
  const handleClick = useCallback(() => {
    if (!disabled) onClick?.()
  }, [disabled, onClick])

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId}
    >
      {icon && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="btn__label">{label}</span>
    </button>
  )
})

// -----------------------------
// Data Actions (Case 1)
// -----------------------------
const ACTIONS: ActionItem[] = [
  { id: 'upload', label: 'Upload', variant: 'primary' },
  { id: 'import-folder', label: 'Import Folder', variant: 'primary' },
  { id: 'new-project', label: 'New Project', variant: 'primary' },
  { id: 'open-file', label: 'Open File', variant: 'primary' },
  { id: 'save', label: 'Save', variant: 'primary' },
  { id: 'save-as', label: 'Save As', variant: 'primary' },
  { id: 'download', label: 'Download', variant: 'primary' },
  { id: 'export', label: 'Export', variant: 'primary' },
  { id: 'share', label: 'Share', variant: 'primary' },
  { id: 'print', label: 'Print', variant: 'primary' },
  { id: 'duplicate', label: 'Duplicate', variant: 'primary' },
  { id: 'move', label: 'Move', variant: 'primary' },
  { id: 'rename', label: 'Rename', variant: 'primary' },
  { id: 'delete', label: 'Delete', variant: 'primary' },
  { id: 'restore', label: 'Restore', variant: 'primary' },
  { id: 'search', label: 'Search', variant: 'primary' },
  { id: 'sort', label: 'Sort', variant: 'primary' },
]

// -----------------------------
// Icons (inline SVG)
// -----------------------------
const Svg: React.FC<{ path: React.ReactNode; viewBox?: string }> = ({
  path,
  viewBox = '0 0 24 24',
}) => (
  <svg
    width="18"
    height="18"
    viewBox={viewBox}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    focusable="false"
  >
    {path}
  </svg>
)

const ICONS: Record<string, React.ReactNode> = {
  upload: (
    <Svg
      path={
        <>
          <path d="M12 16V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M8.5 7.5 12 4l3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      }
    />
  ),
  'import-folder': (
    <Svg
      path={
        <>
          <path
            d="M4 7h6l2 3h8v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      }
    />
  ),
  download: (
    <Svg
      path={
        <>
          <path d="M12 4v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M8.5 12.5 12 16l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      }
    />
  ),
  export: (
    <Svg
      path={
        <>
          <rect x="4" y="5" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14 7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10 12l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      }
    />
  ),
  settings: (
    <Svg
      path={
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-3.5c0 .35-.03.69-.1 1.02l1.9 1.1-2 3.48-2.4-1a7.6 7.6 0 0 1-1.8 1.12l-.3 2.58H9.1l-.3-2.58a7.6 7.6 0 0 1-1.8-1.12l-2.4 1-2-3.48 2-1.1A7.5 7.5 0 0 1 4.5 12c0-.35.03-.69.1-1.02l-1.9-1.1 2-3.48 2.4 1c.55-.48 1.16-.85 1.8-1.12l.3-2.58h4.9l.3 2.58c.64.27 1.25.64 1.8 1.12l2.4-1 2 3.48-1.9 1.1c.07.33.1.67.1 1.02Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
      }
    />
  ),
  'new-project': (
    <Svg
      path={
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      }
    />
  ),
  'open-file': (
    <Svg
      path={
        <>
          <path
            d="M8 4h5l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M13 4v5h5" stroke="currentColor" strokeWidth="1.6" />
        </>
      }
    />
  ),
  save: (
    <Svg
      path={
        <>
          <path d="M12 4v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M8.5 8.5 12 11.9l3.5-3.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect x="4" y="14" width="16" height="6" rx="3" stroke="currentColor" strokeWidth="1.6" />
        </>
      }
    />
  ),
  'save-as': (
    <Svg
      path={
        <>
          <path
            d="M5 7h10l4 4v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M13 7v4h4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 15h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      }
    />
  ),
  edit: (
    <Svg
      path={
        <path
          d="M4 16.5 6.5 19 19 6.5 16.5 4 4 16.5Zm0 0V20h3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      }
    />
  ),
  crop: (
    <Svg
      path={
        <path
          d="M7 3v12h12M3 7h12v12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      }
    />
  ),
  rotate: (
    <Svg
      path={
        <>
          <path d="M16 3v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M20 7a8 8 0 1 0 2.2 5.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </>
      }
    />
  ),
  filter: (
    <Svg
      path={
        <path
          d="M4 5h16l-6 7v5l-4 2V12L4 5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      }
    />
  ),
  adjust: (
    <Svg
      path={
        <>
          <path d="M5 7h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="9" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="14" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="11" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </>
      }
    />
  ),
  favorite: (
    <Svg
      path={
        <path
          d="M12 4l2.3 4.7 5.2.8-3.8 3.7.9 5.2L12 16.8 7.4 18.4l.9-5.2L4.5 9.5l5.2-.8L12 4Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="currentColor"
        />
      }
    />
  ),
  delete: (
    <Svg
      path={
        <path
          d="M5 7h14M10 7v12m4-12v12M8 7l.8-2h6.4L16 7M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      }
    />
  ),
  restore: (
    <Svg
      path={
        <>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M7 7v4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      }
    />
  ),
  share: (
    <Svg
      path={
        <>
          <circle cx="7" cy="12" r="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="17" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8.7 11l5-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M8.9 13.1l6.6 3.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  print: (
    <Svg
      path={
        <>
          <rect x="6" y="3" width="12" height="6" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <rect x="5" y="9" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <rect x="7" y="15" width="10" height="6" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="16.5" cy="12.5" r="1" fill="currentColor" />
        </>
      }
    />
  ),
  duplicate: (
    <Svg
      path={
        <>
          <rect x="8" y="8" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <rect x="4" y="4" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
        </>
      }
    />
  ),
  move: (
    <Svg
      path={
        <>
          <path
            d="M12 3v18M3 12h18"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </>
      }
    />
  ),
  rename: (
    <Svg
      path={
        <>
          <path d="M4 16.5 6.5 19 19 6.5 16.5 4 4 16.5Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M4 16.5V20h3.5" stroke="currentColor" strokeWidth="1.6" />
        </>
      }
    />
  ),
  search: (
    <Svg
      path={
        <>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      }
    />
  ),
  sort: (
    <Svg
      path={
        <>
          <path
            d="M7 6h10M7 12h7M7 18h4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  help: (
    <Svg
      path={
        <>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M9.8 9a2.2 2.2 0 1 1 4.4 0c0 1.6-2.2 2.2-2.2 3.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </>
      }
    />
  ),
}

const iconFor = (id: string) => ICONS[id] ?? null

// -----------------------------
// Component
// -----------------------------
export default function ActionGrid25() {
  const onAction = useCallback((id: string) => {
    // Replace this with real logic. For now, it is a safe no-op with a console line.
     
    console.log(`[Action] ${id}`)
  }, [])

  return (
    <section className="action-grid" aria-label="Action grid for data actions">
      <header className="grid__header">
        <h2 className="grid__title">Data Actions</h2>
        <p className="grid__hint" role="note">
          Keyboard accessible – use Tab/Shift+Tab to navigate, Enter/Space to activate.
        </p>
      </header>

      <div
        className="grid"
        role="grid"
        aria-rowcount={Math.ceil(ACTIONS.length / 5)}
        aria-colcount={5}
        data-testid="action-grid"
      >
        {ACTIONS.map((a, idx) => (
          <div
            key={a.id}
            className="grid__cell"
            role="gridcell"
            aria-colindex={(idx % 5) + 1}
            aria-rowindex={Math.floor(idx / 5) + 1}
          >
            <Button
              label={a.label}
              variant={a.variant}
              disabled={a.disabled}
              onClick={() => onAction(a.id)}
              testId={`btn-${a.id}`}
              icon={iconFor(a.id)}
              tone={a.tone}
            />
          </div>
        ))}
      </div>

      <style>{styles}</style>
    </section>
  )
}

// -----------------------------
// Lightweight runtime checks (dev-only) – "test cases"
// -----------------------------
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  const ids = ACTIONS.map((a) => a.id)
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
     
    console.warn('[ActionGrid25][test] Duplicate IDs detected', ids)
  }
  const allHaveLabels = ACTIONS.every((a) => typeof a.label === 'string' && a.label.length > 0)
  if (!allHaveLabels) {
     
    console.warn('[ActionGrid25][test] Some actions have missing labels')
  }
  const validTones: Tone[] = [
    'copper',
    'sand',
    'bronze',
    'leather',
    'cocoa',
    'umber',
    'moss',
    'fern',
    'olive',
    'sage',
    'gold',
    'amber',
    'rose',
    'brick',
    'wine',
    'stone',
    'slate',
    'ash',
    'cloud',
    'ink',
    'latte',
    'dune',
    'wheat',
  ]
  const toneIssues = ACTIONS.filter((a) => a.tone && !validTones.includes(a.tone))
  if (toneIssues.length) {
     
    console.warn('[ActionGrid25][test] Unknown tones:', toneIssues)
  }
}

// -----------------------------
// Styles – semantic tokens + grid layout
// -----------------------------
const styles = `
:root {
  --text: #1F1E1B;
  --text-muted: #6B645B;
  --surface: #FFFFFF;
  --surface-subtle: #FBF7EF;
  --border: #EDE1C6;

  --primary: #E6D3B8;
  --primary-contrast: #2F261C;
  --accent: #D7C5A6;

  --danger:  #C73A37;
  --ink: #4A463F;

  --primary-hover: #DFC6A1;
  --primary-active: #D4B487;
  --border-strong: #CBB58F;
  --focus-ring: #1A73E8;

  --success: #34B37A;
  --warning: #E4AD07;
}

.action-grid {
  color: var(--text);
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  max-width: 880px;
  margin: 24px auto;
}

.grid__header { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin-bottom:12px; }
.grid__title { margin:0; font-size:16px; font-weight:600; }
.grid__hint { margin:0; font-size:12px; color: var(--text-muted); }

.grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
}

.grid__cell { min-height: 56px; display:flex; }

/* Button primitive */
.btn {
  --btn-bg: var(--surface);
  --btn-fg: var(--text);
  --btn-bd: var(--border);
  --btn-bg-hover: var(--surface);
  --btn-bg-active: var(--surface);

  appearance: none;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1;
  background: var(--btn-bg);
  color: var(--btn-fg);
  border: 1px solid var(--btn-bd);
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
  transition: background-color .15s ease, color .15s ease, border-color .15s ease, transform .02s ease;
}
.btn:focus { outline: none; }
.btn:focus-visible { box-shadow: 0 0 0 3px color-mix(in oklab, var(--focus-ring) 30%, transparent); }
.btn:active { transform: translateY(1px); }
.btn.is-disabled, .btn:disabled { opacity: .6; cursor: not-allowed; }
.btn__icon { display:inline-flex; }
.btn__icon svg { display:block; }
.btn__label { white-space: nowrap; }

/* Variants */
.btn--primary {
  --btn-bg: var(--primary);
  --btn-fg: var(--primary-contrast);
  --btn-bd: var(--primary);
  --btn-bg-hover: var(--primary-hover);
  --btn-bg-active: var(--primary-active);
}
.btn--primary:hover { background: var(--btn-bg-hover); }
.btn--primary:active { background: var(--btn-bg-active); }

.btn--secondary {
  --btn-bg: var(--surface);
  --btn-fg: var(--text);
  --btn-bd: var(--border);
  --btn-bg-hover: color-mix(in oklab, var(--surface) 92%, var(--ink));
  --btn-bg-active: color-mix(in oklab, var(--surface) 86%, var(--ink));
}
.btn--secondary:hover { background: var(--btn-bg-hover); }
.btn--secondary:active { background: var(--btn-bg-active); }

.btn--accent {
  --btn-bg: var(--accent);
  --btn-fg: #3A2F23;
  --btn-bd: var(--border-strong);
  --btn-bg-hover: color-mix(in oklab, var(--accent) 92%, var(--ink));
  --btn-bg-active: color-mix(in oklab, var(--accent) 84%, var(--ink));
}
.btn--accent:hover { background: var(--btn-bg-hover); }
.btn--accent:active { background: var(--btn-bg-active); }

.btn--destructive {
  --btn-bg: var(--danger);
  --btn-fg: #FFFFFF;
  --btn-bd: var(--danger);
  --btn-bg-hover: color-mix(in oklab, var(--danger) 92%, black);
  --btn-bg-active: color-mix(in oklab, var(--danger) 84%, black);
}
.btn--destructive:hover { background: var(--btn-bg-hover); }
.btn--destructive:active { background: var(--btn-bg-active); }

.btn--ghost {
  --btn-bg: transparent;
  --btn-fg: var(--ink);
  --btn-bd: transparent;
  --btn-bg-hover: color-mix(in oklab, var(--surface) 86%, var(--ink));
  --btn-bg-active: color-mix(in oklab, var(--surface) 80%, var(--ink));
}
.btn--ghost:hover { background: var(--btn-bg-hover); }
.btn--ghost:active { background: var(--btn-bg-active); }

/* Tones (per-button colors within CI) */
/* earth/brand tints */
.btn--tone-copper { --btn-bg: var(--primary); --btn-bd: var(--primary); --btn-fg: var(--primary-contrast); }
.btn--tone-bronze { --btn-bg: color-mix(in oklab, var(--primary) 85%, #6b4b2e); --btn-bd: var(--primary); --btn-fg: #fff; }
.btn--tone-leather { --btn-bg: color-mix(in oklab, var(--primary) 78%, #7a5239); --btn-bd: var(--primary); --btn-fg: #fff; }
.btn--tone-cocoa { --btn-bg: color-mix(in oklab, var(--primary) 60%, #3d2a20); --btn-bd: color-mix(in oklab, var(--primary) 70%, #3d2a20); --btn-fg: #fff; }
.btn--tone-umber { --btn-bg: color-mix(in oklab, var(--primary) 70%, #513726); --btn-bd: color-mix(in oklab, var(--primary) 80%, #513726); --btn-fg: #fff; }

/* sand/neutral tints */
.btn--tone-sand { --btn-bg: var(--accent); --btn-bd: var(--border-strong); --btn-fg: #3A2F23; }
.btn--tone-dune { --btn-bg: color-mix(in oklab, var(--accent) 80%, var(--primary)); --btn-bd: var(--border-strong); --btn-fg: #2c241c; }
.btn--tone-wheat { --btn-bg: color-mix(in oklab, var(--accent) 90%, #fff2d6); --btn-bd: var(--border-strong); --btn-fg: #3A2F23; }
.btn--tone-gold { --btn-bg: var(--warning); --btn-bd: color-mix(in oklab, var(--warning) 85%, #7a5b11); --btn-fg: #2c241c; }
.btn--tone-amber { --btn-bg: color-mix(in oklab, var(--warning) 75%, var(--accent)); --btn-bd: color-mix(in oklab, var(--warning) 80%, var(--accent)); --btn-fg: #2c241c; }

/* greens */
.btn--tone-moss { --btn-bg: color-mix(in oklab, var(--success) 82%, #1f2a1f); --btn-bd: color-mix(in oklab, var(--success) 88%, #1f2a1f); --btn-fg: #0F231A; }
.btn--tone-fern { --btn-bg: var(--success); --btn-bd: color-mix(in oklab, var(--success) 88%, #0c1a14); --btn-fg: #0F231A; }
.btn--tone-olive { --btn-bg: color-mix(in oklab, var(--success) 70%, #6b645b); --btn-bd: color-mix(in oklab, var(--success) 80%, #6b645b); --btn-fg: #0F231A; }
.btn--tone-sage { --btn-bg: color-mix(in oklab, var(--success) 55%, var(--accent)); --btn-bd: color-mix(in oklab, var(--success) 70%, var(--accent)); --btn-fg: #0F231A; }

/* reds/pinks for emphasis */
.btn--tone-rose { --btn-bg: color-mix(in oklab, #E9A6A1 70%, var(--accent)); --btn-bd: color-mix(in oklab, #E9A6A1 80%, var(--accent)); --btn-fg: #3A2F23; }
.btn--tone-brick { --btn-bg: color-mix(in oklab, var(--danger) 70%, #7a2a28); --btn-bd: color-mix(in oklab, var(--danger) 80%, #7a2a28); --btn-fg: #fff; }
.btn--tone-wine { --btn-bg: color-mix(in oklab, var(--danger) 85%, #4a1211); --btn-bd: color-mix(in oklab, var(--danger) 90%, #4a1211); --btn-fg: #fff; }

/* cool/neutral utility */
.btn--tone-stone { --btn-bg: #EDE1C6; --btn-bd: #D6C6A0; --btn-fg: #3A2F23; }
.btn--tone-slate { --btn-bg: #DDD4C2; --btn-bd: #CBB58F; --btn-fg: #3A2F23; }
.btn--tone-ash { --btn-bg: #D2C7B2; --btn-bd: #BBA784; --btn-fg: #3A2F23; }
.btn--tone-cloud { --btn-bg: #F6EFE0; --btn-bd: #E8DBC0; --btn-fg: #3A2F23; }
.btn--tone-ink { --btn-bg: #4A463F; --btn-bd: #3f3a34; --btn-fg: #FFFFFF; }
.btn--tone-latte { --btn-bg: #EADFCB; --btn-bd: #D6C6A0; --btn-fg: #3A2F23; }

/* hover/active derived from base bg when tone present */
[class*="btn--tone-"]:hover { background: color-mix(in oklab, var(--btn-bg) 92%, black); }
[class*="btn--tone-"]:active { background: color-mix(in oklab, var(--btn-bg) 84%, black); }

/* Responsive fallback: on narrow screens, stack to 3 columns */
@media (max-width: 680px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
`
