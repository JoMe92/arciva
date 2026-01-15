import { describe, it, expect } from 'vitest'
import {
    quickFixStateFromApi,
    cropEqual,
    createDefaultQuickFixState,
} from '../quickFixState'

describe('quickFixState', () => {
    describe('quickFixStateFromApi (Sanitization)', () => {
        it('should sanitize numeric aspect ratios correctly', () => {
            const payload = {
                crop: { aspect_ratio: 1.5, rotation: 45 }
            }
            const state = quickFixStateFromApi(payload)
            expect(state?.crop.aspectRatio).toBe(1.5)
            expect(state?.crop.rotation).toBe(45)
        })

        it('should sanitize string aspect ratios correctly', () => {
            const payload = {
                crop: { aspect_ratio: '16:9', rotation: 0 }
            }
            const state = quickFixStateFromApi(payload)
            expect(state?.crop.aspectRatio).toBeCloseTo(1.77777777, 5)
        })

        it('should fallback to null for invalid aspect ratios', () => {
            const payload = {
                crop: { aspect_ratio: -1, rotation: 0 }
            }
            const state = quickFixStateFromApi(payload)
            expect(state?.crop.aspectRatio).toBeNull()
        })

        it('should fallback to null for unknown types', () => {
            const payload = {
                crop: { aspect_ratio: { width: 1 }, rotation: 0 }
            }
            const state = quickFixStateFromApi(payload)
            expect(state?.crop.aspectRatio).toBeNull()
        })
    })

    describe('cropEqual', () => {
        it('should return true for identical numeric ratios', () => {
            const a = { rotation: 0, aspectRatio: 1.5 }
            const b = { rotation: 0, aspectRatio: 1.5 }
            expect(cropEqual(a, b)).toBe(true)
        })

        it('should return true for mathematically close ratios', () => {
            const a = { rotation: 0, aspectRatio: 1.33333 }
            const b = { rotation: 0, aspectRatio: 1.33334 }
            expect(cropEqual(a, b)).toBe(true)
        })

        it('should return true for identical null ratios', () => {
            const a = { rotation: 0, aspectRatio: null }
            const b = { rotation: 0, aspectRatio: null }
            expect(cropEqual(a, b)).toBe(true)
        })

        it('should return false for different ratios', () => {
            const a = { rotation: 0, aspectRatio: 1.5 }
            const b = { rotation: 0, aspectRatio: 1.6 }
            expect(cropEqual(a, b)).toBe(false)
        })

        it('should handle small rotation differences', () => {
            const a = { rotation: 10.0001, aspectRatio: null }
            const b = { rotation: 10.0002, aspectRatio: null }
            expect(cropEqual(a, b)).toBe(true)
        })

        it('should return false for different rotations', () => {
            const a = { rotation: 0, aspectRatio: null }
            const b = { rotation: 1, aspectRatio: null }
            expect(cropEqual(a, b)).toBe(false)
        })
    })
})
