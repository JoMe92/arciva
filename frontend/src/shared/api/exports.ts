export type ExportFileFormat = 'JPEG' | 'TIFF' | 'PNG'
export type RawHandlingStrategy = 'raw' | 'developed'
export type ExportSizeMode = 'original' | 'resize'
export type ContactSheetFormat = 'JPEG' | 'TIFF' | 'PDF'

export type ExportPhotosPayload = {
  photoIds: string[]
  outputFormat: ExportFileFormat
  rawHandling: RawHandlingStrategy
  sizeMode: ExportSizeMode
  longEdge: number
  jpegQuality: number
  contactSheetEnabled: boolean
  contactSheetFormat: ContactSheetFormat
  folderPath: string
  presetId?: string | null
}

export type ExportProgressSnapshot = {
  completed: number
  total: number
}

export type ExportPhotosResponse = {
  exported: number
  folderPath: string
}

export type ExportPhotosOptions = {
  signal?: AbortSignal
  onProgress?: (snapshot: ExportProgressSnapshot) => void
}

const MIN_STEP_MS = 220
const MAX_STEP_MS = 420

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Placeholder implementation for exporting photos.
 *
 * The backend endpoints are not implemented yet, so this helper simulates
 * a long-running export so the UI can provide progress feedback. Once the
 * API is available, replace this with a real fetch() call.
 */
export async function exportSelectedPhotos(payload: ExportPhotosPayload, options: ExportPhotosOptions = {}): Promise<ExportPhotosResponse> {
  const total = Math.max(payload.photoIds.length, 1)
  options.onProgress?.({ completed: 0, total })
  for (let idx = 0; idx < payload.photoIds.length; idx += 1) {
    if (options.signal?.aborted) {
      throw createAbortError()
    }
    const duration = MIN_STEP_MS + Math.random() * (MAX_STEP_MS - MIN_STEP_MS)
    await delay(duration)
    options.onProgress?.({ completed: idx + 1, total })
  }
  if (options.signal?.aborted) {
    throw createAbortError()
  }
  await delay(260)
  return { exported: payload.photoIds.length, folderPath: payload.folderPath }
}

function createAbortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Export aborted', 'AbortError')
  }
  const error = new Error('Export aborted')
  ;(error as Error & { name?: string }).name = 'AbortError'
  return error
}
