# Arciva — UI Styling Guidelines (Structure‑First) v1.1

**Owner:** Design System Team  
**Applies to:** Web (React/Tailwind/CSS), iOS, Android  
**Effective date:** 2025‑11‑09  
**Review cadence:** Semi‑annual (April/October)  
**Contact:** jonasmeier@posteo.de

> **Purpose.** Provide color‑agnostic, implementation‑ready rules for **shape, spacing, elevation, layout, motion, and interaction**. Uses **semantic color tokens** from the Stone Trail Color System and the **A11y/Interaction Guideline** for behavior.

---

## 0) Design Language — “Soft‑Structure”
- **Forms:** calm, structured; **rounded containers**, **pill buttons**, **rounded chips**.
- **Density:** comfortable by default; optional **compact** mode for data‑heavy screens.
- **Hierarchy:** Page header → filter bar → card grid/masonry → secondary controls inside cards.

---

## 1) Base Tokens (Structure)
> Author as CSS variables; consume via Tailwind preset or `var(--token)`.

| Category | Token | Value | Notes |
|---|---|---|---|
| **Radius** | `--r-xs` | 6px | Inputs, badges |
|  | `--r-sm` | 10px | small cards, tooltips |
|  | `--r-md` | 14px | default containers |
|  | `--r-lg` | 18px | **cards** |
|  | `--r-xl` | 24px | large panels / modals |
|  | `--r-pill` | 9999px | buttons, chips |
| **Spacing** | `--s-1…--s-8` | 4,8,12,16,20,24,32,48px | global scale |
| **Elevation (shadows)** | `--shadow-1` | `0 1px 2px rgba(0,0,0,.06)` | inputs, chips |
|  | `--shadow-2` | `0 4px 10px rgba(0,0,0,.08)` | cards (idle) |
|  | `--shadow-3` | `0 8px 24px rgba(0,0,0,.10)` | hover/active, modals |
| **Breakpoints** | `sm`→`2xl` | 640,768,1024,1280,1536px | grid columns below |
| **Motion** | `--t-fast` | 120ms | hover, focus |
|  | `--t-med` | 200ms | open/close |
|  | `--t-slow` | 280ms | masonry/skeleton |
|  | `--ease` | `cubic-bezier(.2,.8,.2,1)` | standard easing |
| **Targets** | `--hit-min` | **44×44px** | minimum touch target |

**CSS seed**
```css
:root{
  --r-xs:6px; --r-sm:10px; --r-md:14px; --r-lg:18px; --r-xl:24px; --r-pill:9999px;
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px; --s-7:32px; --s-8:48px;
  --t-fast:120ms; --t-med:200ms; --t-slow:280ms; --ease:cubic-bezier(.2,.8,.2,1);
  --shadow-1:0 1px 2px rgba(0,0,0,.06);
  --shadow-2:0 4px 10px rgba(0,0,0,.08);
  --shadow-3:0 8px 24px rgba(0,0,0,.10);
}
```

### 1.1 Typography Tokens (color‑agnostic)
```css
:root{
  --fs-xxl:24px; --fs-xl:22px; --fs-lg:18px; --fs-md:16px; --fs-sm:14px; --fs-xs:12px;
  --lh-tight:1.2; --lh-normal:1.3; --lh-relaxed:1.4;
  --fw-regular:400; --fw-medium:500; --fw-semibold:600; --fw-bold:700;
}
```
| Element | Size token | Weight | Line‑height | Notes |
|---|---|---|---|---|
| Page title | `--fs-xxl` | `--fw-bold` | `--lh-tight` | single line |
| Subtitle | `--fs-sm`/`--fs-md` | `--fw-regular/medium` | `--lh-relaxed` | contextual |
| Card title | `--fs-lg` | `--fw-semibold` | `--lh-normal` | truncates to 1 line |
| Card subline | `--fs-sm` | `--fw-medium` | `--lh-normal` | status/client |
| Button label | `--fs-sm` | `--fw-semibold` | `--lh-tight` | sentence case |
| Chip label | `--fs-xs`/`--fs-sm` | `--fw-semibold` | `--lh-tight` | compact |

