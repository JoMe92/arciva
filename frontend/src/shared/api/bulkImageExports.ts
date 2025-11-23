import { requireBase, withBase } from './base'

export type BulkImageExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type BulkImageExportProgress = {
  completed: number
  total: number
}

export type BulkImageExportResult = {
  jobId: string
  status: BulkImageExportJobStatus
  totalFiles: number
  downloadUrl?: string | null
  downloadFilename?: string | null
  dateBasis: string
  folderTemplate: string
}

export type BulkImageExportEstimate = {
  totalFiles: number
  totalBytes: number
  dateBasis: string
  folderTemplate: string
}

export type BulkImageExportOptions = {
  signal?: AbortSignal
  onProgress?: (snapshot: BulkImageExportProgress) => void
}

type BulkImageExportJobRecord = {
  id: string
  status: BulkImageExportJobStatus
  progress: number
  processed_files: number
  total_files: number
  download_url?: string | null
  artifact_filename?: string | null
  artifact_size?: number | null
  date_basis: string
  folder_template: string
  error_message?: string | null
}

const BULK_EXPORT_ENDPOINT = '/v1/bulk-image-exports'
const POLL_INTERVAL_MS = 1500

export async function getBulkExportEstimate(options: BulkImageExportOptions = {}): Promise<BulkImageExportEstimate> {
  const res = await fetch(requireBase(`${BULK_EXPORT_ENDPOINT}/estimate`), {
    credentials: 'include',
    signal: options.signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  const payload = (await res.json()) as {
    total_files: number
    total_bytes: number
    date_basis: string
    folder_template: string
  }
  return {
    totalFiles: payload.total_files,
    totalBytes: payload.total_bytes,
    dateBasis: payload.date_basis,
    folderTemplate: payload.folder_template,
  }
}

export async function exportAllProjectImages(options: BulkImageExportOptions = {}): Promise<BulkImageExportResult> {
  const res = await fetch(requireBase(BULK_EXPORT_ENDPOINT), {
    method: 'POST',
    credentials: 'include',
    signal: options.signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  let job = (await res.json()) as BulkImageExportJobRecord
  const initialTotal = job.total_files ?? 0
  options.onProgress?.({ completed: job.processed_files ?? 0, total: initialTotal })
  job = await waitForBulkExport(job.id, initialTotal, options)
  const blob = await downloadBulkExport(job, options)
  const downloadUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : null
  return {
    jobId: job.id,
    status: job.status,
    totalFiles: job.total_files,
    downloadUrl,
    downloadFilename: job.artifact_filename,
    dateBasis: job.date_basis,
    folderTemplate: job.folder_template,
  }
}

async function waitForBulkExport(jobId: string, total: number, options: BulkImageExportOptions): Promise<BulkImageExportJobRecord> {
  let job = await fetchBulkExport(jobId, options.signal)
  options.onProgress?.({
    completed: job.processed_files ?? 0,
    total: job.total_files ?? total,
  })
  while (job.status === 'queued' || job.status === 'running') {
    await delay(POLL_INTERVAL_MS, options.signal)
    job = await fetchBulkExport(jobId, options.signal)
    options.onProgress?.({
      completed: job.processed_files ?? 0,
      total: job.total_files ?? total,
    })
  }
  if (job.status !== 'completed') {
    throw new Error(job.error_message || 'Image export failed.')
  }
  return job
}

async function fetchBulkExport(jobId: string, signal?: AbortSignal): Promise<BulkImageExportJobRecord> {
  const res = await fetch(requireBase(`${BULK_EXPORT_ENDPOINT}/${jobId}`), {
    credentials: 'include',
    signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as BulkImageExportJobRecord
}

async function downloadBulkExport(job: BulkImageExportJobRecord, options: BulkImageExportOptions): Promise<Blob> {
  const downloadPath = job.download_url ?? `${BULK_EXPORT_ENDPOINT}/${job.id}/download`
  const downloadUrl = withBase(downloadPath)
  if (!downloadUrl) {
    throw new Error('Export artifact unavailable.')
  }
  const res = await fetch(downloadUrl, {
    credentials: 'include',
    signal: options.signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return await res.blob()
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError())
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(createAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Export aborted', 'AbortError')
  }
  const error = new Error('Export aborted')
  ;(error as Error & { name?: string }).name = 'AbortError'
  return error
}
