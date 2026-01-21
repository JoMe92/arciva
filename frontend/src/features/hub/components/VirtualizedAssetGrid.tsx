
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { HubViewMode, VirtualMetrics } from '../types'

type VirtualizedGridProps<T> = {
    items: T[]
    viewMode: HubViewMode
    estimateHeight: number
    columnWidth: number
    gap: number
    renderItem: (item: T) => React.ReactNode
    onScrollMetrics?: (metrics: VirtualMetrics) => void
}

export default function VirtualizedAssetGrid<T>({
    items,
    viewMode,
    estimateHeight,
    columnWidth,
    gap,
    renderItem,
    onScrollMetrics,
}: VirtualizedGridProps<T>) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [viewportHeight, setViewportHeight] = useState(0)
    const [viewportWidth, setViewportWidth] = useState(0)

    useEffect(() => {
        const node = scrollRef.current
        if (!node) return
        const handleScroll = () => {
            setScrollTop(node.scrollTop)
            if (onScrollMetrics) {
                onScrollMetrics({
                    scrollTop: node.scrollTop,
                    scrollHeight: node.scrollHeight,
                    clientHeight: node.clientHeight,
                })
            }
        }
        node.addEventListener('scroll', handleScroll)
        handleScroll()
        return () => node.removeEventListener('scroll', handleScroll)
    }, [onScrollMetrics])

    useEffect(() => {
        const node = scrollRef.current
        if (!node) return
        const observer = new ResizeObserver((entries) => {
            if (!entries.length) return
            const rect = entries[0].contentRect
            setViewportHeight(rect.height)
            setViewportWidth(rect.width)
        })
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    const columns = useMemo(() => {
        if (viewMode === 'list') return 1
        if (!viewportWidth) return 1
        const effective = Math.max(columnWidth, 120)
        const rawColumns = Math.floor((viewportWidth + gap) / (effective + gap))
        return Math.max(1, rawColumns)
    }, [viewMode, viewportWidth, columnWidth, gap])

    const rowHeight = estimateHeight
    const rowStride = rowHeight + gap
    const overscan = 3
    const totalRows = Math.max(1, Math.ceil(items.length / columns))
    const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - overscan)
    const endRow = Math.min(
        totalRows,
        Math.ceil((scrollTop + (viewportHeight || rowStride)) / rowStride) + overscan
    )
    const startIndex = Math.min(items.length, startRow * columns)
    const endIndex = Math.min(items.length, endRow * columns)
    const visible = items.slice(startIndex, endIndex)
    const paddingTop = startRow * rowStride
    const paddingBottom = Math.max(0, (totalRows - endRow) * rowStride)

    return (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
            <div
                style={{
                    paddingTop,
                    paddingBottom,
                    paddingLeft: viewMode === 'list' ? 0 : 2,
                    paddingRight: viewMode === 'list' ? 0 : 2,
                }}
            >
                <div
                    className={viewMode === 'grid' ? 'grid gap-3' : 'flex flex-col gap-2'}
                    style={
                        viewMode === 'grid'
                            ? { gridTemplateColumns: `repeat(${columns}, minmax(${columnWidth}px, 1fr))` }
                            : undefined
                    }
                >
                    {visible.map((item) => renderItem(item))}
                </div>
            </div>
        </div>
    )
}
