# Product Accessibility & UX Interaction Guideline (v1.1, Improved)

**Owner:** Design System & Accessibility Team  
**Applies to:** Web (React), iOS, Android, PDFs/Docs  
**Effective date:** 2025‑11‑09  
**Review cadence:** Semi‑annual (April/October)  
**Contact:** jonasmeier@posteo.de

> **Purpose.** Define minimum, testable **accessibility** and **interaction** requirements across platforms. Aligns with the **Stone Trail Color System v1.1** (semantic tokens) and **UI Styling Guidelines v1.1** (structure‑first). Pins to **WCAG 2.2 AA**.

---

## 0) Policy — Standards Hierarchy
1) **Mandatory (Must/Testable)**  
   • WCAG **2.2 AA**  • HTML/CSS/JS  • **WAI‑ARIA 1.2** (only if native HTML is insufficient)  • EN 301 549 / Section 508 (as applicable)  
2) **Behavior Patterns (Should)**  
   • **WAI‑ARIA Authoring Practices Guide (APG)** keyboard models & roles/states  
3) **Platform Consistency (Should)**  
   • Apple **HIG** • **Material 3** • Windows **Fluent**  
4) **Informative (Reference)**  
   • WCAG Techniques & Understanding • **ATAG/UAAG**

**Version pinning**: WCAG 2.2 (2023), ARIA 1.2, APG snapshot (YYYY‑MM), HIG (iOS 18), Material 3.

---

## 1) Definition of Done (DoD)
A feature **cannot ship** unless all relevant items are met.

### 1.1 Universal (All Platforms)
- **Contrast**: text ≥ **4.5:1**; large text ≥ 3:1; essential non‑text UI ≥ **3:1**.  
- **Focus visible**: persistent, non‑color‑only indicator (uses `--focus-ring`).  
- **Keyboard complete**: all actions reachable; no traps; logical order.  
- **Labels**: programmatic name == visible label; labels precede inputs.  
- **Errors**: cause + remedy; polite announcements where needed.  
- **Motion**: respect reduced‑motion; avoid seizure‑risk patterns.  
- **Reflow/Zoom (Web)**: works at **320 px** width; zoom to **200%+** without loss.

### 1.2 Token alignment (Visual source of truth)
- Use **semantic tokens** from Stone Trail: `--text`, `--text-muted`, `--surface`, `--surface-subtle`, `--border`, `--primary`, `--primary-contrast`, `--accent`, `--success`, `--warning`, `--danger`, `--ink`, plus **on‑color/state** tokens (`--on-*`, `--*-hover`, `--*-active`, `--focus-ring`, `--overlay-scrim`).  
- Do **not** hard‑code brand hex values in components.

---

## 2) Verification & CI/CD

### 2.1 Static & Automated
- **Lint**: `eslint-plugin-jsx-a11y`, `stylelint-a11y`.  
- **axe-core**: Jest/Playwright/Cypress smoke on top pages/components.  
- **Lighthouse**: budgets (Accessibility ≥ **95** on key flows).  
- **Design**: Figma contrast checks; token diff via visual regression (Chromatic/Percy).

**GitHub Action (web)**
```yaml
name: a11y-ci
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test:a11y   # Playwright + axe-core
      - run: npm run lh:ci       # Lighthouse CI with budgets
```

### 2.2 Manual per release
- **Keyboard sweep**: Tab/Shift+Tab, Arrow keys, Esc, Enter/Space on top 3 flows.  
- **Screen reader smoke**: NVDA/JAWS (Windows), VoiceOver (macOS/iOS), TalkBack (Android).  
- **Assistive‑tech pair testing** for complex widgets (trees, grids, editors).

---

## 3) Component Specs (Web)
Each component section includes: **semantics/roles**, **keyboard matrix**, **focus behavior**, **labeling rules**, **APG deep‑link**, **acceptance tests**.

### 3.1 Dialog / Modal
**Semantics**: `role="dialog"` + `aria-modal="true"`; label via `aria-labelledby` + optional `aria-describedby`. Background inert (no focus).  
**Open**: move focus to first meaningful element; announce title.  
**Trap**: Tab cycles within; close with **Esc** or explicit control; restore focus to **invoker**.

**Keyboard**
| Key | When | Result |
|---|---|---|
| `Tab` / `Shift+Tab` | Dialog open | Move focus within dialog (cycle) |
| `Esc` | Any | Close and restore focus to invoker |
| `Enter` | Primary action focused | Activate primary |
| `Space` | Button focused | Activate |

**Visual tokens**: backdrop `--overlay-scrim`; focus ring `--focus-ring`; buttons use `--primary` / `--on-primary`.

**APG**: Dialog Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

**Acceptance**
- Focus is inside on open; background unfocusable.  
- `Esc` closes; focus returns to opener.  
- axe report: **0 serious/critical** in dialog story.

---

