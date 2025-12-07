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

            const load = async () => {
                try {
                    // Find the best image source. Ideally the preview or a medium derivative.
                    // Using preview_url if available, otherwise finding a suitable derivative.
                    let url = asset.preview_url || asset.thumb_url
                    if (!url) throw new Error('No image URL found')

                    // Force relative path to use Vite proxy if it points to backend (port 8000)
                    // This avoids CORS issues since index.html is on 5173
                    try {
                        const u = new URL(url)
                        if (u.origin === 'http://localhost:8000') {
                            url = u.pathname + u.search
                        }
                    } catch (e) {
                        // ignore if invalid or already relative
                    }

                    // Fetch the image
                    const resp = await fetch(url, { credentials: 'include' })
                    if (!resp.ok) throw new Error('Failed to fetch image')
                    const blob = await resp.blob()
                    const bitmap = await createImageBitmap(blob)

                    if (!active) return

                    // Send to worker
                    await client.setImage(bitmap, bitmap.width, bitmap.height)
                    loadedAssetId.current = asset.id

                    // Trigger a render if we have adjustments
                    if (adjustments) {
                        // This will be handled by the next effect or we can force it here.
                        // But let's let the adjustment effect handle rendering.
                    }
                } catch (err) {
                    if (active) {
                        console.error('Failed to load image for Quick Fix:', err)
                        setError(err instanceof Error ? err.message : String(err))
                    }
                } finally {
                    if (active) setIsProcessing(false)
                }
            }

            load()
            return () => { active = false }
        }
    }, [asset])

    useEffect(() => {
        // Render when adjustments change
        if (!asset || !adjustments || !loadedAssetId.current || loadedAssetId.current !== asset.id) {
            // If no image is loaded OR the loaded image does not match current asset, wait.
            return
        }

        const client = getClient()
        let active = true
        setIsProcessing(true)

        client.render(null, 0, 0, adjustments)
            .then((result) => {
                if (!active) return

                // Result contains imageBitmap as ArrayBuffer (from our worker wrapper)
                // We need to convert it to a Blob URL
                // Actually the worker returns raw bytes?
                // Wait, the worker.js does:
                // const id = osCtx.getImageData(...) -> returns ImageData
                // result.data -> Uint8Array (RGBA pixels usually if from Canvas)
                // If it's raw RGBA, we can't just make a Blob of it and expect 'image/png'.
                // We need to put it back on a canvas or use createImageBitmap if it's formatted.
                // The WASM renderer likely returns raw pixel data (RGBA).

                // Let's re-read the worker implementation.
                // worker.js: renderer.process_frame returns FrameResult.
                // result.data is Uint8Array.
                // It does NOT encode to PNG.

                // So we receive raw RGBA pixels.
                // To display this, we can:
                // 1. Put it on a canvas.
                // 2. Encode to PNG/JPEG in worker (if WASM supports it).
                // 3. Main thread: new ImageData(new Uint8ClampedArray(buffer), width, height), put on canvas, toBlob/toDataURL.

                // Since we want a URL for an <img> tag (previewUrl), we probably want a blob.
                // Efficient way:
                const imageData = new ImageData(
                    new Uint8ClampedArray(result.imageBitmap as ArrayBuffer),
                    result.width,
                    result.height
                )
                const canvas = document.createElement('canvas')
                canvas.width = result.width
                canvas.height = result.height
                const ctx = canvas.getContext('2d')
                ctx?.putImageData(imageData, 0, 0)

                canvas.toBlob((blob) => {
                    if (!active || !blob) return
                    const url = URL.createObjectURL(blob)

                    // Revoke old URL
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
                }
            })

        return () => { active = false }
    }, [asset, adjustments]) // We might need to serialize adjustments if they are new objects every time

    return { previewUrl, isProcessing, error }
}
