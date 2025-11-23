import React, { memo, useMemo, useCallback } from "react";

// EditActionGrid20 – 20 common image editing actions (Case 2)
// Self‑contained: no external deps; production‑ready structure, a11y, and lightweight styling.

// -----------------------------
// Types
// -----------------------------
export type Variant = "primary" | "secondary" | "accent" | "destructive" | "ghost";

export interface ActionItem {
  id: string;
  label: string;
  variant?: Variant;
  disabled?: boolean;
}

interface ButtonProps {
  label: string;
  variant?: Variant;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
  icon?: React.ReactNode;
}

// -----------------------------
// Helpers
// -----------------------------
const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const Button = memo(function Button({ label, variant = "secondary", disabled, onClick, testId, icon }: ButtonProps) {
  const className = useMemo(
    () => cx("btn", `btn--${variant}`, disabled && "is-disabled"),
    [variant, disabled]
  );
  const handleClick = useCallback(() => { if (!disabled) onClick?.(); }, [disabled, onClick]);

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
      {icon && <span className="btn__icon" aria-hidden="true">{icon}</span>}
      <span className="btn__label">{label}</span>
    </button>
  );
});

// -----------------------------
// Edit Actions (Case 2)
// -----------------------------
const ACTIONS: ActionItem[] = [
  { id: "crop",           label: "Crop",            variant: "primary" },
  { id: "straighten",     label: "Straighten",      variant: "primary" },
  { id: "rotate-left",    label: "Rotate Left",     variant: "primary" },
  { id: "rotate-right",   label: "Rotate Right",    variant: "primary" },
  { id: "flip-h",         label: "Flip Horizontal", variant: "primary" },
  { id: "flip-v",         label: "Flip Vertical",   variant: "primary" },
  { id: "resize",         label: "Resize",          variant: "primary" },
  { id: "canvas-size",    label: "Canvas Size",     variant: "primary" },
  { id: "perspective",    label: "Perspective",     variant: "primary" },
  { id: "skew",           label: "Skew",            variant: "primary" },
  { id: "aspect-1-1",     label: "Aspect 1:1",     variant: "primary" },
  { id: "aspect-4-5",     label: "Aspect 4:5",     variant: "primary" },
  { id: "aspect-16-9",    label: "Aspect 16:9",    variant: "primary" },
  { id: "aspect-9-16",    label: "Aspect 9:16",    variant: "primary" },
  { id: "auto-enhance",   label: "Auto Enhance",    variant: "primary" },
  { id: "exposure",       label: "Exposure",        variant: "primary" },
  { id: "contrast",       label: "Contrast",        variant: "primary" },
  { id: "saturation",     label: "Saturation",      variant: "primary" },
  { id: "temperature",    label: "Temperature",     variant: "primary" },
  { id: "sharpen",        label: "Sharpen",         variant: "primary" },
];

// -----------------------------
// Icons (inline SVG)
// -----------------------------
const Svg: React.FC<{ path: React.ReactNode; viewBox?: string }> = ({ path, viewBox = "0 0 24 24" }) => (
  <svg width="18" height="18" viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
    {path}
  </svg>
);

