# Frontend setup (Vite + React + Tailwind v4)

Quick onboarding for frontend contributors. Uses the same Pixi environment as the backend.

## Prerequisites
- Pixi installed (`curl -fsSL https://pixi.sh/install.sh | bash`)
- API available on `http://localhost:8000` (from `pixi run dev-stack` or your own backend)

## 1) Install + configure
```bash
pixi install
cp frontend/.env.example frontend/.env.local   # optional; SPA falls back to current host:8000
```
`frontend/.env.local` overrides the API target (`VITE_API_BASE_URL`) if you hit a remote backend.

## 2) Run
```bash
pixi run dev-frontend   # serves on http://localhost:5173
```
- Builds: `pixi run build-frontend`
- Lint: `pixi run lint-frontend`

## 3) Stack + patterns
- Vite dev server with React + TypeScript
- Tailwind v4 (no config file required)
- TanStack Query for data fetching; see `src/features` for usage patterns

If you need HTTPS locally, set `DEV_SERVER_HTTPS=true` and point `DEV_SERVER_HTTPS_KEY/CERT` at your certs in `frontend/.env.local`.

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
