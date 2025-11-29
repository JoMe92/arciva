# Learning: Frontend Structure Explained

This document breaks down the `frontend/` directory, explaining our Feature-Based Architecture.

## Top-Level Structure

```text
frontend/
├── src/                 # The source code
├── public/              # Static assets (favicon, robots.txt)
├── index.html           # The HTML entry point
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
└── tailwind.config.js   # TailwindCSS configuration
```

## The `src/` Directory

This is where 99% of your work happens.

```text
src/
├── features/            # Domain-specific code (The Core)
├── components/          # Global UI components (Buttons, Inputs)
├── shared/              # Shared utilities, hooks, and types
├── pages/               # Route definitions (Pages)
├── App.tsx              # Main App component (Providers, Router)
└── main.tsx             # Entry point (Mounts React to DOM)
```

### 1. `features/` (The Domain Logic)

We organize code by **what it does**, not **what it is**.

* **`auth/`**: Everything related to logging in.
* **`projects/`**: Everything related to viewing/editing projects.
* **`workspace/`**: The photo editor interface.

**Inside a Feature Folder:**

```text
features/projects/
├── components/          # Components used ONLY in Projects (e.g., ProjectCard)
├── api/                 # API calls (e.g., fetchProjects)
├── hooks/               # React hooks (e.g., useProjects)
└── types.ts             # TypeScript interfaces (e.g., Project)
```

### 2. `components/` (Global UI)

These are "dumb" UI components that are reusable across the entire app. They don't know about "Projects" or "Users".

* `Button.tsx`
* `Modal.tsx`
* `Spinner.tsx`

### 3. `shared/` (Utilities)

Helper functions and hooks that are used everywhere.

* `utils/`: Date formatting, string manipulation.
* `hooks/`: `useDebounce`, `useLocalStorage`.

### 4. `pages/` (Routing)

These components act as the "glue". They correspond to a URL route (e.g., `/projects`) and assemble components from `features/`.

**Example (`pages/ProjectsPage.tsx`):**

```tsx
import { ProjectList } from '../features/projects/components/ProjectList';

export const ProjectsPage = () => {
  return (
    <Layout>
      <h1>My Projects</h1>
      <ProjectList />
    </Layout>
  );
};
```

## Common Workflows

### Creating a New Feature

1. Create a new folder in `src/features/` (e.g., `settings/`).
2. Add `components/`, `api/`, `hooks/` subfolders.
3. Build your logic there.

### Adding a New Page

1. Create the page component in `src/pages/`.
2. Add the route in `src/App.tsx` (or your router configuration).
