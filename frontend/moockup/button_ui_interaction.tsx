import React, { memo, useMemo, useCallback } from 'react'

// UiInteractionGrid25 – 25 common UI interaction buttons (Case 3)
// Self‑contained: no external deps; production‑ready structure, a11y, and lightweight styling.

// -----------------------------
// Types
// -----------------------------
export type Variant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'ghost'

export interface ActionItem {
  id: string
  label: string
  variant?: Variant
  disabled?: boolean
}

interface ButtonProps {
  label: string
  variant?: Variant
  disabled?: boolean
  onClick?: () => void
  testId?: string
  icon?: React.ReactNode
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
}: ButtonProps) {
  const className = useMemo(
    () => cx('btn', `btn--${variant}`, disabled && 'is-disabled'),
    [variant, disabled]
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
// UI Interactions (25)
// -----------------------------
const ACTIONS: ActionItem[] = [
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', variant: 'primary' },
  { id: 'collapse-left', label: 'Collapse Left', variant: 'primary' },
  { id: 'expand-left', label: 'Expand Left', variant: 'primary' },
  { id: 'collapse-right', label: 'Collapse Right', variant: 'primary' },
  { id: 'expand-right', label: 'Expand Right', variant: 'primary' },
  { id: 'collapse-top', label: 'Collapse Top', variant: 'primary' },
  { id: 'expand-top', label: 'Expand Top', variant: 'primary' },
  { id: 'collapse-bottom', label: 'Collapse Bottom', variant: 'primary' },
  { id: 'expand-bottom', label: 'Expand Bottom', variant: 'primary' },
  { id: 'dock-left', label: 'Dock Left', variant: 'primary' },
  { id: 'dock-right', label: 'Dock Right', variant: 'primary' },
  { id: 'dock-bottom', label: 'Dock Bottom', variant: 'primary' },
  { id: 'undock-float', label: 'Undock / Float', variant: 'primary' },
  { id: 'pin-panel', label: 'Pin Panel', variant: 'primary' },
  { id: 'unpin-panel', label: 'Unpin Panel', variant: 'primary' },
  { id: 'fullscreen', label: 'Fullscreen', variant: 'primary' },
  { id: 'exit-fullscreen', label: 'Exit Fullscreen', variant: 'primary' },
  { id: 'minimize', label: 'Minimize', variant: 'primary' },
  { id: 'restore-size', label: 'Restore Size', variant: 'primary' },
  { id: 'split-left', label: 'Split Left', variant: 'primary' },
  { id: 'split-right', label: 'Split Right', variant: 'primary' },
  { id: 'split-top', label: 'Split Top', variant: 'primary' },
  { id: 'split-bottom', label: 'Split Bottom', variant: 'primary' },
  { id: 'toggle-grid', label: 'Toggle Grid', variant: 'primary' },
  { id: 'toggle-guides', label: 'Toggle Guides', variant: 'primary' },
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
  'toggle-sidebar': (
    <Svg
      path={
        <>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <rect x="5" y="4" width="4" height="16" rx="1" fill="currentColor" />
        </>
      }
    />
  ),
  'collapse-left': (
    <Svg
      path={
        <>
          <rect
            x="3.5"
            y="4"
            width="17"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 8l-3 4 3 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 4v16" stroke="currentColor" strokeWidth="1.2" />
        </>
      }
    />
  ),
  'expand-left': (
    <Svg
      path={
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M11 8l-3 4 3 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'collapse-right': (
    <Svg
      path={
        <>
          <rect
            x="3.5"
            y="4"
            width="17"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M16 8l3 4-3 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M14 4v16" stroke="currentColor" strokeWidth="1.2" />
        </>
      }
    />
  ),
  'expand-right': (
    <Svg
      path={
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M13 8l3 4-3 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'collapse-top': (
    <Svg
      path={
        <>
          <rect
            x="4"
            y="4.5"
            width="16"
            height="17"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 9l4-3 4 3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M4 12h16" stroke="currentColor" strokeWidth="1.2" />
        </>
      }
    />
  ),
  'expand-top': (
    <Svg
      path={
        <>
          <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 20V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M9 11l3-3 3 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'collapse-bottom': (
    <Svg
      path={
        <>
          <rect
            x="4"
            y="3.5"
            width="16"
            height="17"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M8 18l4 3 4-3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M4 16h16" stroke="currentColor" strokeWidth="1.2" />
        </>
      }
    />
  ),
  'expand-bottom': (
    <Svg
      path={
        <>
          <rect x="4" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 4v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M9 13l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'dock-left': (
    <Svg
      path={
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 12H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M11 8l-3 4 3 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'dock-right': (
    <Svg
      path={
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M18 12h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M13 8l3 4-3 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'dock-bottom': (
    <Svg
      path={
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 18v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M8 13l4 3 4-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'undock-float': (
    <Svg
      path={
        <>
          <rect x="4" y="7" width="11" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <rect
            x="13"
            y="3.5"
            width="7"
            height="5.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M11.5 8.5l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13 4.5h3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      }
    />
  ),
  'pin-panel': (
    <Svg
      path={
        <>
          <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8" cy="7" r="1.2" fill="currentColor" />
          <path d="M8 8.2v3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M7 11.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      }
    />
  ),
  'unpin-panel': (
    <Svg
      path={
        <>
          <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8" cy="7" r="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 8.2v2.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M7 4.5h-3v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      }
    />
  ),
  fullscreen: (
    <Svg
      path={
        <>
          <path d="M10 10L6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 10V6h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14 10l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18 10V6h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M10 14l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6 14v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18 14v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      }
    />
  ),
  'exit-fullscreen': (
    <Svg
      path={
        <>
          <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M10.5 7.5L12 8.5l1.5-1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M4 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M7.5 10.5L8.5 12l-1 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M20 12h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M16.5 10.5L15.5 12l1 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M12 20v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M10.5 16.5L12 15.5l1.5 1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  minimize: (
    <Svg
      path={
        <>
          <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M10.5 16.5L12 18l1.5-1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      }
    />
  ),
  'restore-size': (
    <Svg
      path={
        <>
          <path d="M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 18v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M10.5 15.5L12 14l1.5 1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="7" y="6" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
        </>
      }
    />
  ),
  'split-left': (
    <Svg
      path={
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 5v14" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M9 12l-2 0M15 12l2 0"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  'split-right': (
    <Svg
      path={
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 5v14" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M15 12l2 0M9 12l-2 0"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  'split-top': (
    <Svg
      path={
        <>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M12 9l0-2M12 15l0 2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  'split-bottom': (
    <Svg
      path={
        <>
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M12 15l0 2M12 9l0-2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      }
    />
  ),
  'toggle-grid': (
    <Svg
      path={
        <>
          <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 5v14M15 5v14M5 9h14M5 15h14" stroke="currentColor" strokeWidth="1.2" />
        </>
      }
    />
  ),
  'toggle-guides': (
    <Svg
      path={
        <>
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 4v16M12 4v16M18 4v16" stroke="currentColor" strokeWidth="1.2" />
        </>
      }
    />
  ),
}

const iconFor = (id: string) => ICONS[id] ?? null

// -----------------------------
// Component
// -----------------------------
export default function UiInteractionGrid25() {
  const onAction = useCallback((id: string) => {
    // Replace this with real logic. For now, it is a safe no-op with a console line.
     
    console.log(`[UiAction] ${id}`)
  }, [])

  return (
    <section className="action-grid" aria-label="Action grid for UI interactions">
      <header className="grid__header">
        <h2 className="grid__title">UI Interactions</h2>
        <p className="grid__hint" role="note">
          Keyboard accessible – use Tab/Shift+Tab to navigate, Enter/Space to activate.
        </p>
      </header>

      <div
        className="grid"
        role="grid"
        aria-rowcount={Math.ceil(ACTIONS.length / 5)}
        aria-colcount={5}
        data-testid="ui-action-grid"
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
     
    console.warn('[UiInteractionGrid25][test] Duplicate IDs detected', ids)
  }
  const allHaveLabels = ACTIONS.every((a) => typeof a.label === 'string' && a.label.length > 0)
  if (!allHaveLabels) {
     
    console.warn('[UiInteractionGrid25][test] Some actions have missing labels')
  }
}

// -----------------------------
// Styles – semantic tokens + grid layout (matching CI)
// -----------------------------
const styles = `
:root {
  --text: #1F1E1B;
  --text-muted: #6B645B;
  --surface: #FFFFFF;
  --surface-subtle: #FBF7EF;
  --border: #EDE1C6;

  /* Light beige-brown CI */
  --primary: #E6D3B8;
  --primary-contrast: #2F261C;
  --accent: #D7C5A6;

  --danger:  #C73A37;
  --ink: #4A463F;

  --primary-hover: #DFC6A1;
  --primary-active: #D4B487;
  --border-strong: #CBB58F;
  --focus-ring: #1A73E8;
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

/* Responsive fallback: on narrow screens, stack to 3 columns */
@media (max-width: 680px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
`
