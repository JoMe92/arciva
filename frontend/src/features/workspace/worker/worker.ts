/**
 * Web Worker entry point for the Quick Fix Renderer.
 * Manages the WASM renderer instance and handles messages from the main thread.
 * 
 * REWRITTEN LOCALLY TO FIX WASM LOADING PATH
 */
import init, { QuickFixRenderer, init_panic_hook, RendererOptions } from '@JoMe92/quickfix-renderer/quickfix_renderer.js';
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
            case 'INIT':
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

                renderer = QuickFixRenderer.init(options) as unknown as QuickFixRenderer; // static init returns promise? No, based on d.ts it returns QuickFixRenderer directly or Promise?
                // worker.js: renderer = await QuickFixRenderer.init(options);
                // Let's check init signature in js file: static init(options) { ... return ret; } where ret is from wasm.quickfixrenderer_init
                // It usually returns the instance directly in wasm-bindgen classes unless async.
                // Wait, worker.js says `await QuickFixRenderer.init(options)`.
                // Let's re-read line 35 of worker.js: `renderer = await QuickFixRenderer.init(options);`
                // But line 492 of quickfix_renderer.js: `static init(options) { ... return ret; }`
                // Does `wasm.quickfixrenderer_init` return a promise?
                // Usually `wasm-bindgen` functions are synchronous unless async.
                // If `worker.js` awaits it, maybe it is async or maybe it's just safe awaiting.
                // Let's assume await is fine.

                // Wait, line 35 in worker.js: `renderer = await QuickFixRenderer.init(options);`
                // But line 498 in quickfix_renderer.js: `const ret = wasm.quickfixrenderer_init(ptr0); return ret;`
                // This looks synchronous. The await might be superfluous in worker.js or I misread something.
                // I will include await to match behavior.
                if (renderer instanceof Promise) {
                    renderer = await renderer;
                }

                const response = {
                    type: 'INIT_RESULT',
                    payload: { success: true, backend: renderer!.backend }
                };
                ctx.postMessage(response);
                break;

            case 'SET_IMAGE':
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

            case 'RENDER':
                if (!renderer)
                    throw new Error("Renderer not initialized");

                let { requestId, imageData, width, height, adjustments } = msg.payload;

                // Cancellation check
                if (requestId < latestRequestId) {
                    return;
                }
                latestRequestId = requestId;

                const startTime = performance.now();

                // Determine which image data to use
                let data: Uint8Array;
                if (imageData) {
                    // Use provided image data (stateless mode)
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
                    data = sourceImage;
                    if (width === 0 && height === 0) {
                        width = sourceWidth;
                        height = sourceHeight;
                    }
                } else {
                    throw new Error("No image data provided and no source image set");
                }

                const result = renderer.process_frame(data, width, height, adjustments, undefined);
                // process_frame might return Promise or direct?
                // quickfix_renderer.js line 463: returns ret.
                // signature says returns Promise<FrameResult> in JSDoc line 461.
                // So we await it.
                const finalResult = (result instanceof Promise) ? await result : result;

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
