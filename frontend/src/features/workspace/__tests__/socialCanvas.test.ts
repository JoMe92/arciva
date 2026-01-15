
import { describe, it, expect } from 'vitest';
import { calculateCanvasDimensions, SOCIAL_TEMPLATES } from '../socialCanvas';

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
});
