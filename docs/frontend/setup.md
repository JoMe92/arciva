# Frontend setup (Vite + React + Tailwind v4)

Quick onboarding for frontend contributors. The SPA talks to the FastAPI backend on `http://localhost:8000` by default.

## Prerequisites
- Pixi installed (`curl -fsSL https://pixi.sh/install.sh | bash`)
- Backend/API available (run `pixi run dev-stack` or your own backend)

## 1) Install & configure
```bash
pixi install
cp frontend/.env.example frontend/.env.local   # optional; override API target if needed
```
`frontend/.env.local` can set `VITE_API_BASE_URL` to point at a remote backend. For local HTTPS dev, see `docs/frontend/dev-https.md`.

## 2) Run & scripts
```bash
pixi run dev-frontend   # http://localhost:5173
pixi run build-frontend
pixi run lint-frontend
```

## 3) Tooling & patterns
- Vite + React + TypeScript; Tailwind v4 via `@tailwindcss/postcss` (see `frontend/postcss.config.js`).
- Data fetching with TanStack Query (see `src/features` for patterns).
- Assets served by the backend in production; during dev the Vite server proxies to the API.

## 4) Troubleshooting
- Tailwind not applied → ensure `src/index.css` imports `@import "tailwindcss";` and PostCSS config includes `@tailwindcss/postcss`.
- Missing deps → rerun `pixi install` (installs pnpm + JS deps) or `pnpm install` inside `frontend/`.
- Port 5173 busy → `pixi run dev-frontend -- --port 5174`.
- API base wrong → set `VITE_API_BASE_URL` in `frontend/.env.local` (include protocol + port).
