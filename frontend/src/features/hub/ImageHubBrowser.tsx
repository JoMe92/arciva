
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
    fetchImageHubProjects,
    fetchImageHubAssets,
    type ImageHubAsset,
    type ImageHubProject,
} from '../../shared/api/hub'
import type { ColorLabelValue } from '../../shared/api/assets'
import type { HubBrowserTab, HubFilterState, HubViewMode, ImgType } from './types'
import { buildFilters, createDefaultFilters, groupAssetsByPair } from './utils'
import { useAssetStatuses, useDebouncedValue } from './hooks'
import ProjectList from './components/ProjectList'
import DateDrilldown from './components/DateDrilldown'
import VirtualizedAssetGrid from './components/VirtualizedAssetGrid'
import AssetTile from './components/AssetTile'

const HUB_GRID_PAGE_SIZE = 100
const HUB_LIST_PAGE_SIZE = 200

const RATING_OPTIONS = [
    { label: 'All ratings', value: 0 },
    { label: '★ and up', value: 1 },
    { label: '★★ and up', value: 2 },
    { label: '★★★ and up', value: 3 },
    { label: '★★★★ and up', value: 4 },
    { label: '★★★★★ only', value: 5 },
]

const LABEL_OPTIONS: ColorLabelValue[] = ['None', 'Red', 'Yellow', 'Green', 'Blue', 'Purple']

type ImageHubBrowserProps = {
    mode: 'page' | 'select'
    // Selection state (controlled)
    selectedIds?: Set<string>
    onToggleSelection?: (tileId: string, tile: any) => void // Passing tile for context if needed

    // Context
    currentProjectId?: string | null

    // Navigation
    onBack?: () => void

    // Optional callbacks
    onProjectChanged?: (project: ImageHubProject | null) => void
    onDateSelectionChanged?: (label: string) => void
}

