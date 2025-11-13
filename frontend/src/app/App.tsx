import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProjectIndex from '../pages/ProjectIndex'
import ProjectWorkspace from '../features/workspace'

export default function App() {
  const [client] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={client}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<ProjectIndex />} />
          <Route path="/projects/:id" element={<ProjectWorkspace />} />
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
