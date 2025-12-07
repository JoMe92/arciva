import { useEffect, useRef, useState } from 'react'
import { getQuickFixClient } from './client' // Fixed import
import type { QuickFixAdjustments } from '@JoMe92/quickfix-renderer/quickfix_renderer.js'

type WorkerAsset = {
    id: string
    preview_url?: string | null
    thumb_url?: string | null
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

        const client = getQuickFixClient()

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

    // Conflation optimization ref setup
    const renderingRef = useRef(false)
    const pendingAdjustmentsRef = useRef<QuickFixAdjustments | null>(null)
    const activeRef = useRef(true)

    // Update pending adjustments ref whenever adjustments change
    useEffect(() => {
        pendingAdjustmentsRef.current = adjustments
    }, [adjustments])

    // Driver loop for rendering
    useEffect(() => {
        activeRef.current = true

        // This function attempts to process the next pending render
        const processNext = async () => {
            if (!activeRef.current) return

            // If already rendering, do nothing. The current render loop will pick up the next value when finished.
            if (renderingRef.current) return

            // If no asset loaded or id mismatch, wait.
            if (!asset || !loadedAssetId.current || loadedAssetId.current !== asset.id) return

            // If no pending adjustments (shouldn't happen if we are triggered correctly), stop.
            if (!pendingAdjustmentsRef.current) return

            renderingRef.current = true
            setIsProcessing(true)

            // Capture the exact adjustments we are about to render
            const currentAdjustments = pendingAdjustmentsRef.current

            try {
                const client = getQuickFixClient()
                const result = await client.render(null, 0, 0, currentAdjustments)

                if (!activeRef.current) {
                    renderingRef.current = false
                    return
                }

                if (!result.width || !result.height) {
                    console.error('Render failed: Invalid dimensions', result.width, result.height)
                } else {
                    const array = new Uint8ClampedArray(result.imageBitmap as ArrayBuffer)
                    if (array.length === result.width * result.height * 4) {
                        const imageData = new ImageData(array, result.width, result.height)
                        // Create canvas off-screen
                        const canvas = document.createElement('canvas')
                        canvas.width = result.width
                        canvas.height = result.height
                        const ctx = canvas.getContext('2d')
                        ctx?.putImageData(imageData, 0, 0)

                        canvas.toBlob((blob) => {
                            if (!activeRef.current || !blob) return
                            const url = URL.createObjectURL(blob)
                            if (lastRenderedUrl.current) {
                                URL.revokeObjectURL(lastRenderedUrl.current)
                            }
                            lastRenderedUrl.current = url
                            setPreviewUrl(url)

                            // Only clear processing if we are truly caught up
                            if (pendingAdjustmentsRef.current === currentAdjustments) {
                                setIsProcessing(false)
                            }
                        })
                    } else {
                        console.error('Render failed: Data length mismatch')
                    }
                }
            } catch (err) {
                if (activeRef.current) {
                    console.error('Render failed:', err)
                    setError(String(err))
                    setIsProcessing(false)
                    // Recover from "No image data" error
                    if (String(err).includes('No image data')) {
                        loadedAssetId.current = null
                        setReloadKey(k => k + 1)
                    }
                }
            } finally {
                renderingRef.current = false

                // Recursion check: If pending adjustments have changed while we were rendering, process again immediately.
                if (activeRef.current && pendingAdjustmentsRef.current !== currentAdjustments) {
                    // Use setTimeout to avoid strictly recursive stack overflow, though async await handles stack depth usually.
                    // A microtask via simple call is fine here.
                    processNext()
                } else if (activeRef.current) {
                    setIsProcessing(false)
                }
            }
        }

        // Trigger processing whenever adjustments or asset/reload key changes
        // This is the "kick" to start the loop.
        processNext()

        return () => { activeRef.current = false }
    }, [asset, adjustments, reloadKey])

    return { previewUrl, isProcessing, error }
}