export default function ImageHubBrowser({
    mode,
    selectedIds,
    onToggleSelection,
    currentProjectId,
    onBack,
    onProjectChanged,
    onDateSelectionChanged,
}: ImageHubBrowserProps) {
    const [tab, setTab] = useState<HubBrowserTab>('project')
    const [viewMode, setViewMode] = useState<HubViewMode>('grid')
    const [search, setSearch] = useState('')
    const [filters, setFilters] = useState<HubFilterState>(() => createDefaultFilters())
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [dateSelection, setDateSelection] = useState<{
        year?: number
        month?: number
        day?: number
    }>({})

    const debouncedSearch = useDebouncedValue(search, 300)

    // --- Projects Query ---
    const projectQuery = useInfiniteQuery({
        queryKey: ['imagehub-projects', debouncedSearch],
        initialPageParam: null as string | null,
        queryFn: ({ pageParam }) =>
            fetchImageHubProjects({ query: debouncedSearch, cursor: pageParam, sort: '-updated_at' }),
        getNextPageParam: (last) => last.next_cursor ?? undefined,
    })

    const projects = useMemo(
        () => projectQuery.data?.pages.flatMap((page) => page.projects) ?? [],
        [projectQuery.data]
    )

    const activeProjectId = useMemo(() => {
        if (tab !== 'project') return selectedProjectId
        if (selectedProjectId && projects.some((proj) => proj.project_id === selectedProjectId)) {
            return selectedProjectId
        }
        return projects[0]?.project_id ?? null
    }, [tab, selectedProjectId, projects])

    // Notify parent about project change
    useEffect(() => {
        if (tab === 'project' && onProjectChanged) {
            const proj = projects.find(p => p.project_id === activeProjectId) ?? null
            onProjectChanged(proj)
        }
    }, [activeProjectId, onProjectChanged, projects, tab])

    // --- Assets Query ---
    const filtersPayload = useMemo(
        () => buildFilters(filters, debouncedSearch),
        [filters, debouncedSearch]
    )

    const assetQueryKey = useMemo(() => {
        if (tab === 'project') {
            return ['imagehub-assets', tab, viewMode, activeProjectId, filtersPayload]
        }
        return [
            'imagehub-assets',
            tab,
            viewMode,
            dateSelection.year ?? 'all',
            dateSelection.month ?? 'all',
            dateSelection.day ?? 'all',
            filtersPayload,
        ]
    }, [tab, viewMode, activeProjectId, dateSelection, filtersPayload])

    const projectAssets = useInfiniteQuery({
        queryKey: assetQueryKey,
        initialPageParam: null as string | null,
        enabled: tab === 'project' && !!activeProjectId,
        queryFn: ({ pageParam }) =>
            fetchImageHubAssets({
                mode: 'project',
                projectId: activeProjectId!,
                view: viewMode,
                limit: viewMode === 'grid' ? HUB_GRID_PAGE_SIZE : HUB_LIST_PAGE_SIZE,
                cursor: pageParam,
                filters: filtersPayload,
            }),
        getNextPageParam: (last) => last.next_cursor ?? undefined,
    })

    // --- Date Buckets ---
    const dateBucketLevel: 'year' | 'month' | 'day' | 'asset' = useMemo(() => {
        if (!dateSelection.year) return 'year'
        if (dateSelection.year && !dateSelection.month) return 'month'
        if (dateSelection.year && dateSelection.month && !dateSelection.day) return 'day'
        return 'asset'
    }, [dateSelection])

    const drilldownLevel: 'year' | 'month' | 'day' = useMemo(() => {
        if (!dateSelection.year) return 'year'
        if (!dateSelection.month) return 'month'
        return 'day'
    }, [dateSelection])

    const shouldLoadBuckets = tab === 'date'
    const dateBuckets = useQuery({
        queryKey: [
            'imagehub-date-buckets',
            drilldownLevel,
            dateSelection.year ?? 'all',
            dateSelection.month ?? 'all',
            filtersPayload,
        ],
        enabled: shouldLoadBuckets,
        queryFn: async () => {
            const response = await fetchImageHubAssets({
                mode: 'date',
                year: drilldownLevel === 'year' ? undefined : dateSelection.year,
                month: drilldownLevel === 'day' ? dateSelection.month : undefined,
                day: undefined,
                view: 'grid',
                limit: 0,
                filters: filtersPayload,
            })
            return response.buckets ?? []
        },
    })

    // Notify parent about date selection
    useEffect(() => {
        if (tab === 'date' && onDateSelectionChanged) {
            let label = 'ImageHub'
            if (dateSelection.year) {
                label = `${dateSelection.year}`
                if (dateSelection.month) {
                    label += `-${String(dateSelection.month).padStart(2, '0')}`
                    if (dateSelection.day) {
                        label += `-${String(dateSelection.day).padStart(2, '0')}`
                    }
                }
            }
            onDateSelectionChanged(label)
        }
    }, [dateSelection, onDateSelectionChanged, tab])


    const dateAssets = useInfiniteQuery({
        queryKey: assetQueryKey,
        initialPageParam: null as string | null,
        enabled: tab === 'date' && dateBucketLevel === 'asset',
        queryFn: ({ pageParam }) =>
            fetchImageHubAssets({
                mode: 'date',
                year: dateSelection.year,
                month: dateSelection.month,
                day: dateSelection.day,
                view: viewMode,
                limit: viewMode === 'grid' ? HUB_GRID_PAGE_SIZE : HUB_LIST_PAGE_SIZE,
                cursor: pageParam,
                filters: filtersPayload,
            }),
        getNextPageParam: (last) => last.next_cursor ?? undefined,
    })

    const rawAssets = useMemo(() => {
        if (tab === 'project') {
            return projectAssets.data?.pages.flatMap((page) => page.assets) ?? []
        }
        if (dateBucketLevel === 'asset') {
            return dateAssets.data?.pages.flatMap((page) => page.assets) ?? []
        }
        return []
    }, [tab, projectAssets.data, dateAssets.data, dateBucketLevel])

    const tiles = useMemo(() => groupAssetsByPair(rawAssets), [rawAssets])

    // Status Check (for linking)
    const assetIds = useMemo(() => rawAssets.map((asset) => asset.asset_id), [rawAssets])
    const [statusMap] = useAssetStatuses(assetIds, currentProjectId ?? null)

    const hasMore =
        tab === 'project'
            ? !!projectAssets.hasNextPage
            : dateBucketLevel === 'asset' && !!dateAssets.hasNextPage
    const fetchNext = tab === 'project' ? projectAssets.fetchNextPage : dateAssets.fetchNextPage

    const assetErrorRaw = tab === 'project' ? projectAssets.error : dateAssets.error
    const assetError = assetErrorRaw
        ? assetErrorRaw instanceof Error
            ? assetErrorRaw
            : new Error('Failed to load assets')
        : null
    const assetLoading =
        tab === 'project'
            ? projectAssets.isLoading
            : dateBucketLevel === 'asset'
                ? dateAssets.isLoading
                : false

    const handleScrollMetrics = useCallback(
        (metrics: {
            scrollTop: number
            scrollHeight: number
            clientHeight: number
        }) => {
            if (tab === 'date' && dateBucketLevel !== 'asset') return
            if (!hasMore || projectAssets.isFetchingNextPage || dateAssets.isFetchingNextPage) return
            const threshold = metrics.scrollHeight - metrics.clientHeight
            if (threshold <= 0) return
            const ratio = metrics.scrollTop / threshold
            if (ratio >= 0.75) {
                fetchNext()
            }
        },
        [
            tab,
            dateBucketLevel,
            hasMore,
            projectAssets.isFetchingNextPage,
            dateAssets.isFetchingNextPage,
            fetchNext,
        ]
    )

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {/* Top Bar for Browser */}
            <div className="flex flex-wrap items-center gap-3">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 rounded border border-[var(--border,#E1D3B9)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--sand-100,#F3EBDD)]"
                    >
                        ← Back
                    </button>
                )}

                <div className="inline-flex rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-1 text-xs font-semibold">
                    <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${tab === 'project' ? 'bg-[var(--sand-200,#F0E5CF)]' : ''}`}
                        onClick={() => setTab('project')}
                    >
                        By Project
                    </button>
                    <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${tab === 'date' ? 'bg-[var(--sand-200,#F0E5CF)]' : ''}`}
                        onClick={() => setTab('date')}
                    >
                        By Date
                    </button>
                </div>

                <div className="flex-1 min-w-[240px]">
                    <input
                        type="search"
                        className="w-full rounded border border-[var(--border,#E1D3B9)] px-3 py-2 text-sm"
                        placeholder="Search filename or project"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="inline-flex rounded border border-[var(--border,#E1D3B9)] text-xs font-medium">
                    <button
                        type="button"
                        className={`px-3 py-1.5 ${viewMode === 'grid' ? 'bg-[var(--sand-200,#F0E5CF)]' : ''}`}
                        onClick={() => setViewMode('grid')}
                    >
                        Grid
                    </button>
                    <button
                        type="button"
                        className={`px-3 py-1.5 ${viewMode === 'list' ? 'bg-[var(--sand-200,#F0E5CF)]' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        List
                    </button>
                </div>

                {mode === 'select' && selectedIds && (
                    <div className="text-xs text-[var(--text-muted,#6B645B)]">
                        {selectedIds.size} selected
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 text-xs">
                <div className="inline-flex items-center gap-2">
                    <span className="font-medium">Type</span>
                    {(['JPEG', 'RAW'] as const).map((type) => {
                        const active = filters.types.has(type)
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() =>
                                    setFilters((prev) => {
                                        const next = new Set(prev.types)
                                        if (next.has(type)) next.delete(type)
                                        else next.add(type)
                                        return { ...prev, types: next }
                                    })
                                }
                                className={`rounded-full border px-2 py-1 ${active ? 'border-[var(--charcoal-800,#1F1E1B)] bg-[var(--sand-100,#F3EBDD)]' : 'border-[var(--border,#E1D3B9)]'}`}
                            >
                                {type}
                            </button>
                        )
                    })}
                </div>
                <label className="flex items-center gap-2">
                    <span className="font-medium">Rating</span>
                    <select
                        value={filters.rating}
                        onChange={(event) =>
                            setFilters((prev) => ({ ...prev, rating: Number(event.target.value) }))
                        }
                        className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
                    >
                        {RATING_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-2">
                    <span className="font-medium">Label</span>
                    <select
                        value={filters.label}
                        onChange={(event) => {
                            const value = event.target.value as 'Any' | ColorLabelValue
                            setFilters((prev) => ({ ...prev, label: value }))
                        }}
                        className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
                    >
                        <option value="Any">All labels</option>
                        {LABEL_OPTIONS.map((label) => (
                            <option key={label} value={label}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-2">
                    <span className="font-medium">From</span>
                    <input
                        type="date"
                        value={filters.dateFrom ?? ''}
                        onChange={(event) =>
                            setFilters((prev) => ({ ...prev, dateFrom: event.target.value || undefined }))
                        }
                        className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
                    >
                    </input>
                </label>
                <label className="flex items-center gap-2">
                    <span className="font-medium">To</span>
                    <input
                        type="date"
                        value={filters.dateTo ?? ''}
                        onChange={(event) =>
                            setFilters((prev) => ({ ...prev, dateTo: event.target.value || undefined }))
                        }
                        className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
                    >
                    </input>
                </label>
            </div>

            {/* Split Pane Interface */}
            <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
                <aside className="w-72 flex-shrink-0 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] overflow-hidden">
                    {tab === 'project' ? (
                        <ProjectList
                            projects={projects}
                            isLoading={projectQuery.isLoading}
                            error={projectQuery.error instanceof Error ? projectQuery.error : null}
                            activeProjectId={activeProjectId}
                            onSelectProject={setSelectedProjectId}
                            hasMore={!!projectQuery.hasNextPage}
                            onLoadMore={() => projectQuery.fetchNextPage()}
                            isFetchingMore={projectQuery.isFetchingNextPage}
                        />
                    ) : (
                        <DateDrilldown
                            level={drilldownLevel}
                            buckets={dateBuckets.data ?? []}
                            isLoading={dateBuckets.isLoading}
                            error={dateBuckets.error instanceof Error ? dateBuckets.error : null}
                            selection={dateSelection}
                            onSelect={setDateSelection}
                        />
                    )}
                </aside>

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                    <div className="flex items-center justify-between border-b border-[var(--border,#E1D3B9)] px-4 py-3 text-sm font-semibold">
                        <span>{tab === 'project' ? 'Assets in project' : 'Assets by date'}</span>
                        <span className="text-xs text-[var(--text-muted,#6B645B)]">{tiles.length} total</span>
                    </div>

                    <div className="flex-1 min-h-0">
                        {assetError && (
                            <div className="m-4 rounded border border-[#F7C9C9] bg-[#FDF2F2] px-3 py-2 text-xs text-[#B42318]">
                                Failed to load assets. {assetError.message}
                            </div>
                        )}
                        {assetLoading && !tiles.length ? (
                            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">
                                Loading assets…
                            </div>
                        ) : tab === 'date' && dateBucketLevel !== 'asset' ? (
                            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">
                                Choose a day to view assets.
                            </div>
                        ) : tiles.length ? (
                            <VirtualizedAssetGrid
                                items={tiles}
                                viewMode={viewMode}
                                estimateHeight={viewMode === 'grid' ? 260 : 84}
                                columnWidth={viewMode === 'grid' ? 220 : 320}
                                gap={12}
                                renderItem={(tile) => (
                                    <AssetTile
                                        key={tile.id}
                                        tile={tile}
                                        viewMode={viewMode}
                                        selected={selectedIds?.has(tile.id)}
                                        disabled={
                                            mode === 'select' &&
                                            tile.assetIds.some((id) => statusMap.get(id)?.already_linked)
                                        }
                                        onToggle={
                                            mode === 'select' && onToggleSelection
                                                ? () => onToggleSelection(tile.id, tile)
                                                : undefined
                                        }
                                    />
                                )}
                                onScrollMetrics={handleScrollMetrics}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">
                                No assets found in this source.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}
