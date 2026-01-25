/**
 * Web Worker entry point for the Quick Fix Renderer.
 * Manages the WASM renderer instance and handles messages from the main thread.
 * 
 * REWRITTEN LOCALLY TO FIX WASM LOADING PATH
 */
import init, { QuickFixRenderer, init_panic_hook, RendererOptions, ProcessOptions } from '@JoMe92/quickfix-renderer/quickfix_renderer.js';
import wasmUrl from '@JoMe92/quickfix-renderer/quickfix_renderer_bg.wasm?url';

const ctx = self as any;
let renderer: QuickFixRenderer | null = null;
let wasmInitPromise: Promise<void> | null = null;

// Track the latest request ID to implement cancellation/superseding
let latestRequestId = 0;
// Store source image data to avoid re-transferring on every render
let sourceImage: Uint8Array | null = null;
let sourceWidth = 0;
let sourceHeight = 0;

/**
 * Initializes the WASM module if not already initialized.
 */
async function initializeWasm() {
    if (!wasmInitPromise) {
        // Pass the resolved URL from Vite to init()
        // Updated to pass a configuration object to avoid deprecation warning
        wasmInitPromise = init({ module_or_path: wasmUrl }).then(() => {
            init_panic_hook();
        }) as Promise<void>;
    }
    return wasmInitPromise;
}

