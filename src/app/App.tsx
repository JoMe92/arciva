import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProjectIndex from '../pages/ProjectIndex'

export default function App() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
        <ProjectIndex />
      </div>
    </QueryClientProvider>
  )
}
