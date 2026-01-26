import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchImageHubAssets, type ImageHubDateBucket } from '../../../shared/api/hub'
import { ChevronRightIcon, FolderIcon, CalendarIcon } from '../../workspace/components/icons'
import { localizedMonthLabel } from '../../workspace/utils'
import { formatCount } from '../utils'

type DateTreeProps = {
    filtersPayload: any
    selection: { year?: number; month?: number; day?: number }
    onSelect: (next: { year?: number; month?: number; day?: number }) => void
}

export default function DateTree({ filtersPayload, selection, onSelect }: DateTreeProps) {
    const { data: years, isLoading, error } = useQuery({
        queryKey: ['imagehub-tree-years', filtersPayload],
        queryFn: async () => {
            const res = await fetchImageHubAssets({
                mode: 'date',
                limit: 0,
                filters: filtersPayload,
            })
            return res.buckets ?? []
        },
    })

    if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">Loading dates…</div>
    if (error) return <div className="p-4 text-xs text-[#B42318]">Failed to load dates</div>
    if (!years?.length) return <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">No dates found</div>

    return (
        <ul className="flex flex-col">
            {years.map((bucket) => (
                <DateTreeNode
                    key={bucket.key}
                    bucket={bucket}
                    level="year"
                    filtersPayload={filtersPayload}
                    selection={selection}
                    onSelect={onSelect}
                />
            ))}
        </ul>
    )
}

type DateTreeNodeProps = {
    bucket: ImageHubDateBucket
    level: 'year' | 'month' | 'day'
    filtersPayload: any
    selection: { year?: number; month?: number; day?: number }
    onSelect: (next: { year?: number; month?: number; day?: number }) => void
}

function DateTreeNode({ bucket, level, filtersPayload, selection, onSelect }: DateTreeNodeProps) {
    const [expanded, setExpanded] = useState(false)

    // Determine if this node is active based on selection
    const isActive =
        (level === 'year' && selection.year === bucket.year && !selection.month) ||
        (level === 'month' && selection.year === bucket.year && selection.month === bucket.month && !selection.day) ||
        (level === 'day' && selection.year === bucket.year && selection.month === bucket.month && selection.day === bucket.day)

    // Auto-expand if a child is selected
    // (This works for initial load too if we check selection against bucket)
    React.useEffect(() => {
        if (level === 'year' && selection.year === bucket.year) setExpanded(true)
        if (level === 'month' && selection.year === bucket.year && selection.month === bucket.month) setExpanded(true)
    }, [selection, level, bucket])

    const isLeaf = level === 'day'

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation()
        setExpanded(!expanded)
    }

    const handleSelect = () => {
        if (level === 'year') onSelect({ year: bucket.year })
        else if (level === 'month') onSelect({ year: bucket.year, month: bucket.month! })
        else if (level === 'day') onSelect({ year: bucket.year, month: bucket.month!, day: bucket.day! })
    }

    // Prepare children query
    const shouldFetchChildren = expanded && !isLeaf
    const nextLevel = level === 'year' ? 'month' : 'day'
    const queryKey = ['imagehub-tree-children', level, bucket.year, bucket.month, filtersPayload]

    const { data: children, isLoading } = useQuery({
        queryKey,
        enabled: shouldFetchChildren,
        queryFn: async () => {
            const res = await fetchImageHubAssets({
                mode: 'date',
                year: bucket.year,
                month: level === 'month' ? bucket.month! : undefined,
                limit: 0,
                filters: filtersPayload,
            })
            return res.buckets ?? []
        },
    })

    const label =
        level === 'year'
            ? String(bucket.year)
            : level === 'month'
                ? localizedMonthLabel(new Date(bucket.year, bucket.month! - 1))
                : String(bucket.day)

    return (
        <li className="select-none">
            <div
                className={`flex cursor-pointer items-center gap-1 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--sand-50,#FBF7EF)] ${isActive ? 'bg-[var(--sand-100,#F3EBDD)] font-semibold text-[var(--text,#1F1E1B)]' : 'text-[var(--text,#1F1E1B)]'
                    }`}
                onClick={handleSelect}
                style={{ paddingLeft: level === 'year' ? 12 : level === 'month' ? 28 : 44 }}
            >
                {!isLeaf ? (
                    <button
                        type="button"
                        onClick={handleToggle}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-transform ${expanded ? 'rotate-90' : ''}`}
                    >
                        <ChevronRightIcon className="h-3 w-3 text-[var(--text-muted,#6B645B)]" />
                    </button>
                ) : (
                    <span className="w-4" />
                )}

                <span className="flex-1 truncate">{label}</span>
                <span className="text-xs text-[var(--text-muted,#6B645B)]">{formatCount(bucket.asset_count)}</span>
            </div>

            {expanded && !isLeaf && (
                <div>
                    {isLoading ? (
                        <div className="py-1 pl-12 text-xs text-[var(--text-muted,#6B645B)]">Loading…</div>
                    ) : children?.length ? (
                        <ul className="flex flex-col">
                            {children.map((child) => (
                                <DateTreeNode
                                    key={child.key}
                                    bucket={child}
                                    level={nextLevel}
                                    filtersPayload={filtersPayload}
                                    selection={selection}
                                    onSelect={onSelect}
                                />
                            ))}
                        </ul>
                    ) : (
                        <div className="py-1 pl-12 text-xs text-[var(--text-muted,#6B645B)]">No items</div>
                    )}
                </div>
            )}
        </li>
    )
}
