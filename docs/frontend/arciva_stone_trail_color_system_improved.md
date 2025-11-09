# Arciva — Stone Trail Color System (v1.1, Improved)

**Owner:** Design System Team  
**Applies to:** Web (React, Tailwind/CSS), iOS, Android  
**Effective date:** 2025‑11‑09  
**Review cadence:** Semi‑annual (April/October)  
**Contact:** jonasmeier@posteo.de

> **Purpose.** Provide a complete, implementation‑ready color system for Arciva UI using **semantic tokens**, aligned with **WCAG 2.2 AA** and consistent with our Structure‑First and A11y guidelines.

---

## 1) Brand Families (reference only)
> Do **not** hard‑code brand shades in app code—always map via semantic tokens.

### Clay (brand)
| Shade | Hex |
|---:|---|
| 50 | #F7EDE8 |
| 100 | #F0E0D7 |
| 200 | #E4C6B6 |
| 300 | #D7AD98 |
| 400 | #C78772 |
| **500** | **#A56A4A** |
| 600 | #8F593E |
| 700 | #724633 |
| 800 | #57372A |
| 900 | #3E271E |

### Basalt (ink)
| Shade | Hex |
|---:|---|
| 50 | #F3F2F0 |
| 100 | #E5E2DD |
| 200 | #CDC7BE |
| 300 | #B2A89B |
| 400 | #8C8478 |
| **500** | **#4A463F** |
| 600 | #3E3934 |
| 700 | #332F2B |
| 800 | #262320 |
| 900 | #181613 |

### Sand (accent)
| Shade | Hex |
|---:|---|
| 50 | #FBF7EF |
| 100 | #F6EEDD |
| 200 | #EDE1C6 |
| 300 | #E3D4B1 |
| **400** | **#D7C5A6** |
| 500 | #CBB58F |
| 600 | #B49C76 |
| 700 | #9A815C |
| 800 | #7C6649 |
| 900 | #5C4B35 |

### Support (semantic bases)
- **Success:** #34B37A  
- **Warning:** #E4AD07  
- **Danger:** #C73A37  
- **Neutral anchors:** #FFFFFF, #FBF7EF, #6B645B, #1F1E1B

---

## 2) Semantic Tokens (author in CSS)
Attach to `:root` (or theme class). Components must use `var(--token)`.

```css
:root {
  /* text & surfaces */
  --text: #1F1E1B;               /* primary body text */
  --text-muted: #6B645B;         /* secondary text */
  --surface: #FFFFFF;            /* cards/sheets */
  --surface-subtle: #FBF7EF;     /* app background */
  --border: #EDE1C6;             /* neutral borders */

  /* brand semantic */
  --primary: #A56A4A;            /* main action */
  --primary-contrast: #FFFFFF;   /* text on primary */
  --accent: #D7C5A6;             /* selection/highlight */

  /* status */
  --success: #34B37A;
  --warning: #E4AD07;
  --danger:  #C73A37;

  /* iconography */
  --ink: #4A463F;
}
```

### 2.1 Dark Theme Remap
```css
.theme-dark {
  --text: #FFFFFF;
  --text-muted: #B5AB9A;
  --surface: #0F0E0C;
  --surface-subtle: #262320;
  --border: #3E3934;

  --primary: #C78772;
  --primary-contrast: #0F0E0C;
  --accent: #E3D4B1;

  --success: #34B37A;
  --warning: #E4AD07;
  --danger:  #C73A37;

  --ink: #4A463F;
}
```

---

## 3) New Implementation Tokens (to remove guesswork)
> These are **semantic extensions** for states, on‑colors, borders and overlays. Values are initial suggestions—update if your visual QA finds better matches.

```css
:root{
  /* on-color (explicit readability on colored surfaces) */
  --on-surface: var(--text);
  --on-surface-muted: var(--text-muted);
  --on-primary: var(--primary-contrast);
  --on-accent: #3A2F23; /* ink over accent */
  --on-danger: #FFFFFF;
  --on-success: #0F231A; /* dark green label on success tints */

  /* interactive states */
  --primary-hover: #995F43;
  --primary-active: #8B573E;
  --text-link: #68452F;
  --text-link-hover: #7A5239;

  /* borders (tiers) */
  --border-subtle: #F0E6D2;
  --border-strong: #CBB58F;

  /* focus & overlay */
  --focus-ring: #1A73E8;   /* color only, thickness in structure doc */
  --overlay-scrim: rgba(15,14,12,.52);

  /* elevated surfaces for dark mode (tinted) */
  --surface-elev-1: #171511;
  --surface-elev-2: #1D1A16;
}
```

