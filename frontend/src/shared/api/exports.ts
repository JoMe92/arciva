import { requireBase, withBase } from './base'

export type ExportFileFormat = 'JPEG' | 'TIFF' | 'PNG'
export type RawHandlingStrategy = 'raw' | 'developed'
export type ExportSizeMode = 'original' | 'resize'
export type ContactSheetFormat = 'JPEG' | 'TIFF' | 'PDF'

export type ExportPhotosPayload = {
  projectId: string
  photoIds: string[]
  outputFormat: ExportFileFormat
  rawHandling: RawHandlingStrategy
  sizeMode: ExportSizeMode
  longEdge: number
  jpegQuality: number
  contactSheetEnabled: boolean
  contactSheetFormat: ContactSheetFormat
}

export type ExportProgressSnapshot = {
  completed: number
  total: number
}

export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type ExportPhotosResponse = {
  jobId: string
  status: ExportJobStatus
  exported: number
  downloadUrl?: string | null
  downloadFilename?: string | null
}

export type ExportPhotosOptions = {
  signal?: AbortSignal
  onProgress?: (snapshot: ExportProgressSnapshot) => void
}

type ExportJobRecord = {
  id: string
  project_id: string
  status: ExportJobStatus
  progress: number
  total_photos: number
  exported_files: number
  download_url?: string | null
  artifact_filename?: string | null
  error_message?: string | null
}

const EXPORT_JOBS_ENDPOINT = '/v1/export-jobs'
const POLL_INTERVAL_MS = 1200

export async function exportSelectedPhotos(payload: ExportPhotosPayload, options: ExportPhotosOptions = {}): Promise<ExportPhotosResponse> {
  if (!payload.projectId) {
    throw new Error('Project id required for exports.')
  }
  const totalPhotos = Math.max(payload.photoIds.length, 1)
  options.onProgress?.({ completed: 0, total: totalPhotos })

  const body = {
    project_id: payload.projectId,
    photo_ids: payload.photoIds,
    settings: {
      output_format: payload.outputFormat,
      raw_handling: payload.rawHandling,
      size_mode: payload.sizeMode,
      long_edge: payload.sizeMode === 'resize' ? payload.longEdge : undefined,
      jpeg_quality: payload.jpegQuality,
      contact_sheet_enabled: payload.contactSheetEnabled,
      contact_sheet_format: payload.contactSheetFormat,
    },
  }

  const createRes = await fetch(requireBase(EXPORT_JOBS_ENDPOINT), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal: options.signal,
  })
  if (!createRes.ok) {
    throw new Error(await createRes.text())
  }
  let job: ExportJobRecord = await createRes.json()
  const normalizedTotal = job.total_photos ?? totalPhotos
  options.onProgress?.({ completed: job.exported_files ?? 0, total: normalizedTotal })

  job = await waitForJobCompletion(job.id, normalizedTotal, options)
  const blob = await downloadArtifact(job, options)
  const filename = job.artifact_filename ?? `arciva-export-${job.id.slice(0, 8)}.zip`
  const downloadUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : null

  return {
    jobId: job.id,
    status: job.status,
    exported: job.exported_files ?? normalizedTotal,
    downloadUrl,
    downloadFilename: filename,
  }
}

async function waitForJobCompletion(jobId: string, total: number, options: ExportPhotosOptions): Promise<ExportJobRecord> {
  let job = await fetchJob(jobId, options.signal)
  options.onProgress?.({ completed: job.exported_files ?? 0, total })
  while (job.status === 'queued' || job.status === 'running') {
    await delay(POLL_INTERVAL_MS, options.signal)
    job = await fetchJob(jobId, options.signal)
    options.onProgress?.({ completed: job.exported_files ?? 0, total })
  }
  if (job.status !== 'completed') {
    throw new Error(job.error_message ?? 'Export failed.')
  }
  return job
}

async function fetchJob(jobId: string, signal?: AbortSignal): Promise<ExportJobRecord> {
  const res = await fetch(requireBase(`${EXPORT_JOBS_ENDPOINT}/${jobId}`), {
    credentials: 'include',
    signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ExportJobRecord
}

async function downloadArtifact(job: ExportJobRecord, options: ExportPhotosOptions): Promise<Blob> {
  if (!job.download_url) {
    throw new Error(job.error_message ?? 'Export artifact unavailable.')
  }
  const downloadHref = withBase(job.download_url) ?? requireBase(job.download_url)
  const res = await fetch(downloadHref, {
    credentials: 'include',
    signal: options.signal,
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return await res.blob()
}

function delay(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(createAbortError())
  }
  return new Promise<void>((resolve, reject) => {
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
