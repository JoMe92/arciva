import React, { useRef, useState, useCallback, useMemo } from 'react'
import { CurvePoint } from '../quickFixState'
import { getSplinePath } from './SplineUtils'

type CurveEditorProps = {
    points: CurvePoint[]
    onChange: (points: CurvePoint[]) => void
    color: string
    disabled?: boolean
}

const VIEWBOX_SIZE = 256
const CONTROL_POINT_RADIUS = 6
const HOVER_RADIUS = 10

export function CurveEditor({ points, onChange, color, disabled }: CurveEditorProps) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [activePointIndex, setActivePointIndex] = useState<number | null>(null)
    const [dragging, setDragging] = useState(false)

    // Ensure points are sorted
    const sortedPoints = useMemo(() => {
        return [...points].sort((a, b) => a.x - b.x)
    }, [points])

    const getSvgCoordinates = useCallback(
        (clientX: number, clientY: number) => {
            if (!svgRef.current) return null
            const rect = svgRef.current.getBoundingClientRect()
            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
            const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
            return { x, y }
        },
        []
    )

    const handlePointerDown = useCallback(
        (event: React.PointerEvent) => {
            if (disabled) return
            const coords = getSvgCoordinates(event.clientX, event.clientY)
            if (!coords) return

            // Check if clicking near an existing point
            const HIT_THRESHOLD = 0.05
            let foundIndex = -1

            // Check in reverse to prefer top-most (though usually disjoint)
            for (let i = sortedPoints.length - 1; i >= 0; i--) {
                const p = sortedPoints[i]
                const dist = Math.sqrt((p.x - coords.x) ** 2 + (p.y - coords.y) ** 2)
                if (dist < HIT_THRESHOLD) {
                    foundIndex = i
                    break
                }
            }

            if (foundIndex !== -1) {
                setActivePointIndex(foundIndex)
                setDragging(true)
                event.currentTarget.setPointerCapture(event.pointerId)
            } else {
                // Add new point
                const newPoint = { x: coords.x, y: coords.y }
                const newPoints = [...sortedPoints, newPoint].sort((a, b) => a.x - b.x)
                onChange(newPoints)
                // Find where it landed to start dragging immediately
                const newIndex = newPoints.findIndex((p) => p === newPoint)
                setActivePointIndex(newIndex)
                setDragging(true)
                event.currentTarget.setPointerCapture(event.pointerId)
            }
        },
        [disabled, getSvgCoordinates, onChange, sortedPoints]
    )

    const handlePointerMove = useCallback(
        (event: React.PointerEvent) => {
            if (!dragging || activePointIndex === null || disabled) return
            const coords = getSvgCoordinates(event.clientX, event.clientY)
            if (!coords) return

            const currentPoint = sortedPoints[activePointIndex]

            // Update point position
            // Constraints:
            // 1. x must be between prev and next points (unless endpoints)
            // 2. endpoints (0 and 1) are usually fixed to x=0 and x=1? 
            //    Standard curves usually fix x=0 and x=1 points, but allow y changes.
            //    However, usually you CANNOT delete the endpoints, but you can move them vertically.
            //    Let's assume endpoints are constrained to x=0 and x=1.

            let newX = coords.x
            const isFirst = activePointIndex === 0
            const isLast = activePointIndex === sortedPoints.length - 1

            if (isFirst) newX = 0
            else if (isLast) newX = 1
            else {
                // Constrain X between neighbors to maintain sort order
                const prevX = sortedPoints[activePointIndex - 1].x + 0.01
                const nextX = sortedPoints[activePointIndex + 1].x - 0.01
                newX = Math.max(prevX, Math.min(nextX, newX))
            }

            const newPoint = { x: newX, y: coords.y }
            const nextPoints = [...sortedPoints]
            nextPoints[activePointIndex] = newPoint
            onChange(nextPoints)
        },
        [dragging, activePointIndex, disabled, getSvgCoordinates, sortedPoints, onChange]
    )

    const handlePointerUp = useCallback(
        (event: React.PointerEvent) => {
            setDragging(false)
            setActivePointIndex(null)
            event.currentTarget.releasePointerCapture(event.pointerId)
        },
        []
    )

    const handleDoubleClick = useCallback((event: React.MouseEvent) => {
        if (disabled) return
        // We need to re-calculate hit test since pointer down might have initiated it
        // Actually simplest way is if we are hovering a point
        // But context menu is better or just drag out?
        // Let's implement: double click to delete (if not endpoint)
    }, [])

    // Handle Double Click explicitly on points for deletion
    const handleDeletePoint = (index: number, e: React.MouseEvent) => {
        e.stopPropagation()
        if (disabled) return
        if (index === 0 || index === sortedPoints.length - 1) return // Can't delete endpoints

        const newPoints = sortedPoints.filter((_, i) => i !== index)
        onChange(newPoints)
        setActivePointIndex(null)
        setDragging(false)
    }

    const pathData = useMemo(() => {
        return getSplinePath(sortedPoints, VIEWBOX_SIZE, VIEWBOX_SIZE)
    }, [sortedPoints])

    return (
        <div className="relative aspect-square w-full select-none rounded bg-[var(--surface-muted,#F3EBDD)] p-2">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
                className="h-full w-full overflow-visible touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                {/* Grid */}
                <path
                    d={`M ${VIEWBOX_SIZE * 0.25} 0 V ${VIEWBOX_SIZE} M ${VIEWBOX_SIZE * 0.5} 0 V ${VIEWBOX_SIZE} M ${VIEWBOX_SIZE * 0.75} 0 V ${VIEWBOX_SIZE}`}
                    stroke="var(--border,#EDE1C6)"
                    strokeWidth="1"
                    fill="none"
                />
                <path
                    d={`M 0 ${VIEWBOX_SIZE * 0.25} H ${VIEWBOX_SIZE} M 0 ${VIEWBOX_SIZE * 0.5} H ${VIEWBOX_SIZE} M 0 ${VIEWBOX_SIZE * 0.75} H ${VIEWBOX_SIZE}`}
                    stroke="var(--border,#EDE1C6)"
                    strokeWidth="1"
                    fill="none"
                />
                <path
                    d={`M 0 ${VIEWBOX_SIZE} L ${VIEWBOX_SIZE} 0`}
                    stroke="var(--border,#EDE1C6)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    fill="none"
                />

                {/* Boundary */}
                <rect
                    x="0"
                    y="0"
                    width={VIEWBOX_SIZE}
                    height={VIEWBOX_SIZE}
                    fill="none"
                    stroke="var(--text-muted,#6B645B)"
                    strokeOpacity="0.2"
                    strokeWidth="1"
                />

                {/* Curve */}
                <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Control Points */}
                {sortedPoints.map((p, i) => {
                    const px = p.x * VIEWBOX_SIZE
                    const py = (1 - p.y) * VIEWBOX_SIZE

                    return (
                        <g key={i} transform={`translate(${px}, ${py})`}>
                            {/* Hit target (larger) */}
                            <circle
                                r={HOVER_RADIUS}
                                fill="transparent"
                                className="cursor-pointer"
                                onDoubleClick={(e) => handleDeletePoint(i, e)}
                            />
                            {/* Visual point */}
                            <circle
                                r={CONTROL_POINT_RADIUS}
                                fill="var(--surface,#FFFFFF)"
                                stroke={color}
                                strokeWidth="1.5"
                                className="pointer-events-none"
                            />
                            {activePointIndex === i && dragging && (
                                <circle
                                    r={CONTROL_POINT_RADIUS + 4}
                                    fill={color}
                                    opacity="0.2"
                                    className="pointer-events-none"
                                />
                            )}
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}
