import type { Project } from './types';

/**
 * Generate a simple numeric-to-string converter. Some libraries require
 * stringified numeric attributes on SVG elements; this helper avoids
 * sprinkling String() calls throughout the code.
 */
export const S = (n: number) => String(n);

/**
 * Create a placeholder graphic as a data URI. This function accepts
 * dimensions and a label and returns an SVG encoded as a data URL.
 *
 * @param w - width of the placeholder
 * @param h - height of the placeholder
 * @param label - text to display on the placeholder
 */
export function ph(w: number, h: number, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#FBF7EF'/>
        <stop offset='100%' stop-color='#EADFCB'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <circle cx='${w * 0.78}' cy='${h * 0.22}' r='${Math.min(w, h) * 0.08}' fill='#A56A4A' fill-opacity='0.9'/>
    <rect x='${w * 0.08}' y='${h * 0.8}' width='${w * 0.54}' height='${Math.max(10, h * 0.06)}' rx='8' fill='#4A463F' fill-opacity='0.9'/>
    <text x='16' y='26' font-family='ui-sans-serif, system-ui' font-size='14' fill='#4A463F' opacity='0.8'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Determine placeholder dimensions based on a project's aspect ratio.
 * Portrait placeholders are taller, landscape wider, and square equal.
 */
export function phSizeFor(a: Project['aspect']): [number, number] {
  return a === 'portrait'
    ? [900, 1125]
    : a === 'landscape'
    ? [1600, 900]
    : [1200, 1200];
}

/**
 * Compute a Tailwind aspect ratio class from a project aspect value.
 */
export function aspectClass(a: Project['aspect']): string {
  return a === 'portrait'
    ? 'aspect-[4/5]'
    : a === 'landscape'
    ? 'aspect-[16/9]'
    : 'aspect-square';
}

/**
 * Create a sorted array of unique strings. This helper is used for
 * deduplicating clients and tags in the filter bar.
 */
export function unique(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

// Row composition utilities. These functions slice an input array into
// rows following a repeating pattern of lengths (2,3,1,4). The pattern
// aims to balance the grid layout visually without rearranging items.
const pattern = [2, 3, 1, 4];

/**
 * Compose a list of projects into a nested array representing rows.
 * Items remain in order; each row contains between 1 and 4 items
 * depending on the pattern.
 */
export function composeRows<T>(arr: T[]): T[][] {
  const rows: T[][] = [];
  let i = 0;
  let p = 0;
  while (i < arr.length) {
    const take = Math.min(pattern[p % pattern.length], arr.length - i);
    rows.push(arr.slice(i, i + take));
    i += take;
    p++;
  }
  return rows;
}