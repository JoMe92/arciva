
import { describe, it, expect, vi } from 'vitest';
import { calculateCanvasDimensions, SOCIAL_TEMPLATES, renderToCanvas } from '../socialCanvas';

describe('socialCanvas utils', () => {
    describe('calculateCanvasDimensions', () => {
        it('should add vertical padding for a landscape image going into a portrait container', () => {
            const original = { width: 100, height: 50 }; // 2:1
            const ratio = 1; // 1:1 Square

            // Should keep width 100, height becomes 100
            const result = calculateCanvasDimensions(original, ratio);
            expect(result).toEqual({ width: 100, height: 100 });
        });

        it('should add horizontal padding for a portrait image going into a landscape container', () => {
            const original = { width: 50, height: 100 }; // 1:2
            const ratio = 1; // 1:1 Square

            // Should keep height 100, width becomes 100
            const result = calculateCanvasDimensions(original, ratio);
            expect(result).toEqual({ width: 100, height: 100 });
        });

        it('should handle same aspect ratio correctly', () => {
            const original = { width: 100, height: 100 };
            const ratio = 1;
            const result = calculateCanvasDimensions(original, ratio);
            expect(result).toEqual({ width: 100, height: 100 });
        });

        it('should calculate IG Portrait (4:5) correctly for Landscape image', () => {
            const original = { width: 1000, height: 800 }; // 1.25:1
            const template = SOCIAL_TEMPLATES.find(t => t.id === 'ig_portrait')!;
            // Ratio 0.8
            // 1.25 > 0.8, so width is constraint.
            // Height = 1000 / 0.8 = 1250.
            const result = calculateCanvasDimensions(original, template.ratio);
            expect(result).toEqual({ width: 1000, height: 1250 });
        });
    });

    describe('renderToCanvas', () => {
        it('should draw image centered with padding', () => {
            const canvas = document.createElement('canvas');
            const ctx = {
                fillStyle: '',
                fillRect: vi.fn(),
                drawImage: vi.fn(),
            } as unknown as CanvasRenderingContext2D;

            vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);

            // Mock ImageBitmap
            const source = { width: 100, height: 50, close: () => { } } as unknown as ImageBitmap;
            // We need to ensure logic detects it as ImageBitmap or generic object with width/height
            // Since `instanceof ImageBitmap` might fail in jsdom if not globally defined or if we pass a plain object.
            // Let's pass a plain object that satisfies our fallback logic if needed, or rely on jsdom supporting ImageBitmap.
            // jsdom likely doesn't have ImageBitmap. 
            // So our code `if (typeof ImageBitmap ...)` might skip.
            // Let's rely on the fallback `if ('width' in source)` in our code?
            // Wait, our fallback is 'else'.
            // If I pass an object `{ width: 100 }`, it is NOT an instance of anything.
            // But TypeScript expects `CanvasImageSource`.
            // I'll cast it.

            // To hit a specific branch, I can mock global ImageBitmap if needed, but fallback works too.
            // Let's use a fake HTMLCanvasElement which exists in jsdom.
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = 100;
            sourceCanvas.height = 50;

            const target = { width: 100, height: 100 };

            renderToCanvas(sourceCanvas, canvas, target, '#123456');

            expect(canvas.width).toBe(100);
            expect(canvas.height).toBe(100);
            expect(ctx.fillStyle).toBe('#123456');
            expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);

            // Source 100x50. Target 100x100.
            // X = (100-100)/2 = 0.
            // Y = (100-50)/2 = 25.
            expect(ctx.drawImage).toHaveBeenCalledWith(sourceCanvas, 0, 25, 100, 50);
        });
    });
});