const ICONS: Record<string, React.ReactNode> = {
  crop: <Svg path={<path d="M7 3v12h12M3 7h12v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>} />,
  straighten: <Svg path={<><path d="M4 14h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M5 14l2.5-4 3 5 3-6 3 5 2.5-4" stroke="currentColor" strokeWidth="1.2"/></>} />,
  "rotate-left": <Svg path={<><path d="M8 8H4V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M6 6a8 8 0 1 1-2 5" stroke="currentColor" strokeWidth="1.6" fill="none"/></>} />,
  "rotate-right": <Svg path={<><path d="M16 8h4V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M18 6a8 8 0 1 0 2 5" stroke="currentColor" strokeWidth="1.6" fill="none"/></>} />,
  "flip-h": <Svg path={<><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M12 4v16M12 6l3 3M12 10l5 0M12 14l5 0M12 18l3-3" stroke="currentColor" strokeWidth="1.2"/></>} />,
  "flip-v": <Svg path={<><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M4 12h16M6 12l3 3M10 12l0 5M14 12l0 5M18 12l-3 3" stroke="currentColor" strokeWidth="1.2"/></>} />,
  resize: <Svg path={<><path d="M20 14v6h-6" stroke="currentColor" strokeWidth="1.6"/><path d="M10 4H4v6" stroke="currentColor" strokeWidth="1.6"/><path d="M14 20l6-6M4 10l6-6" stroke="currentColor" strokeWidth="1.6"/></>} />,
  "canvas-size": <Svg path={<><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M9 9h6v6H9z" stroke="currentColor" strokeWidth="1.2"/></>} />,
  perspective: <Svg path={<><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" stroke="currentColor" strokeWidth="1.6"/><path d="M4 12h16" stroke="currentColor" strokeWidth="1.2"/></>} />,
  skew: <Svg path={<><rect x="6" y="6" width="12" height="12" transform="skewX(-15)" stroke="currentColor" strokeWidth="1.6"/></>} viewBox="0 0 24 24" />,
  "aspect-1-1": <Svg path={<><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M9 9h6v6H9z" stroke="currentColor" strokeWidth="1.2"/></>} />,
  "aspect-4-5": <Svg path={<><rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 7h8v10H8z" stroke="currentColor" strokeWidth="1.2"/></>} />,
  "aspect-16-9": <Svg path={<><rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M7 9h10v6H7z" stroke="currentColor" strokeWidth="1.2"/></>} />,
  "aspect-9-16": <Svg path={<><rect x="7" y="4" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M9 7h6v10H9z" stroke="currentColor" strokeWidth="1.2"/></>} />,
  "auto-enhance": <Svg path={<><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></>} />,
  exposure: <Svg path={<><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 16l8-8" stroke="currentColor" strokeWidth="1.6"/></>} />,
  contrast: <Svg path={<><circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M12 5a7 7 0 0 1 0 14V5z" fill="currentColor"/></>} />,
  saturation: <Svg path={<><path d="M12 5s5 4.5 5 8a5 5 0 1 1-10 0c0-3.5 5-8 5-8z" stroke="currentColor" strokeWidth="1.6" fill="none"/></>} />,
  temperature: <Svg path={<><path d="M12 6v7" stroke="currentColor" strokeWidth="1.6"/><path d="M10 6a2 2 0 1 1 4 0v6a4 4 0 1 1-4 0V6z" stroke="currentColor" strokeWidth="1.6"/></>} />,
  sharpen: <Svg path={<><path d="M12 4l6 16H6l6-16z" stroke="currentColor" strokeWidth="1.6"/><path d="M8 16h8" stroke="currentColor" strokeWidth="1.2"/></>} />,
};

const iconFor = (id: string) => ICONS[id] ?? null;

// -----------------------------
// Component
// -----------------------------
export default function EditActionGrid20() {
  const onAction = useCallback((id: string) => {
    // Replace this with real logic. For now, it is a safe no-op with a console line.
    // eslint-disable-next-line no-console
    console.log(`[EditAction] ${id}`);
  }, []);

  return (
    <section className="action-grid" aria-label="Action grid for edit actions">
      <header className="grid__header">
        <h2 className="grid__title">Edit Actions</h2>
        <p className="grid__hint" role="note">Keyboard accessible – use Tab/Shift+Tab to navigate, Enter/Space to activate.</p>
      </header>

      <div
        className="grid"
        role="grid"
        aria-rowcount={Math.ceil(ACTIONS.length / 5)}
        aria-colcount={5}
        data-testid="edit-action-grid"
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
  );
}

// -----------------------------
// Lightweight runtime checks (dev-only) – "test cases"
// -----------------------------
if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") {
  const ids = ACTIONS.map(a => a.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    // eslint-disable-next-line no-console
    console.warn("[EditActionGrid20][test] Duplicate IDs detected", ids);
  }
  const allHaveLabels = ACTIONS.every(a => typeof a.label === "string" && a.label.length > 0);
  if (!allHaveLabels) {
    // eslint-disable-next-line no-console
    console.warn("[EditActionGrid20][test] Some actions have missing labels");
  }
}

// -----------------------------
// Styles – semantic tokens + grid layout (matching data grid CI)
// -----------------------------
const styles = `
:root {
  --text: #1F1E1B;
  --text-muted: #6B645B;
  --surface: #FFFFFF;
  --surface-subtle: #FBF7EF;
  --border: #EDE1C6;

  /* Light beige-brown CI to match previous grid */
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
`;
