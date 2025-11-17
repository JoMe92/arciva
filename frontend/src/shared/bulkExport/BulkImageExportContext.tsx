import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { exportAllProjectImages, type BulkImageExportProgress, type BulkImageExportResult } from '../api/bulkImageExports'
import { triggerBrowserDownload } from '../downloads'

type BulkExportPhase = 'idle' | 'running' | 'success' | 'error'

type BulkExportState = {
  phase: BulkExportPhase
  progress: BulkImageExportProgress
  error: string | null
  result: BulkImageExportResult | null
}

type BulkExportContextValue = {
  state: BulkExportState
  startExport: () => Promise<void>
  cancelExport: () => void
  dismissExport: () => void
  downloadResult: () => void
}

const initialState: BulkExportState = {
  phase: 'idle',
  progress: { completed: 0, total: 0 },
  error: null,
  result: null,
}

const BulkExportContext = createContext<BulkExportContextValue | undefined>(undefined)

export const BulkExportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<BulkExportState>(initialState)
  const controllerRef = useRef<AbortController | null>(null)
  const downloadUrlRef = useRef<string | null>(null)
  const autoDownloadRef = useRef<string | null>(null)

  useEffect(() => {
    const nextUrl = state.result?.downloadUrl ?? null
    if (downloadUrlRef.current && downloadUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(downloadUrlRef.current)
    }
    downloadUrlRef.current = nextUrl
  }, [state.result?.downloadUrl])

  useEffect(() => {
    if (state.phase !== 'success') return
    const jobId = state.result?.jobId
    if (!state.result?.downloadUrl || !jobId) return
    if (autoDownloadRef.current === jobId) return
    triggerBrowserDownload(state.result.downloadUrl, state.result.downloadFilename)
    autoDownloadRef.current = jobId
  }, [state.phase, state.result?.downloadFilename, state.result?.downloadUrl, state.result?.jobId])

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current)
      }
    }
  }, [])

  const startExport = useCallback(async () => {
    if (state.phase === 'running') return
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    autoDownloadRef.current = null
    setState({
      phase: 'running',
      progress: { completed: 0, total: 0 },
      error: null,
      result: null,
    })
    try {
      const result = await exportAllProjectImages({
        signal: controller.signal,
        onProgress: (snapshot) => {
          setState((prev) => {
            if (prev.phase !== 'running') return prev
            return { ...prev, progress: { completed: snapshot.completed, total: snapshot.total } }
          })
        },
      })
      setState({
        phase: 'success',
        progress: { completed: result.totalFiles, total: result.totalFiles },
        error: null,
        result,
      })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setState(initialState)
      } else {
        setState({
          phase: 'error',
          progress: { completed: 0, total: 0 },
          error: error instanceof Error ? error.message : 'Unable to export images.',
          result: null,
        })
      }
    } finally {
      controllerRef.current = null
    }
  }, [state.phase])

  const cancelExport = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    autoDownloadRef.current = null
    setState(initialState)
  }, [])

  const dismissExport = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    autoDownloadRef.current = null
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current)
      downloadUrlRef.current = null
    }
    setState(initialState)
  }, [])

  const downloadResult = useCallback(() => {
    if (!state.result?.downloadUrl) return
    triggerBrowserDownload(state.result.downloadUrl, state.result.downloadFilename)
  }, [state.result])

  const value = useMemo(
    () => ({
      state,
      startExport,
      cancelExport,
      dismissExport,
      downloadResult,
    }),
    [state, startExport, cancelExport, dismissExport, downloadResult],
  )

  return <BulkExportContext.Provider value={value}>{children}</BulkExportContext.Provider>
}

export function useBulkImageExport() {
  const ctx = useContext(BulkExportContext)
  if (!ctx) {
    throw new Error('useBulkImageExport must be used within a BulkExportProvider')
  }
  return ctx
}
