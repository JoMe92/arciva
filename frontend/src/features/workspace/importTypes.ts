import type { ImgType } from './types'

export type PendingItem = {
  id: string
  name: string
  type: ImgType
  previewUrl?: string | null
  source: 'local' | 'hub'
  selected: boolean
  size: number
  file?: File | null
  meta?: {
    folder?: string
    relativePath?: string
  }
  ready?: boolean
}