### 1.2 Density Mode (compact)
- Toggle `.density-compact` on a container to reduce paddings/heights by **0.875×**.  
- Examples: list rows 48→40px; button heights S/M/L: **32/36/40px**; grid gaps `--s-6`→`--s-5`.

```css
.density-compact{ --density-scale:.875 }
.btn{ height:calc(var(--btn-h,40px)*var(--density-scale,1)); }
```

---

## 2) Page Layout & Containers
**Scaffold**  
Header (title left, primary actions right) → Filter bar (search, client, tag chips) → Content grid.  
**Gutters:** viewport gutters `var(--s-7)`; grid gaps `var(--s-6)`.  
**Max width:** `1440px` center‑aligned.  
**Sticky filter bar:** only for long filter sets; sticks **after** first scroll pixel.

**Container rules**
- Cards/panels use `--r-lg`; modals use `--r-xl`; tooltips use `--r-sm`.
- Elevation increases on hover/active. Avoid mixing square and rounded shapes.

---

## 3) Project Cards (M default)
**Structure**
- Container: radius `--r-lg`, shadow `--shadow-2`, overflow hidden.
- Media: top, **4:3** (allow **3:2**), `object-fit: cover`, corners inherit top radius.
- Meta row: title (1 line), subline (client/status). Right group: **Open** (primary), **Edit** (secondary).
- States: hover → `--shadow-3`; image scales `scale(1.01)`.

**Sizes**
- **S:** 240–280px  
- **M:** 320–360px  
- **L:** 480–560px  
Masonry can mix sizes.

**Interaction**
- Whole card is **clickable → Open**; keep explicit **Open** button for clarity.  
- **Edit** is secondary; never alone.

**“New project” card**
- Same silhouette as M; plus icon + label “Start from scratch”. First in grid.

---

## 4) Buttons & Controls
**Buttons**  
Shape **pill** (`--r-pill`). Heights **36/40/44px** (S/M/L). Padding **14/16/18px**.  
Icon buttons: circular **36px**; supply `aria-label`.

**Button groups**: gap `--s-2`; right‑aligned inside cards.

**Chips / Filters**  
Pill, **28–32px** height, wrap as needed. States: default, **selected** (stronger outline + semi‑bold). Optional dismiss `×`.  
Behavior: **single‑select** *or* **multi‑select** (then show count in header: “Tags (3)”).

**Inputs**  
Height **40px**, radius `--r-md`, subtle `--shadow-1`. Search has leading icon + trailing clear (icon button **36px**).

**Dropdown / Select**  
Menu radius `--r-md`, min item height **36px**, type‑ahead optional, max height **320px**.

**Focus & state (color‑agnostic)**
- **Focus:** 2px outline + 4px offset (uses color token `--focus-ring`).  
- **Hover:** slightly higher elevation; avoid color dependency.  
- **Pressed:** reduce elevation to `--shadow-1`, `translateY(1px)`.  
- **Disabled:** 60–70% opacity; `cursor:not-allowed`.

---

## 5) Navigation & Secondary Surfaces
**Top bar**: height ~56px; padding `--s-6`; brand/avatar left, global actions right.  
**Archive mode**: same frame; primary CTA (*Enter/Exit archive*) on right.  
**Overlays**:  
- **Modal:** `--r-xl`, max‑width **720px**, safe‑area margin `--s-7`; close icon **36px** top‑right.  
- **Side sheet:** **420–560px** width; full height; radius on inner edge.  
- **Toast:** bottom‑right; pill; max‑width **420px**.

---

## 6) Grids, Responsiveness & Skeletons
**Masonry**: column gap `--s-6`, row gap `--s-6`; columns per breakpoint (see tokens). L cards span **2 columns** from `md+`.  
Use image **lazy‑loading** + aspect‑ratio boxes to prevent shift.  
**Empty states**: card silhouette, 1–2 lines copy, primary action; avoid full‑page “nothing found” without action.  
**Skeletons**: card skeleton with `--r-lg`: media box, two text bars, pill ghosts. Shimmer ~**1200ms**.

---

