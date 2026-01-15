
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
