# Arciva — Stone Trail Color System

This document defines Arciva’s color system. **Arciva** is the app. **Stone Trail** is the brand CI (logo + palette). Use **semantic tokens** in UI; brand families are a reference.

---

## 1) Brand families

> Reference values. Do **not** hard‑code brand shades in app code—map through semantic tokens.

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

### Support palettes
**Green (success):** 50–900 → core: **#34B37A**

**Yellow (warning):** 50–900 → core: **#E4AD07**

**Red (danger):** 50–900 → core: **#C73A37**

**Neutral:** 0–900 → key: **0:#FFFFFF**, **25:#FBF7EF**, **700:#6B645B**, **800:#1F1E1B**

---

## 2) Semantic tokens (author in CSS)

Attach to `:root` (or a theme class). Components must use `var(--token)`.

```css
:root {
  --text: #1F1E1B;               /* primary body text */
  --text-muted: #6B645B;         /* secondary text */
  --surface: #FFFFFF;            /* cards/sheets */
  --surface-subtle: #FBF7EF;     /* app background */
  --border: #EDE1C6;             /* neutral borders */
  --primary: #A56A4A;            /* main action */
  --primary-contrast: #FFFFFF;   /* text on primary */
  --accent: #D7C5A6;             /* selection/highlight */
  --success: #34B37A;            /* positive */
  --warning: #E4AD07;            /* caution */
  --danger: #C73A37;             /* destructive */
  --ink: #4A463F;                /* iconography */
}
```

### Dark theme remap
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
  --danger: #C73A37;
  --ink: #4A463F;
}
```

---

## 3) When to use which color

| UI element | Token | Why |
|---|---|---|
| Primary button | `--primary` / `--primary-contrast` | Clear call to action |
| Secondary button | border `--border`, text `--text` | Quiet, non-destructive |
| Destructive button | `--danger` | High salience for risky action |
| Success chip/toast | `--success` | Positive feedback |
| Warning banner | `--warning` | Caution without danger |
| Error banner | `--danger` | Failure state |
| Card background | `--surface` | Neutral canvas for content |
| App background | `--surface-subtle` | Gentle differentiation |
| Icon/ink | `--ink` | Consistent icon tone |
| Hints/labels | `--text-muted` | Reduce visual noise |

**Rule:** prefer tokens. Only use brand families for illustration, marketing, or when defining tokens.

---

## 4) Accessibility

- Target **WCAG 2.1 AA** contrast for text: 4.5:1 normal, 3:1 large.
- Ensure `--primary` vs `--primary-contrast` maintains AA (light & dark).
- Do not overlay low-contrast Sand backgrounds with muted text for long copy.

---

## 5) Implementation notes

- Expose tokens through CSS variables (global or CSS-in-JS theme object).
- Tailwind example (plugin or config):

```js
// tailwind.config.js (excerpt)
module.exports = {
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        border: 'var(--border)',
        text: 'var(--text)',
      }
    }
  }
}
```

- React usage:
```tsx
<button className="rounded-full px-3 py-2"
        style={{ background: 'var(--primary)', color: 'var(--primary-contrast)', border: '1px solid var(--primary)' }}>
  Upload
</button>
```

---

## 6) Token dictionary (copy/paste)

| Token | Light | Dark |
|---|---|---|
| `--text` | #1F1E1B | #FFFFFF |
| `--text-muted` | #6B645B | #B5AB9A |
| `--surface` | #FFFFFF | #0F0E0C |
| `--surface-subtle` | #FBF7EF | #262320 |
| `--border` | #EDE1C6 | #3E3934 |
| `--primary` | #A56A4A | #C78772 |
| `--primary-contrast` | #FFFFFF | #0F0E0C |
| `--accent` | #D7C5A6 | #E3D4B1 |
| `--success` | #34B37A | #34B37A |
| `--warning` | #E4AD07 | #E4AD07 |
| `--danger` | #C73A37 | #C73A37 |
| `--ink` | #4A463F | #4A463F |

---

## 7) Governance

- Product uses semantic tokens only.
- Brand/Marketing may use Clay/Sand/Basalt directly.
- New tokens must be added to this document and implemented in the theme switcher.

---

## 8) References

- React demo: *Arciva — Color System (Stone Trail CI)* (see canvas)
- Source palettes live in shared `PALETTE` map (design tokens).

