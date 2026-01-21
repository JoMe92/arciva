
import React from 'react'
import type { ImageHubDateBucket } from '../../../shared/api/hub'
import { formatCount } from '../utils'

type DateDrilldownProps = {
    level: 'year' | 'month' | 'day'
    buckets: ImageHubDateBucket[]
    isLoading: boolean
    error: Error | null
    selection: { year?: number; month?: number; day?: number }
    onSelect: (next: { year?: number; month?: number; day?: number }) => void
}

export default function DateDrilldown({
    level,
    buckets,
    isLoading,
    error,
    selection,
    onSelect,
}: DateDrilldownProps) {
    const goBack = () => {
        if (level === 'month') onSelect({})
        else if (level === 'day') onSelect({ year: selection.year })
    }
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[var(--border,#E1D3B9)] px-4 py-3 text-sm font-semibold">
                <span>{level === 'year' ? 'Years' : level === 'month' ? 'Months' : 'Days'}</span>
                {level !== 'year' && (
                    <button
                        type="button"
                        className="text-xs text-[var(--river-500,#6B7C7A)]"
                        onClick={goBack}
                    >
                        Back
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">Loading…</div>
                ) : error ? (
                    <div className="p-4 text-xs text-[#B42318]">Failed to load. {error.message}</div>
                ) : !buckets.length ? (
                    <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">
                        No assets found in this source.
                    </div>
                ) : (
                    <ul>
                        {buckets.map((bucket) => {
                            const isActive =
                                level === 'year'
                                    ? selection.year === bucket.year
                                    : level === 'month'
                                        ? selection.month === bucket.month && selection.year === bucket.year
                                        : selection.day === bucket.day &&
                                        selection.month === bucket.month &&
                                        selection.year === bucket.year
                            return (
                                <li key={bucket.key}>
                                    <button
                                        type="button"
                                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[var(--sand-50,#FBF7EF)] ${isActive ? 'bg-[var(--sand-100,#F3EBDD)] font-semibold' : ''}`}
                                        onClick={() => {
                                            if (level === 'year') onSelect({ year: bucket.year })
                                            else if (level === 'month')
                                                onSelect({ year: selection.year, month: bucket.month ?? undefined })
                                            else if (level === 'day')
                                                onSelect({
                                                    year: selection.year,
                                                    month: selection.month,
                                                    day: bucket.day ?? undefined,
                                                })
                                        }}
                                    >
                                        <span>{bucket.label}</span>
                                        <span className="text-xs text-[var(--text-muted,#6B645B)]">
                                            {formatCount(bucket.asset_count)}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}
