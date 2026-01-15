
export interface AspectRatioTemplate {
    id: string;
    label: string;
    ratio: number; // width / height
    description?: string;
}

export const SOCIAL_TEMPLATES: AspectRatioTemplate[] = [
    { id: 'ig_portrait', label: 'Instagram Portrait', ratio: 4 / 5, description: '4:5' },
    { id: 'square', label: 'Square', ratio: 1 / 1, description: '1:1' },
    { id: 'landscape', label: 'Landscape', ratio: 1.91 / 1, description: '1.91:1' },
    { id: 'story', label: 'Story', ratio: 9 / 16, description: '9:16' },
];

export interface Dimensions {
    width: number;
    height: number;
}

/**
 * Calculates the target dimensions for the canvas based on the original image dimensions
 * and the desired aspect ratio. The strategy is to fit the image entirely within the 
 * canvas (object-fit: contain), so we increase the dimension that is deficient 
 * to meet the target ratio.
 */
export function calculateCanvasDimensions(
    original: Dimensions,
    ratio: number
): Dimensions {
    const originalRatio = original.width / original.height;

    // Use a small epsilon for floating point comparison if needed, 
    // but for simple ratio logic > or < is usually sufficient logic delimiter.

    if (originalRatio > ratio) {
        // Original is "wider" than target. 
        // Example: Orig 100x50 (2:1), Target 1:1.
        // We must increase Height to matches width/ratio. 
        // 100 / 1 = 100. New size 100x100.
        return {
            width: original.width,
            height: Math.round(original.width / ratio)
        };
    } else {
        // Original is "taller" or equal aspect to target.
        // Example: Orig 50x100 (1:2), Target 1:1.
        // We must increase Width.
        // 100 * 1 = 100. New size 100x100.
        return {
            width: Math.round(original.height * ratio),
            height: original.height
        };
    }
}

/**
 * Renders the source image onto a canvas with the target dimensions,
 * applying the specified background color and centering the image (object-fit: contain).
 */
export function renderToCanvas(
    source: CanvasImageSource,
    canvas: HTMLCanvasElement,
    targetDimensions: Dimensions,
    backgroundColor: string = '#ffffff'
): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Set canvas size
    canvas.width = targetDimensions.width;
    canvas.height = targetDimensions.height;

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate draw position (Center image)
    let srcWidth = 0;
    let srcHeight = 0;

    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
        srcWidth = source.width;
        srcHeight = source.height;
    } else if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
        srcWidth = source.naturalWidth;
        srcHeight = source.naturalHeight;
    } else if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
        srcWidth = source.width;
        srcHeight = source.height;
    } else if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
        srcWidth = source.videoWidth;
        srcHeight = source.videoHeight;
    } else {
        // Fallback
        if ('width' in source) srcWidth = (source as any).width;
        if ('height' in source) srcHeight = (source as any).height;
    }

    // Draw centered
    const dstX = (targetDimensions.width - srcWidth) / 2;
    const dstY = (targetDimensions.height - srcHeight) / 2;

    ctx.drawImage(source, dstX, dstY, srcWidth, srcHeight);
}

