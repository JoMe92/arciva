export type Point = { x: number; y: number }

/**
 * Calculates a monotonic cubic spline interpolation for a set of points.
 * Returns a function that maps x to y.
 */
export function createMonotoneSpline(points: Point[]): (x: number) => number {
    const n = points.length
    if (n === 0) {
        return () => 0
    }
    if (n === 1) {
        return () => points[0].y
    }

    // Sort points by x just in case
    const sorted = [...points].sort((a, b) => a.x - b.x)
    const x = sorted.map((p) => p.x)
    const y = sorted.map((p) => p.y)

    // Get consecutive differences and slopes
    const dx: number[] = []
    const dy: number[] = []
    const slope: number[] = []
    for (let i = 0; i < n - 1; i++) {
        dx.push(x[i + 1] - x[i])
        dy.push(y[i + 1] - y[i])
        slope.push(dy[i] / dx[i])
    }

    // Get degree-1 coefficients
    const m: number[] = new Array(n).fill(0)
    m[0] = slope[0]
    m[n - 1] = slope[n - 2]
    for (let i = 1; i < n - 1; i++) {
        const sl = slope[i - 1]
        const sr = slope[i]
        if (sl * sr <= 0) {
            m[i] = 0
        } else {
            m[i] = (3 * sl * sr) / (Math.max(sl, sr) + 2 * Math.min(sl, sr)) // weighted harmonic mean (Fritsch-Butland)
            // Standard monotone uses simple average or other means, but this is robust.
            // Alternatively, simple valid tangent:
            // m[i] = (sl + sr) / 2
        }
    }

    // Returns y for a given tx
    return (tx: number) => {
        // Clamp to range
        if (tx <= x[0]) return y[0]
        if (tx >= x[n - 1]) return y[n - 1]

        // Find segment
        let i = 0
        // Linear search is fine for small N (usually < 20 points for curves)
        while (i < n - 2 && tx > x[i + 1]) {
            i++
        }

        const h = dx[i]
        const t = (tx - x[i]) / h
        const t2 = t * t
        const t3 = t2 * t
        const h00 = 2 * t3 - 3 * t2 + 1
        const h10 = t3 - 2 * t2 + t
        const h01 = -2 * t3 + 3 * t2
        const h11 = t3 - t2

        const yVal = h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1]
        return Math.max(0, Math.min(1, yVal))
    }
}

/**
 * Generates an SVG path data string for the spline.
 * @param points Control points (0-1 range)
 * @param width Width of the SVG viewbox
 * @param height Height of the SVG viewbox
 * @param resolution Number of segments to approximate the curve
 */
export function getSplinePath(
    points: Point[],
    width: number,
    height: number,
    resolution = 100
): string {
    if (points.length < 2) return ''
    const spline = createMonotoneSpline(points)

    let path = `M 0 ${height - spline(0) * height}`

    for (let i = 1; i <= resolution; i++) {
        const t = i / resolution
        const xVal = t * width
        const yNorm = spline(t)
        const yVal = height - yNorm * height
        path += ` L ${xVal.toFixed(1)} ${yVal.toFixed(1)}`
    }

    return path
}