ctx.onmessage = async (e: MessageEvent) => {
    const msg = e.data;
    try {
        switch (msg.type) {
            case 'INIT': {
                // Dispose of existing renderer to avoid "Too many active WebGL contexts"
                if (renderer) {
                    try {
                        renderer.free();
                    } catch (err) {
                        console.warn('Failed to free previous renderer:', err);
                    }
                    renderer = null;
                }

                await initializeWasm();

                // Reconstruct options from payload
                const backend = msg.payload.rendererOptions?.backend || 'auto';
                // Note: Types might mismatch slightly if not strictly typed, casting as any for safety
                const options = new RendererOptions(backend === 'auto' ? undefined : backend);

                renderer = QuickFixRenderer.init(options) as unknown as QuickFixRenderer;
                if (renderer instanceof Promise) {
                    renderer = await renderer;
                }

                const response = {
                    type: 'INIT_RESULT',
                    payload: { success: true, backend: renderer!.backend }
                };
                ctx.postMessage(response);
                break;
            }

            case 'SET_IMAGE': {
                const payload = msg.payload
                const newImage = payload.imageData;
                const w = payload.width;
                const h = payload.height;

                if (newImage instanceof ImageBitmap) {
                    const osc = new OffscreenCanvas(w, h);
                    const osCtx = osc.getContext('2d');
                    if (!osCtx)
                        throw new Error("Could not get OffscreenCanvas context");
                    osCtx.drawImage(newImage, 0, 0);
                    const id = osCtx.getImageData(0, 0, w, h);
                    sourceImage = new Uint8Array(id.data.buffer);
                }
                else {
                    sourceImage = new Uint8Array(newImage);
                }
                sourceWidth = w;
                sourceHeight = h;
                // console.log("Worker: Image set", w, h);
                break;
            }

            case 'RENDER': {
                if (!renderer)
                    throw new Error("Renderer not initialized");

                const { requestId, imageData, adjustments } = msg.payload;
                console.log('[Worker] Received adjustments:', JSON.stringify(adjustments).substring(0, 500));
                let { width, height } = msg.payload;

                if (requestId < latestRequestId) {
                    return;
                }
                latestRequestId = requestId;

                const startTime = performance.now();

                // Initialize process options
                // If we have new image data, we don't set a source ID (unless we want to cache it now? 
                // The protocol seems to imply SET_IMAGE is distinct).
                // But wait, the client.ts likely calls SET_IMAGE separately.
                // Actually, let's keep the manual caching or switch to renderer caching?
                // The new renderer supports `sourceId` in options. If provided, it uses cached image. 
                // If imageData is provided AND sourceId is set, it caches that data.

                // Let's adopt the new pattern:
                // If SET_IMAGE comes, we can just call process_frame with empty adjustments but setting sourceId.
                // Or we can keep a local cache if the renderer one is complex.
                // Inspecting the types: `sourceId` is on `ProcessOptions`.

                // Let's try to stick to the existing message structure but use the renderer features.

                let data: Uint8Array = new Uint8Array(0); // Dummy default
                let processOptsPtr: ProcessOptions | undefined;

                if (imageData) {
                    // Stateless render with specific image data
                    if (imageData instanceof ImageBitmap) {
                        const osc = new OffscreenCanvas(width, height);
                        const osCtx = osc.getContext('2d');
                        if (!osCtx) throw new Error("Could not get OffscreenCanvas context");
                        osCtx.drawImage(imageData, 0, 0);
                        const id = osCtx.getImageData(0, 0, width, height);
                        data = new Uint8Array(id.data.buffer);
                    } else {
                        data = new Uint8Array(imageData);
                    }
                } else if (sourceImage) {
                    // Use locally cached source image
                    // Note: We are keeping the local cache for now to ensure stability 
                    // while transitioning, as the renderer's internal cache behavior 
                    // isn't fully visible here without deeper diving into `quickfix_renderer.js`.
                    // However, passing `sourceId` to `process_frame` is how we *should* do it.
                    // But for this step, let's just make it work with v0.3.0 which might require ProcessOptions.
                    data = sourceImage;
                    if (width === 0 && height === 0) {
                        width = sourceWidth;
                        height = sourceHeight;
                    }
                } else {
                    throw new Error("No image data provided and no source image set");
                }

                // Create ProcessOptions if needed (it is now optional in v0.3.0 but good to be explicit)
                const procOpts = new ProcessOptions();
                procOpts.returnImageBitmap = false; // We handle conversion here for now
                // procOpts.sourceId = ... (if we were using renderer caching)

                const result = renderer.process_frame(data, width, height, adjustments, procOpts);
                const finalResult = (result instanceof Promise) ? await result : result;

                // procOpts.free(); // ProcessOptions is consumed by process_frame in v0.3.0

                const endTime = performance.now();

                // Check cancellation again
                if (requestId < latestRequestId) {
                    finalResult.free();
                    return;
                }

                if (finalResult.width === 0 || finalResult.height === 0) {
                    console.error("Worker: Render returned invalid dimensions", finalResult.width, finalResult.height);
                    // throw new Error("Render returned invalid dimensions");
                    // We might want to continue to see what happens, or fail hard.
                }

                const resultData = finalResult.data; // Uint8Array
                const resultBuffer = resultData.buffer; // Ensure ArrayBuffer

                // Copy buffer because resultData is a view into WASM memory which might be invalidated eventually?
                // Wait, `getArrayU8FromWasm0` creates a subarray. `.slice()` in `get data()` creates a copy.
                // line 368: `return getArrayU8FromWasm0(ret[0], ret[1]).slice();`
                // So it is already a copy. Safe to transfer.

                const frameResponse = {
                    type: 'FRAME_READY',
                    payload: {
                        requestId,
                        imageBitmap: resultBuffer,
                        width: finalResult.width,
                        height: finalResult.height,
                        timing: endTime - startTime
                    }
                };

                // Transfer the buffer
                ctx.postMessage(frameResponse, [resultBuffer]);
                finalResult.free();
                break;
            }

            case 'CANCEL':
                if (msg.payload.requestId > latestRequestId) {
                    latestRequestId = msg.payload.requestId;
                }
                break;

            case 'DISPOSE':
                if (renderer) {
                    renderer.free();
                    renderer = null;
                }
                ctx.close();
                break;
        }
    }
    catch (err: any) {
        console.error("Worker Error:", err);
        const errorResponse = {
            type: 'ERROR',
            payload: {
                requestId: msg.payload?.requestId,
                error: err.toString()
            }
        };
        ctx.postMessage(errorResponse);
    }
};