## 7) Interaction Patterns & Shortcuts
- **Primary first, right‑aligned** (Open), then secondary (Edit).  
- **Clickable areas:** whole card = Open; explicit buttons for predictability.  
- **Drag & drop (optional):** reorder cards; `grab` cursor; `--shadow-3` while dragging.  
- **Undo/Toast:** archive/delete shows toast with **Undo** (7–10s).  
- **Keyboard:** `F` focus search • `N` new project • `Esc` closes overlays • arrows + `Enter` navigate cards (roving tabindex).  
- **Scroll‑to‑top** after ~1200px; circular icon **44px**.

---

## 8) Accessibility Hooks (structure‑level)
- Contrast comes from theme (see Color System); **outline + elevation** must signal focus/hover even in low color contrast.  
- **Tab order:** header → filters → grid. In grid: **roving tabindex** (one tabbable card; arrow keys move focus).  
- **ARIA:** cards as `article` (label includes title); whole card is a link for **Open**; internal buttons are true `<button>` elements (avoid nested links).  
- **Touch targets:** **≥ 44×44px** for buttons/chips/icons.  
- **Focus indicator:** must be visible and not clipped by radius (use outline‑offset).

---

## 9) Component Blueprints (Tailwind‑ish)
**Button (M)**
```html
<button class="px-4 h-10 rounded-full shadow-sm inline-flex items-center gap-2
transition-[transform,box-shadow] duration-200 ease-[var(--ease)]
hover:shadow-md active:shadow-sm active:translate-y-[1px] focus:outline-2 focus:outline-offset-4">
  <span>Open</span>
</button>
```

**Card (M, media‑top)**
```html
<article class="rounded-[var(--r-lg)] shadow-[var(--shadow-2)] overflow-hidden transition-shadow
hover:shadow-[var(--shadow-3)]">
  <div class="aspect-[4/3] overflow-hidden">
    <img class="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.01]" />
  </div>
  <div class="p-4 flex items-center justify-between gap-3">
    <div class="min-w-0">
      <h3 class="text-[16px] font-semibold truncate">Gravel</h3>
      <p class="text-sm opacity-80 truncate">Private</p>
    </div>
    <div class="flex items-center gap-2">
      <button class="px-3 h-9 rounded-full shadow-sm">Open</button>
      <button class="px-3 h-9 rounded-full">Edit</button>
    </div>
  </div>
</article>
```

**Chip (filter)**
```html
<button class="h-8 px-3 rounded-full shadow-[var(--shadow-1)]
focus:outline-2 focus:outline-offset-4 transition-colors whitespace-nowrap">
  identity
</button>
```

**Grid**
```html
<section class="grid gap-6
sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
  <!-- Cards go here -->
</section>
```

---

## 10) Implementation Helpers
**Tailwind preset (structure)**
```js
// tailwind.preset.structure.cjs
module.exports = {
  theme: {
    extend: {
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', pill: 'var(--r-pill)'
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)'
      },
      spacing: {
        1: 'var(--s-1)', 2: 'var(--s-2)', 3: 'var(--s-3)', 4: 'var(--s-4)', 5: 'var(--s-5)', 6: 'var(--s-6)', 7: 'var(--s-7)', 8: 'var(--s-8)'
      }
    }
  }
}
```
Usage:
```js
// tailwind.config.js
module.exports = { presets: [require('./tailwind.preset.structure.cjs')] }
```

**Theme & density toggles**
- Dark theme via `.theme-dark` on `<html>` (see Color System).  
- Density via `.density-compact` on a container.

---

## 11) Do / Don’t
**Do**
- Use pill buttons and rounded cards per tokens.  
- Keep **one image, one title, one subline** on cards.  
- Make **Open** the primary action; **Edit** secondary.  
- Keep consistent aspect ratio within rows to reduce jitter.

**Don’t**
- Mix sharp and rounded shapes.  
- Show more than **two** primary actions on a card.  
- Use imageless cards in the normal grid (except the **New project** placeholder).

---

## 12) Cross‑Doc References
- **Stone Trail Color System** (semantic colors, on‑color/state/focus tokens).  
- **Product Accessibility & UX Interaction Guideline** (WCAG 2.2, APG patterns, DoD).  

**End of document**

