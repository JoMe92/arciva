# Learning: React & Vite Frontend

The Arciva frontend is a Single Page Application (SPA) built with **React**, **TypeScript**, and **Vite**. It prioritizes speed, type safety, and a scalable architecture.

## Core Concepts

### 1. Feature-Based Architecture

Instead of grouping files by type (e.g., `components/`, `hooks/`), we group them by **domain feature**. This makes the codebase easier to navigate as it grows.

**Structure (`frontend/src/features/`):**

* `auth/`: Login forms, user context, auth hooks.
* `projects/`: Project list, project card components, API calls for projects.
* `workspace/`: The main photo editing interface.

**Inside a Feature Folder:**

* `components/`: React components specific to this feature.
* `api/`: Functions that call the backend API (using `fetch` or `axios`).
* `hooks/`: Custom React hooks (often wrapping React Query).
* `types.ts`: TypeScript interfaces for this domain.

### 2. Server State with React Query

We use **TanStack Query (React Query)** to manage data fetching. It handles caching, loading states, and re-fetching automatically.

**Example (Fetching Projects):**

```tsx
// features/projects/api/useProjects.ts
import { useQuery } from '@tanstack/react-query';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    }
  });
};
```

**Usage in Component:**

```tsx
const { data: projects, isLoading, error } = useProjects();

if (isLoading) return <Spinner />;
if (error) return <ErrorBanner message={error.message} />;

return <ProjectList items={projects} />;
```

### 3. Styling with TailwindCSS

We use **TailwindCSS** for styling. It allows us to write styles directly in our JSX using utility classes, ensuring consistency and reducing context switching.

**Example:**

```tsx
<div className="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
  <h2 className="text-xl font-bold text-gray-800">{project.name}</h2>
</div>
```

### 4. Build Tool: Vite

**Vite** is our build tool. It provides:

* **Instant Server Start**: Uses native ES modules during dev.
* **Hot Module Replacement (HMR)**: Updates the UI instantly when you save a file.
* **Optimized Build**: Bundles the app for production using Rollup.

## Further Reading

* [React Documentation](https://react.dev/)
* [TanStack Query Docs](https://tanstack.com/query/latest)
* [TailwindCSS Docs](https://tailwindcss.com/docs)
* [Vite Guide](https://vitejs.dev/guide/)
