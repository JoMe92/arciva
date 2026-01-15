import { describe, it, expect, vi } from 'vitest'
import { mapAssetToPhoto } from '../ProjectWorkspace'
import * as assetsApi from '../../../shared/api/assets'

// Mock dependencies of mapAssetToPhoto
vi.mock('../../../shared/api/assets', () => ({
    assetThumbUrl: vi.fn((item) => `thumb-${item.id}.jpg`),
    assetPreviewUrl: vi.fn((item) => `preview-${item.id}.jpg`),
}))

describe('mapAssetToPhoto', () => {
    const mockAsset = {
        id: 'asset-1',
        original_filename: 'test.jpg',
        width: 4000,
        height: 3000,
        status: 'READY' as const,
        completed_at: new Date().toISOString(),
    }

    it('sets hasEdits to true when metadata_state.edits is present', () => {
        const item: any = {
            ...mockAsset,
            metadata_state: {
                edits: {
                    quick_fix: { exposure: { exposure: 1.0 } }
                }
            }
        }
        const photo = mapAssetToPhoto(item)
        expect(photo.hasEdits).toBe(true)
    })

    it('sets hasEdits to false when metadata_state.edits is empty', () => {
        const item: any = {
            ...mockAsset,
            metadata_state: {
                edits: {}
            }
        }
        const photo = mapAssetToPhoto(item)
        expect(photo.hasEdits).toBe(false)
    })

    it('sets hasEdits to false when metadata_state is missing', () => {
        const item: any = {
            ...mockAsset
        }
        const photo = mapAssetToPhoto(item)
        expect(photo.hasEdits).toBe(false)
    })

    it('sets hasEdits to false when metadata_state.edits is null', () => {
        const item: any = {
            ...mockAsset,
            metadata_state: {
                edits: null
            }
        }
        const photo = mapAssetToPhoto(item)
        expect(photo.hasEdits).toBe(false)
    })
})
