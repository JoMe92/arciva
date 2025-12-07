import { useEffect, useRef, useState } from 'react'
import { createQuickFixClient } from './client'
import type { QuickFixClient } from '@JoMe92/quickfix-renderer/client.js'
import type { QuickFixAdjustments } from '@JoMe92/quickfix-renderer/quickfix_renderer.js'

type WorkerAsset = {
    id: string
    preview_url?: string | null
    thumb_url?: string | null
}

// Singleton instance to share across component re-mounts if needed,
// or we can instantiate inside the hook.
// For now, let's keep it simple: one worker per hook usage (or shared ref).
// Given we only have one QuickFixPanel active, a ref inside the hook or context is fine.
// But since the worker is heavy, maybe a singleton module-level instance is better?
// Let's stick to ref for now to allow cleanup.

let sharedClient: QuickFixClient | null = null

function getClient() {
    if (!sharedClient) {
        sharedClient = createQuickFixClient()
        // Initialize with default options immediately
        sharedClient.init({}).catch(console.error)
    }
    return sharedClient
}

export function useQuickFixRenderer(
    asset: WorkerAsset | null,
    adjustments: QuickFixAdjustments | null
) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Track the currently loaded asset ID in the worker to avoid reloading
    const loadedAssetId = useRef<string | null>(null)
    const lastRenderedUrl = useRef<string | null>(null)

    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        // Cleanup function to revoke URLs
        return () => {
            if (lastRenderedUrl.current) {
                URL.revokeObjectURL(lastRenderedUrl.current)
                lastRenderedUrl.current = null
            }
        }
    }, [])

    useEffect(() => {
        if (!asset) {
            loadedAssetId.current = null
            return
        }

        const client = getClient()

        // Check if we need to load a new image
        if (loadedAssetId.current !== asset.id) {
            let active = true
            setIsProcessing(true)
            setError(null) // Clear previous errors

            const load = async () => {
                let bitmap: ImageBitmap | null = null
                try {
                    // Find the best image source.
                    let url = asset.preview_url || asset.thumb_url
                    if (!url) throw new Error('No image URL found')

                    // Force relative path to use Vite proxy if it points to backend (port 8000)
                    try {
                        const u = new URL(url)
                        if (u.origin === 'http://localhost:8000') {
                            url = u.pathname + u.search
                        }
                    } catch (e) {
                        // ignore
                    }

                    const resp = await fetch(url, { credentials: 'include' })
                    if (!resp.ok) throw new Error('Failed to fetch image')
                    const blob = await resp.blob()

                    if (!active) return

                    bitmap = await createImageBitmap(blob)

                    if (!active) {
                        bitmap.close()
                        return
                    }

                    // Send to worker
                    await client.setImage(bitmap, bitmap.width, bitmap.height)
                    loadedAssetId.current = asset.id

                    // Force a re-render attempt if we have adjustments pending
                    if (adjustments) {
                        // We can't easily trigger the other effect safely, but
                        // if the user moves the slider again, it will work.
                        // Or we could set a state to trigger it.
                    }

                } catch (err) {
                    if (active) {
                        console.error('Failed to load image for Quick Fix:', err)
                        setError(err instanceof Error ? err.message : String(err))
                        if (bitmap) bitmap.close()
                    }
                } finally {
                    if (active) setIsProcessing(false)
                }
            }

            load()
            return () => { active = false }
        }
    }, [asset, reloadKey])

    useEffect(() => {
        // Render when adjustments change
        if (!asset || !adjustments || !loadedAssetId.current || loadedAssetId.current !== asset.id) {
            return
        }

        const client = getClient()
        let active = true
        setIsProcessing(true)

        client.render(null, 0, 0, adjustments)
            .then((result) => {
                if (!active) return

                if (!result.width || !result.height) {
                    console.error('Render failed: Invalid dimensions', result.width, result.height)
                    return
                }
                const array = new Uint8ClampedArray(result.imageBitmap as ArrayBuffer)
                if (array.length !== result.width * result.height * 4) {
                    console.error('Render failed: Data length mismatch')
                    return
                }

                const imageData = new ImageData(array, result.width, result.height)
                const canvas = document.createElement('canvas')
                canvas.width = result.width
                canvas.height = result.height
                const ctx = canvas.getContext('2d')
                ctx?.putImageData(imageData, 0, 0)

                canvas.toBlob((blob) => {
                    if (!active || !blob) return
                    const url = URL.createObjectURL(blob)

                    if (lastRenderedUrl.current) {
                        URL.revokeObjectURL(lastRenderedUrl.current)
                    }
                    lastRenderedUrl.current = url
                    setPreviewUrl(url)
                    setIsProcessing(false)
                })
            })
            .catch((err) => {
                if (active) {
                    console.error('Render failed:', err)
                    setError(String(err))
                    setIsProcessing(false)

                    // Recover from "No image data" error
                    if (String(err).includes('No image data')) {
                        loadedAssetId.current = null
                        setReloadKey(k => k + 1) // Trigger reload
                    }
                }
            })

        return () => { active = false }
    }, [asset, adjustments, reloadKey]) // We might need to serialize adjustments if they are new objects every time

    return { previewUrl, isProcessing, error }
}