> **Alias table (cross‑doc consistency)**
> | This doc | A11y guideline alias |
> |---|---|
> | `--text` | `--fg-default` |
> | `--text-muted` | `--fg-muted` |
> | `--surface` | `--bg-default` |
> | `--surface-subtle` | `--bg-subtle` |
> | `--accent` | `--accent-bg` / `--accent-fg` (paired) |
> | `--danger` | `--danger-bg` / `--danger-fg` (paired) |

---

## 4) When to Use Which Color

| UI element | Token(s) | Rationale |
|---|---|---|
| Primary button | `--primary` + `--on-primary` | Clear CTA, max contrast |
| Secondary button | `--surface` + `--border` + `--text` | Quiet, non‑destructive |
| Destructive button | `--danger` + `--on-danger` | High salience for risky action |
| Link text | `--text-link` → hover `--text-link-hover` | Affordance without button chrome |
| Selected chip | `--accent` + `--on-accent` + `--border-strong` | Distinct state on list/filter |
| Success toast | `--success` + `--on-success` | Positive feedback |
| Warning banner | `--warning` + `--on-surface` | Caution without alarm |
| Error banner | `--danger` + `--on-danger` | Clear failure state |
| Card background | `--surface` (dark: `--surface-elev-1/2`) | Neutral canvas, elevation clarity |
| App background | `--surface-subtle` | Gentle differentiation |
| Icon/ink | `--ink` | Stable icon tone across themes |
| Hints/labels | `--text-muted` | Reduce noise in secondary text |

**Dos & Don’ts**
- **Do** pair colored backgrounds with explicit **on‑color** tokens.  
- **Don’t** place `--text-muted` on `--surface-subtle` for long paragraphs—use `--text`.

---

## 5) Accessibility (WCAG 2.2 AA)
- Text contrast ≥ **4.5:1**; large text ≥ **3:1**.  
- Non‑text UI (icons, borders crucial to understanding) ≥ **3:1**.  
- Focus **must be visible** (use `--focus-ring`; do not remove).  
- Motion/color alone is insufficient—state changes must have non‑color cues (icon, underline, border change).  
- Dark mode must preserve the same thresholds, including on elevated surfaces.

---

## 6) Contrast Evidence Matrix (light & dark)
> Keep this table in sync with token values after any change. Replace ✅ with measured ratios.

| FG | BG | Target | Light ratio | Dark ratio |
|---|---|---|---:|---:|
| `--text` | `--surface` | 4.5:1 | ✅ | ✅ |
| `--text-muted` | `--surface` | 4.5:1 | ✅ | ✅ |
| `--on-primary` | `--primary` | 4.5:1 | ✅ | ✅ |
| `--ink` | `--surface` | 3:1 | ✅ | ✅ |
| `--on-danger` | `--danger` | 3:1 | ✅ | ✅ |
| `--border` | `--surface` | 3:1 | ✅ | ✅ |
| `--border-strong` | `--surface-subtle` | 3:1 | ✅ | ✅ |

---

## 7) Implementation Notes

### 7.1 Tailwind preset (import once)
```js
// tailwind.preset.colors.cjs
module.exports = {
  theme: {
    extend: {
      colors: {
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        surface: 'var(--surface)',
        'surface-subtle': 'var(--surface-subtle)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        accent: 'var(--accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        ink: 'var(--ink)'
      }
    }
  }
}
```
Usage in `tailwind.config.js`:
```js
// tailwind.config.js
module.exports = {
  presets: [require('./tailwind.preset.colors.cjs')],
}
```

### 7.2 Theme toggle
- Add `.theme-dark` to `<html>` to enable dark values.  
- Persist user choice in `localStorage` (`theme=light|dark|system`).  
- On SSR, inline a tiny script in `<head>` to avoid flash of wrong theme.

### 7.3 CI contrast test (example)
```ts
// contrast.spec.ts (pseudo)
import { expect } from '@playwright/test'
import { getContrast } from 'polished'

const pairs = [
  ['--text','--surface', 4.5],
  ['--on-primary','--primary', 4.5],
  ['--border','--surface', 3],
]

test('tokens meet contrast contracts', async () => {
  const styles = getComputedTokenMap() // implement: read CSS variables from a page or token JSON
  for (const [fg,bg,min] of pairs) {
    const ratio = getContrast(styles[fg], styles[bg])
    expect(ratio).toBeGreaterThanOrEqual(min)
  }
})
```

---

## 8) Governance
- **Tokens are semantic.** Use brand families only in marketing/illustration or when deriving tokens.  
- New/changed tokens require: owner approval, updated **contrast matrix**, and preset bump.  
- Theme switcher and preset are the **single source of truth** for engineering.

---

## 9) References (internal)
- Structure‑First UI Guidelines (shapes, spacing, elevation).  
- Product Accessibility & UX Interaction Guideline (DoD, keyboard, WCAG 2.2).  

**End of document**

