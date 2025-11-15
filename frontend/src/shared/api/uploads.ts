import { requireBase } from './base'

export type InitUploadPayload = {
  filename: string
  sizeBytes: number
  mimeType: string
}

export type InitUploadResponse = {
  assetId: string
  uploadToken: string
  maxBytes: number
}

export type PutUploadResponse = {
  ok: boolean
  bytes: number
}

export type CompleteUploadOptions = {
  ignoreDuplicates?: boolean
}

export type CompleteUploadResponse = {
  status: string
  assetId?: string
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function extractErrorMessage(status: number, payload: Record<string, unknown> | null, fallback: string): string {
  if (payload) {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
  }
  return `${fallback} (status ${status})`
}

export async function initUpload(projectId: string, payload: InitUploadPayload): Promise<InitUploadResponse> {
  const res = await fetch(requireBase(`/v1/projects/${projectId}/uploads/init`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: payload.filename,
      size_bytes: payload.sizeBytes,
      mime: payload.mimeType,
    }),
  })

  if (!res.ok) {
    const body = await parseJsonSafe<Record<string, unknown>>(res)
    throw new Error(extractErrorMessage(res.status, body, 'Failed to prepare upload'))
  }

  const data = (await res.json()) as { asset_id: string; upload_token: string; max_bytes: number }
  return {
    assetId: data.asset_id,
    uploadToken: data.upload_token,
    maxBytes: data.max_bytes,
  }
}

export function putUpload(
  assetId: string,
  file: Blob,
  token: string,
  onProgress?: (event: ProgressEvent<EventTarget>) => void,
): Promise<PutUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', requireBase(`/v1/uploads/${assetId}`))
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Upload-Token', token)

    xhr.upload.onprogress = (event) => {
      if (onProgress) onProgress(event)
    }

    xhr.onerror = () => {
      reject(new Error('Network error while uploading file'))
    }

    xhr.onload = async () => {
      const status = xhr.status
      if (status < 200 || status >= 300) {
        let payload: Record<string, unknown> | null = null
        try {
          payload = JSON.parse(xhr.responseText)
        } catch {
          payload = null
        }
        reject(new Error(extractErrorMessage(status, payload, 'Upload failed')))
        return
      }

      try {
        const payload = JSON.parse(xhr.responseText || '{}')
        resolve({ ok: Boolean(payload.ok), bytes: Number(payload.bytes) || file.size })
      } catch {
        resolve({ ok: true, bytes: file.size })
      }
    }

    xhr.send(file)
  })
}

export async function completeUpload(
  assetId: string,
  token: string,
  options: CompleteUploadOptions,
): Promise<CompleteUploadResponse> {
  const res = await fetch(requireBase('/v1/uploads/complete'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Upload-Token': token,
    },
    credentials: 'include',
    body: JSON.stringify({
      asset_id: assetId,
      ignore_duplicates: options.ignoreDuplicates ?? false,
    }),
  })

  if (!res.ok) {
    const body = await parseJsonSafe<Record<string, unknown>>(res)
    throw new Error(extractErrorMessage(res.status, body, 'Failed to finalize upload'))
  }

  const data = (await res.json()) as { status: string; asset_id?: string }
  return { status: data.status, assetId: data.asset_id }
}
