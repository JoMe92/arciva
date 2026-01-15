import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProjectIndex from '../pages/ProjectIndex'
import ProjectWorkspace from '../features/workspace'
import ImageHub from '../pages/ImageHub'
import { BulkExportProvider } from '../shared/bulkExport/BulkImageExportContext'
import BulkExportIndicator from '../components/BulkExportIndicator'
import PwaInstallPrompt from '../components/PwaInstallPrompt'
import { AuthProvider, useAuth } from '../features/auth/AuthContext'
import AuthGate from '../features/auth/AuthGate'
import Splash from '../components/Splash'

const AppRoutes: React.FC = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<ProjectIndex />} />
      <Route path="/projects/:id" element={<ProjectWorkspace />} />
      <Route path="/hub" element={<ImageHub />} />
      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
)

const ProtectedApp: React.FC = () => {
  const { user, initializing } = useAuth()

  if (initializing) {
    return <Splash />
  }

  if (!user) {
    return <AuthGate />
  }

  return (
    <BulkExportProvider>
      <AppRoutes />
      <BulkExportIndicator />
      <PwaInstallPrompt />
    </BulkExportProvider>
  )
}

export default function App() {
  const [client] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </QueryClientProvider>
  )
}