### 3.2 Tabs
**Semantics**: tablist `role="tablist"`; tabs `role="tab"` with `aria-selected`; panels `role="tabpanel"` with `aria-labelledby` and `id` mapping.  
**Keyboard**: Arrow keys move focus; Home/End jump; Enter/Space activates.

**Keyboard**
| Key | Focus on Tab | Result |
|---|---|---|
| `ArrowRight/Left` | Tablist | Move focus next/prev tab |
| `Home/End` | Tablist | Focus first/last tab |
| `Enter`/`Space` | Tab focused | Activate tab (show panel) |

**Visual tokens**: indicator/border uses `--border-strong` or accent; active label uses `--text` (not `--text-muted`).

**APG**: Tabs Pattern — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

**Acceptance**
- Roving focus on tabs; indicators visible; panel labelled correctly.  
- Arrow navigation works; activation via Enter/Space.

---

### 3.3 Menu / Menu Button
**Semantics**: button controls popup menu; menu items use `role="menuitem"` (or checkbox/radio variants).  
**Type‑ahead** recommended for long menus.

**Keyboard**
| Key | When | Result |
|---|---|---|
| `Enter`/`Space` | Menu button | Open/close menu |
| `ArrowDown/Up` | Menu open | Move focus next/prev item |
| `Esc` | Menu open | Close and restore focus to button |
| Char keys | Menu open | Type‑ahead to item |

**Visual tokens**: surface `--surface`, border `--border`, focus ring `--focus-ring`.

**APG**: Menu Button — https://www.w3.org/WAI/ARIA/apg/patterns/menubutton/

**Acceptance**
- Initial focus on first item when opening with keyboard.  
- Escape restores focus to the trigger.

---

### 3.4 Disclosure / Accordion
**Semantics**: button with `aria-expanded` controlling region via `aria-controls`. Heading structure preserved.  
**Keyboard**: Enter/Space toggles; Up/Down steps headers; Home/End to first/last.

**APG**: Accordion — https://www.w3.org/WAI/ARIA/apg/patterns/accordion/

---

### 3.5 Combobox (Autocomplete)
**Semantics**: `role="combobox"` with textbox; listbox options labelled; `aria-activedescendant` for active item.  
**Keyboard**: text input; Arrow keys navigate options; Enter selects; Esc clears/collapses.

**APG**: Combobox — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

---

### 3.6 Table / Data Grid (read‑only)
**Semantics**: native `<table>` with proper headers (`<th scope>` or `headers/id`).  
**Keyboard**: Tab to table; arrow within interactive elements; provide caption/summary as needed.

**APG**: Table — https://www.w3.org/WAI/ARIA/apg/patterns/table/

---

## 4) Forms & Validation
- Group related fields (`fieldset`/`legend`).  
- Associate help text via `aria-describedby`; do not rely on placeholder as label.  
- **Error pattern**: on submit focus first invalid; inline error near field; announce politely; include cause & remedy.  
- Required fields clearly indicated; provide examples/masks; accessible date/time pickers.

**Tokens**: error colors rely on `--danger`/`--on-danger`; borders use `--border-strong` on error; focus ring remains visible.

---

## 5) Mobile (iOS/Android)
- Use native accessibility APIs (traits/roles, actions, hints).  
- Support **Dynamic Type / Font scale**; layouts remain usable at largest size.  
- **Screen readers**: logical swipe order; rotor/Actions for custom controls.  
- Hit targets **≥ 44×44**; gestures do not conflict with system.

---

## 6) Documents (PDF/EPUB)
- **PDF/UA** tagging: reading order, headings, alt text, table headers; descriptive links and bookmarks; language set.

---

## 7) Evidence & Documentation
- For each component in the Design System: a11y spec, keyboard matrix, examples, and **axe snapshot**.  
- Store CI artifacts 12 months.  
- Link to APG section in component docs.

---

## 8) Exceptions
- Raise exception before code freeze: rationale, affected users, mitigation, **sunset date**, owner.  
- Product VP approval required for shipping with serious a11y defects.

---

## 9) Quick Ship Checklist
- [ ] 0 **serious/critical** issues in axe/Lighthouse for top flows  
- [ ] **Keyboard complete**; focus visible; Esc/Enter/Space work per spec  
- [ ] **Contrast** meets 2.2 AA contracts (see Stone Trail matrix)  
- [ ] **Labels** correct; icons labelled  
- [ ] **Reflow/Zoom** pass  
- [ ] **SR smoke** OK  
- [ ] **Docs updated** with evidence

---

## 10) References
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/  
- ARIA 1.2 — https://www.w3.org/TR/wai-aria-1.2/  
- APG (patterns) — https://www.w3.org/WAI/ARIA/apg/  
- Apple HIG — https://developer.apple.com/design/human-interface-guidelines/  
- Material 3 — https://m3.material.io/  
- Fluent — https://learn.microsoft.com/windows/apps/design/  
- PDF/UA — https://pdfa.org/resource/pdfua-1/

**End of document**

