# Frontend-Setup – Schritt für Schritt (für Einsteiger)

Dieses README fasst **alle bisherigen Schritte** zusammen, damit du dein Frontend unter Ubuntu (Firefox + VS Code) problemlos starten und weiterentwickeln kannst. Es ist bewusst einfach gehalten und enthält alle wichtigen Befehle.

---

## 1) Ziel & Stack

Wir bauen ein modernes Frontend mit:

- **Vite** (Dev-Server + Build, ultraschnelles HMR)
- **React** + **TypeScript** (Komponenten, Typen)
- **Tailwind CSS v4** (Styling per Utility-Klassen)
- **TanStack Query** (Daten-Fetching, Cache, Lade-/Fehlerzustände)
- (Optional) **framer-motion** (Animationen)
- (Optional) **ESLint + Prettier** (sauberer Code)

> Ergebnis: Du kannst sofort Komponenten bauen, live im Browser sehen und später problemlos ein Backend (z. B. FastAPI) anbinden.

---

## 2) Voraussetzungen (einmalig)

Ubuntu Terminal:
```bash
# Volta (verwaltet Node & pnpm) – optional, aber sehr praktisch
curl https://get.volta.sh | bash
source ~/.bashrc
volta install node@lts
volta install pnpm
```

VS Code: Extensions installieren
- **ESLint**, **Prettier**, **Tailwind CSS IntelliSense**, **GitLens**, **Error Lens** (optional)

Browser: **React Developer Tools** Add‑on (optional, aber hilfreich)

---

## 3) Projekt-Struktur (vereinfacht)

Wir nutzen den Ordner **`src/`** als Wurzel.

```
project-root/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ postcss.config.js
├─ pnpm-lock.yaml
├─ .gitignore
└─ src/
   ├─ main.tsx          # Einstiegspunkt
   ├─ index.css         # Tailwind v4 Entry
   ├─ app/
   │  └─ App.tsx        # App-Shell, Provider
   └─ pages/
      └─ ProjectIndex.tsx  # Beispiel-Seite
```

> Hinweis: Deine größeren Module/Komponenten kannst du später unter `src/components`, `src/features`, `src/pages` usw. hinzufügen.

---

## 4) Was wurde installiert?

**Runtime (dependencies)**
- `react`, `react-dom` – UI-Bibliothek
- `@tanstack/react-query` – Daten-Fetching/Cache/Status
- `framer-motion` – (optional) Animationen

**Dev (devDependencies)**
- `vite` – Dev-Server/Build
- `typescript`, `@types/react`, `@types/react-dom` – Typen/TS
- `tailwindcss@4`, `@tailwindcss/postcss` – Styling + PostCSS-Plugin
- `postcss`, `autoprefixer` – CSS-Processing (v4 nutzt nur @tailwindcss/postcss)
- `eslint`, `@typescript-eslint/*`, `eslint-config-prettier`, `prettier` – Lint/Format

---

## 5) Wichtige Konfig-Dateien

**`index.html`** – lädt `/src/main.tsx`.

**`vite.config.ts`** – minimal, mit `@vitejs/plugin-react`.

**`tsconfig.json`** – strikte TS-Einstellungen.

**`postcss.config.js`** (Tailwind v4):
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**`src/index.css`** (Tailwind v4):
```css
@import "tailwindcss";
```

> Tailwind v4 **braucht keine** `tailwind.config.js`, außer du willst Themes/Tokens/Plugins ergänzen.

---

## 6) Nützliche npm/pnpm-Skripte

In `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier -w ."
  }
}
```

---

## 7) Development starten (Browser-Ansicht)

Im Projekt-Root:
```bash
pnpm install     # Abhängigkeiten installieren
pnpm run dev     # Dev-Server starten (HMR)
```

Dann **http://localhost:5173** in Firefox öffnen.  
Änderungen an Dateien siehst du sofort (Hot Module Replacement).

---

## 8) Häufige Aufgaben

