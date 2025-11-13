import { withBase } from './base'

export type MetadataInheritanceMode = 'always' | 'ask' | 'never'

export type ImageHubSettings = {
  metadata_inheritance: MetadataInheritanceMode
}

export async function getImageHubSettings(): Promise<ImageHubSettings> {
  const res = await fetch(withBase('/v1/settings/image-hub')!, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubSettings
}

export async function updateImageHubSettings(payload: ImageHubSettings): Promise<ImageHubSettings> {
  const res = await fetch(withBase('/v1/settings/image-hub')!, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
  return (await res.json()) as ImageHubSettings
}