### Neue Komponente anlegen
```
src/components/Button.tsx
```
```tsx
import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
export default function Button({ loading, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border bg-white hover:shadow focus:outline-none focus-visible:ring"
      aria-busy={loading || undefined}
    >
      {loading ? '…' : children}
    </button>
  )
}
```

### Seite hinzufügen
```
src/pages/Dashboard.tsx
```
```tsx
export default function Dashboard() {
  return <div className="p-6">Dashboard</div>
}
```

### Daten laden mit TanStack Query
```tsx
import { useQuery } from '@tanstack/react-query'

function Todos() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const r = await fetch('/api/todos')
      if (!r.ok) throw new Error('Network error')
      return r.json() as Promise<{ id:number; title:string }[]>
    },
  })

  if (isLoading) return <p className="p-4">Lade…</p>
  if (isError) return <p className="p-4 text-red-600">Fehler</p>
  if (!data?.length) return <p className="p-4 opacity-70">Keine Einträge.</p>

  return (
    <ul className="p-4 grid gap-2">
      {data.map(t => <li key={t.id} className="rounded border bg-white p-3">{t.title}</li>)}
    </ul>
  )
}
```

---

## 9) Git & `.gitignore`

**Committen:** Quellcode (`src/**`), Konfiguration, `index.html`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, Lockfile `pnpm-lock.yaml`.

**Ignorieren:** `node_modules/`, `dist/`, `.vite/`, Logs.

Empfohlene `.gitignore`:
```gitignore
node_modules/
.pnpm-store/
pnpm-debug.log*

# Vite
dist/
.vite/

# TypeScript
*.tsbuildinfo

# Editor/OS
.DS_Store
Thumbs.db
.idea/
.vscode/**/*
!.vscode/settings.json
!.vscode/extensions.json

# Env
.env
.env.local
.env.*.local
```

---

## 10) Troubleshooting (kurz)

- **`Missing script: dev`** → In `package.json` muss `"dev": "vite"` stehen.
- **`Cannot find package '@vitejs/plugin-react'`** → `pnpm add -D @vitejs/plugin-react`.
- **Tailwind lädt nicht** → `src/index.css` muss `@import "tailwindcss";` enthalten und `postcss.config.js` das Plugin `@tailwindcss/postcss`.
- **`pnpm approve-builds` Warnung** → einmal ausführen, ggf. `pnpm rebuild esbuild`.
- **Port belegt** → `pnpm run dev -- --port 5174`.

---

## 11) Wie geht’s jetzt weiter?

1. **UI fachlich strukturieren**: `src/components`, `src/features/<domain>`, `src/pages`.
2. **Design-System**: wiederverwendbare Komponenten (Button, Card, Modal), Farbtokens, Spacing.
3. **Routing** (optional): `react-router-dom` hinzufügen.
4. **API-Anbindung**: später `/api` via Vite-Proxy oder gleiche Origin mit Backend (z. B. FastAPI).
5. **Storybook** (optional): Komponenten isoliert entwickeln.
6. **Tests** (optional): Vitest + Testing Library.

Beispiel-Befehle:
```bash
# Router
pnpm add react-router-dom

# Storybook (optional)
pnpm dlx storybook@latest init
pnpm run storybook

# Tests (optional)
pnpm add -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/dom
```

---

## 12) Mini‑FAQ

- **Brauche ich Tailwind-CLI?** Nein, Vite + PostCSS reichen (v4). CLI ist optional.
- **Kann ich Ordner groß/klein schreiben?** Ja, aber beachte: Linux ist **case‑sensitive** → Im Import exakt schreiben.
- **Soll ich `node_modules` committen?** Nein. Lockfile committen ja (`pnpm-lock.yaml`).

---

Viel Spaß beim Bauen! Wenn du möchtest, kann dieses README als Startseite im Repo bleiben. Ergänze es einfach mit team‑spezifischen Konventionen, Branch‑Strategie, CI‑Anweisungen und API-Infos.

