import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  fetchImageHubProjects,
  fetchImageHubAssets,
  fetchImageHubAssetStatus,
  type ImageHubAsset,
  type ImageHubDateBucket,
  type ImageHubProject,
  type ImageHubAssetFilters,
} from '../../shared/api/hub'
import type { ColorLabelValue } from '../../shared/api/assets'
import type { PendingItem } from './importTypes'
import type { ImgType } from './types'

const DATE_FULL_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const HUB_GRID_PAGE_SIZE = 100
const HUB_LIST_PAGE_SIZE = 200
const JPEG_RAW_OVERLAY = 'JPEG + RAW'

const RATING_OPTIONS = [
  { label: 'All ratings', value: 0 },
  { label: '★ and up', value: 1 },
  { label: '★★ and up', value: 2 },
  { label: '★★★ and up', value: 3 },
  { label: '★★★★ and up', value: 4 },
  { label: '★★★★★ only', value: 5 },
]

const LABEL_OPTIONS: ColorLabelValue[] = ['None', 'Red', 'Yellow', 'Green', 'Blue', 'Purple']

type HubViewMode = 'grid' | 'list'

type HubBrowserTab = 'project' | 'date'

type HubFilterState = {
  types: Set<ImgType>
  rating: number
  label: 'Any' | ColorLabelValue
  dateFrom?: string
  dateTo?: string
}

function createDefaultFilters(): HubFilterState {
  return {
    types: new Set<ImgType>(),
    rating: 0,
    label: 'Any',
  }
}

type HubTile = {
  id: string
  assetIds: string[]
  primary: ImageHubAsset
  secondary?: ImageHubAsset
  isPaired: boolean
}

type ImageHubImportPaneProps = {
  currentProjectId: string | null
  onSelectionChange: (items: PendingItem[]) => void
}

type VirtualMetrics = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function formatCount(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

function buildFilters(filters: HubFilterState, searchTerm: string): ImageHubAssetFilters | undefined {
  const payload: ImageHubAssetFilters = {}
  if (filters.types.size) {
    payload.types = Array.from(filters.types)
  }
  if (filters.rating > 0) {
    payload.ratings = [filters.rating]
  }
  if (filters.label !== 'Any') {
    payload.labels = [filters.label]
  }
  if (filters.dateFrom) payload.dateFrom = filters.dateFrom
  if (filters.dateTo) payload.dateTo = filters.dateTo
  if (searchTerm.trim()) payload.search = searchTerm.trim()
  return Object.keys(payload).length ? payload : undefined
}

function groupAssetsByPair(assets: ImageHubAsset[]): HubTile[] {
  const pairMap = new Map<string, HubTile>()
  const orderedTiles: HubTile[] = []
  assets.forEach((asset) => {
    if (asset.is_paired && asset.pair_id) {
      let tile = pairMap.get(asset.pair_id)
      if (!tile) {
        tile = {
          id: `pair-${asset.pair_id}`,
          primary: asset,
          assetIds: [asset.asset_id],
          isPaired: true,
        }
        pairMap.set(asset.pair_id, tile)
        orderedTiles.push(tile)
      } else {
        tile.assetIds.push(asset.asset_id)
        if (!tile.secondary) {
          if (asset.type === 'JPEG' && tile.primary.type === 'RAW') {
            tile.secondary = tile.primary
            tile.primary = asset
          } else {
            tile.secondary = asset
          }
        }
      }
    } else {
      orderedTiles.push({
        id: asset.asset_id,
        primary: asset,
        assetIds: [asset.asset_id],
        isPaired: false,
      })
    }
  })
  return orderedTiles
}

type AssetStatusMap = Map<string, { already_linked: boolean; other_projects: string[] }>

function useAssetStatuses(assetIds: string[], currentProjectId: string | null) {
  const cacheRef = useRef<AssetStatusMap>(new Map())
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!assetIds.length || !currentProjectId) return
    const missing = assetIds.filter((id) => !cacheRef.current.has(id))
    if (!missing.length) return
    let canceled = false

    async function hydrate(next: string[]) {
      for (const assetId of next) {
        if (canceled) break
        try {
          const status = await fetchImageHubAssetStatus(assetId, currentProjectId)
          cacheRef.current.set(assetId, status)
          forceRender((v) => v + 1)
        } catch (err) {
          console.error('Failed to load status for ImageHub asset', assetId, err)
          cacheRef.current.set(assetId, { already_linked: false, other_projects: [] })
          forceRender((v) => v + 1)
        }
      }
    }

    hydrate(missing)

    return () => {
      canceled = true
    }
  }, [assetIds, currentProjectId])

  return cacheRef.current
}

type VirtualizedGridProps<T> = {
  items: T[]
  viewMode: HubViewMode
  estimateHeight: number
  columnWidth: number
  gap: number
  renderItem: (item: T) => React.ReactNode
  onScrollMetrics?: (metrics: VirtualMetrics) => void
}

function VirtualizedAssetGrid<T>({ items, viewMode, estimateHeight, columnWidth, gap, renderItem, onScrollMetrics }: VirtualizedGridProps<T>) {
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
        onScrollMetrics({ scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight })
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

  const rowHeight = viewMode === 'list' ? estimateHeight : estimateHeight
  const rowStride = rowHeight + gap
  const overscan = 3
  const totalRows = Math.max(1, Math.ceil(items.length / columns))
  const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - overscan)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + (viewportHeight || rowStride)) / rowStride) + overscan)
  const startIndex = Math.min(items.length, startRow * columns)
  const endIndex = Math.min(items.length, endRow * columns)
  const visible = items.slice(startIndex, endIndex)
  const paddingTop = startRow * rowStride
  const paddingBottom = Math.max(0, (totalRows - endRow) * rowStride)

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
      <div style={{ paddingTop, paddingBottom, paddingLeft: viewMode === 'list' ? 0 : 2, paddingRight: viewMode === 'list' ? 0 : 2 }}>
        <div
          className={viewMode === 'grid' ? 'grid gap-3' : 'flex flex-col gap-2'}
          style={viewMode === 'grid' ? { gridTemplateColumns: `repeat(${columns}, minmax(${columnWidth}px, 1fr))` } : undefined}
        >
          {visible.map((item) => renderItem(item))}
        </div>
      </div>
    </div>
  )
}

function createPendingItems(tile: HubTile, folderLabel: string): PendingItem[] {
  const entries: PendingItem[] = []
  const approximateSize = (type: ImgType) => (type === 'RAW' ? 48 * 1024 * 1024 : 12 * 1024 * 1024)
  const pushItem = (asset: ImageHubAsset) => {
    const imgType = asset.type === 'RAW' ? 'RAW' : 'JPEG'
    entries.push({
      id: asset.asset_id,
      name: asset.original_filename,
      type: imgType,
      previewUrl: asset.thumb_url,
      source: 'hub',
      selected: true,
      size: approximateSize(imgType),
      meta: { folder: folderLabel },
    })
  }
  pushItem(tile.primary)
  if (tile.secondary) pushItem(tile.secondary)
  return entries
}

export default function ImageHubImportPane({ currentProjectId, onSelectionChange }: ImageHubImportPaneProps) {
  const [tab, setTab] = useState<HubBrowserTab>('project')
  const [viewMode, setViewMode] = useState<HubViewMode>('grid')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<HubFilterState>(() => createDefaultFilters())
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [dateSelection, setDateSelection] = useState<{ year?: number; month?: number; day?: number }>({})
  const [selectionMap, setSelectionMap] = useState<Map<string, PendingItem[]>>(new Map())

  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    onSelectionChange(Array.from(selectionMap.values()).flat())
  }, [selectionMap, onSelectionChange])

  useEffect(() => {
    setSelectionMap(new Map())
  }, [tab])

  useEffect(() => {
    if (tab !== 'project') return
    setSelectionMap(new Map())
  }, [tab, activeProjectId])

  useEffect(() => {
    if (tab !== 'date') return
    setSelectionMap(new Map())
  }, [tab, dateSelection.year, dateSelection.month, dateSelection.day])

  const projectQuery = useInfiniteQuery({
    queryKey: ['imagehub-projects', debouncedSearch],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchImageHubProjects({ query: debouncedSearch, cursor: pageParam, sort: '-updated_at' }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })

  const projects = useMemo(() => projectQuery.data?.pages.flatMap((page) => page.projects) ?? [], [projectQuery.data])

  useEffect(() => {
    if (tab !== 'project') return
    if (activeProjectId && projects.some((proj) => proj.project_id === activeProjectId)) return
    if (projects.length) {
      setActiveProjectId(projects[0].project_id)
    }
  }, [projects, activeProjectId, tab])

  const filtersPayload = useMemo(() => buildFilters(filters, debouncedSearch), [filters, debouncedSearch])

  const assetQueryKey = useMemo(() => {
    if (tab === 'project') {
      return ['imagehub-assets', tab, viewMode, activeProjectId, filtersPayload]
    }
    return ['imagehub-assets', tab, viewMode, dateSelection.year ?? 'all', dateSelection.month ?? 'all', dateSelection.day ?? 'all', filtersPayload]
  }, [tab, viewMode, activeProjectId, dateSelection, filtersPayload])

  const projectAssets = useInfiniteQuery({
    queryKey: assetQueryKey,
    initialPageParam: null as string | null,
    enabled: tab === 'project' && !!activeProjectId,
    queryFn: ({ pageParam }) => fetchImageHubAssets({
      mode: 'project',
      projectId: activeProjectId!,
      view: viewMode,
      limit: viewMode === 'grid' ? HUB_GRID_PAGE_SIZE : HUB_LIST_PAGE_SIZE,
      cursor: pageParam,
      filters: filtersPayload,
    }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  })

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
    queryKey: ['imagehub-date-buckets', drilldownLevel, dateSelection.year ?? 'all', dateSelection.month ?? 'all', filtersPayload],
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

  const dateAssets = useInfiniteQuery({
    queryKey: assetQueryKey,
    initialPageParam: null as string | null,
    enabled: tab === 'date' && dateBucketLevel === 'asset',
    queryFn: ({ pageParam }) => fetchImageHubAssets({
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
  const assetIds = useMemo(() => rawAssets.map((asset) => asset.asset_id), [rawAssets])
  const statusMap = useAssetStatuses(assetIds, currentProjectId)

  const selectedCount = useMemo(() => Array.from(selectionMap.values()).flat().length, [selectionMap])

  const toggleSelection = useCallback((tile: HubTile) => {
    setSelectionMap((prev) => {
      const next = new Map(prev)
      if (next.has(tile.id)) {
        next.delete(tile.id)
        return next
      }
      const folderLabel = tab === 'project' ? (projects.find((proj) => proj.project_id === activeProjectId)?.name ?? 'ImageHub') : buildDateLabel(dateSelection)
      next.set(tile.id, createPendingItems(tile, folderLabel))
      return next
    })
  }, [activeProjectId, projects, tab, dateSelection])

  const hasMore = tab === 'project'
    ? !!projectAssets.hasNextPage
    : dateBucketLevel === 'asset' && !!dateAssets.hasNextPage
  const fetchNext = tab === 'project' ? projectAssets.fetchNextPage : dateAssets.fetchNextPage

  const assetErrorRaw = tab === 'project' ? projectAssets.error : dateAssets.error
  const assetError = assetErrorRaw ? (assetErrorRaw instanceof Error ? assetErrorRaw : new Error('Failed to load assets')) : null
  const assetLoading = tab === 'project' ? projectAssets.isLoading : (dateBucketLevel === 'asset' ? dateAssets.isLoading : false)

  const handleScrollMetrics = useCallback((metrics: VirtualMetrics) => {
    if (tab === 'date' && dateBucketLevel !== 'asset') return
    if (!hasMore || projectAssets.isFetchingNextPage || dateAssets.isFetchingNextPage) return
    const threshold = metrics.scrollHeight - metrics.clientHeight
    if (threshold <= 0) return
    const ratio = metrics.scrollTop / threshold
    if (ratio >= 0.75) {
      fetchNext()
    }
  }, [tab, dateBucketLevel, hasMore, projectAssets.isFetchingNextPage, dateAssets.isFetchingNextPage, fetchNext])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="text-xs text-[var(--text-muted,#6B645B)]">{selectedCount} selected</div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="inline-flex items-center gap-2">
          <span className="font-medium">Type</span>
          {(['JPEG', 'RAW'] as const).map((type) => {
            const active = filters.types.has(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => setFilters((prev) => {
                  const next = new Set(prev.types)
                  if (next.has(type)) next.delete(type)
                  else next.add(type)
                  return { ...prev, types: next }
                })}
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
            onChange={(event) => setFilters((prev) => ({ ...prev, rating: Number(event.target.value) }))}
            className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
          >
            {RATING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
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
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium">From</span>
          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value || undefined }))}
            className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium">To</span>
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value || undefined }))}
            className="rounded border border-[var(--border,#E1D3B9)] px-2 py-1"
          />
        </label>
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <aside className="w-72 flex-shrink-0 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
          {tab === 'project' ? (
            <ProjectList
              projects={projects}
              isLoading={projectQuery.isLoading}
              error={projectQuery.error ? (projectQuery.error instanceof Error ? projectQuery.error : new Error('Failed to load projects')) : null}
              activeProjectId={activeProjectId}
              onSelectProject={setActiveProjectId}
              hasMore={!!projectQuery.hasNextPage}
              onLoadMore={() => projectQuery.fetchNextPage()}
              isFetchingMore={projectQuery.isFetchingNextPage}
            />
          ) : (
            <DateDrilldown
              level={drilldownLevel}
              buckets={dateBuckets.data ?? []}
              isLoading={dateBuckets.isLoading}
              error={dateBuckets.error instanceof Error ? dateBuckets.error : dateBuckets.error ? new Error('Failed to load dates') : null}
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
              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">Loading assets…</div>
            ) : tab === 'date' && dateBucketLevel !== 'asset' ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">Choose a day to view assets.</div>
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
                    selected={selectionMap.has(tile.id)}
                    disabled={tile.assetIds.some((id) => statusMap.get(id)?.already_linked)}
                    onToggle={() => toggleSelection(tile)}
                    viewMode={viewMode}
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

type ProjectListProps = {
  projects: ImageHubProject[]
  isLoading: boolean
  error: Error | null
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  hasMore: boolean
  onLoadMore: () => void
  isFetchingMore: boolean
}

function ProjectList({ projects, isLoading, error, activeProjectId, onSelectProject, hasMore, onLoadMore, isFetchingMore }: ProjectListProps) {
  if (isLoading) {
    return <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">Loading projects…</div>
  }
  if (error) {
    return <div className="p-4 text-xs text-[#B42318]">Failed to load projects. {error.message}</div>
  }
  if (!projects.length) {
    return <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">You have no projects with Hub assets yet.</div>
  }
  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 divide-y divide-[var(--border,#E1D3B9)] overflow-y-auto">
        {projects.map((project) => {
          const active = project.project_id === activeProjectId
          return (
            <li key={project.project_id}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm ${active ? 'bg-[var(--sand-100,#F3EBDD)] font-semibold' : ''}`}
                onClick={() => onSelectProject(project.project_id)}
              >
                {project.cover_thumb ? (
                  <img src={project.cover_thumb} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />
                ) : (
                  <div className="h-10 w-10 rounded bg-[var(--sand-200,#F0E5CF)]" />
                )}
                <div className="flex-1">
                  <div className="truncate">{project.name}</div>
                  <div className="text-xs text-[var(--text-muted,#6B645B)]">{project.asset_count} assets • Updated {project.updated_at ? DATE_FULL_FORMAT.format(new Date(project.updated_at)) : '—'}</div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <div className="border-t border-[var(--border,#E1D3B9)] p-3 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingMore}
            className={`rounded border border-[var(--border,#E1D3B9)] px-3 py-1.5 text-xs ${isFetchingMore ? 'opacity-60' : ''}`}
          >
            {isFetchingMore ? 'Loading…' : 'Load more projects'}
          </button>
        </div>
      )}
    </div>
  )
}

type DateDrilldownProps = {
  level: 'year' | 'month' | 'day'
  buckets: ImageHubDateBucket[]
  isLoading: boolean
  error: Error | null
  selection: { year?: number; month?: number; day?: number }
  onSelect: (next: { year?: number; month?: number; day?: number }) => void
}

function DateDrilldown({ level, buckets, isLoading, error, selection, onSelect }: DateDrilldownProps) {
  const goBack = () => {
    if (level === 'month') onSelect({})
    else if (level === 'day') onSelect({ year: selection.year })
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border,#E1D3B9)] px-4 py-3 text-sm font-semibold">
        <span>{level === 'year' ? 'Years' : level === 'month' ? 'Months' : 'Days'}</span>
        {level !== 'year' && (
          <button type="button" className="text-xs text-[var(--river-500,#6B7C7A)]" onClick={goBack}>Back</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">Loading…</div>
        ) : error ? (
          <div className="p-4 text-xs text-[#B42318]">Failed to load. {error.message}</div>
        ) : !buckets.length ? (
          <div className="p-4 text-xs text-[var(--text-muted,#6B645B)]">No assets found in this source.</div>
        ) : (
          <ul>
            {buckets.map((bucket) => {
              const isActive = level === 'year'
                ? selection.year === bucket.year
                : level === 'month'
                  ? selection.month === bucket.month && selection.year === bucket.year
                  : selection.day === bucket.day && selection.month === bucket.month && selection.year === bucket.year
              return (
                <li key={bucket.key}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[var(--sand-50,#FBF7EF)] ${isActive ? 'bg-[var(--sand-100,#F3EBDD)] font-semibold' : ''}`}
                    onClick={() => {
                      if (level === 'year') onSelect({ year: bucket.year })
                      else if (level === 'month') onSelect({ year: selection.year, month: bucket.month ?? undefined })
                      else if (level === 'day') onSelect({ year: selection.year, month: selection.month, day: bucket.day ?? undefined })
                    }}
                  >
                    <span>{bucket.label}</span>
                    <span className="text-xs text-[var(--text-muted,#6B645B)]">{formatCount(bucket.asset_count)}</span>
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

type AssetTileProps = {
  tile: HubTile
  selected: boolean
  disabled: boolean
  onToggle: () => void
  viewMode: HubViewMode
}

function AssetTile({ tile, selected, disabled, onToggle, viewMode }: AssetTileProps) {
  const primary = tile.primary
  const secondary = tile.secondary
  const createdAt = primary.created_at ? DATE_FULL_FORMAT.format(new Date(primary.created_at)) : 'Unknown date'
  const disabledTooltip = disabled ? 'Already in this project' : undefined
  const content = (
    <div className={`relative w-full overflow-hidden rounded border ${selected ? 'border-[var(--charcoal-800,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'} ${disabled ? 'opacity-60' : ''}`}>
      <img src={primary.thumb_url ?? ''} alt="" className="h-40 w-full object-cover" loading="lazy" />
      <div className="p-3 text-left">
        <div className="truncate text-sm font-semibold">{primary.original_filename}</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)]">{createdAt}</div>
      </div>
      <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {tile.isPaired && secondary ? JPEG_RAW_OVERLAY : primary.type}
      </div>
      {selected && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--charcoal-800,#1F1E1B)] text-[10px] text-white">✓</span>
      )}
    </div>
  )
  const listContent = (
    <div className={`flex items-center gap-3 rounded border px-3 py-2 ${selected ? 'border-[var(--charcoal-800,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'} ${disabled ? 'opacity-60' : ''}`}>
      <img src={primary.thumb_url ?? ''} alt="" className="h-14 w-14 rounded object-cover" loading="lazy" />
      <div className="flex-1">
        <div className="truncate text-sm font-semibold">{primary.original_filename}</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)]">{createdAt}</div>
      </div>
      <div className="text-xs font-medium text-[var(--text-muted,#6B645B)]">
        {tile.isPaired && secondary ? JPEG_RAW_OVERLAY : primary.type}
      </div>
      {selected && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--charcoal-800,#1F1E1B)] text-[10px] text-white">✓</span>}
    </div>
  )

  return (
    <button
      type="button"
      className="text-left"
      onClick={() => !disabled && onToggle()}
      disabled={disabled}
      title={disabledTooltip}
    >
      {viewMode === 'grid' ? content : listContent}
    </button>
  )
}

function buildDateLabel(selection: { year?: number; month?: number; day?: number }) {
  if (!selection.year) return 'ImageHub'
  if (selection.year && !selection.month) return String(selection.year)
  if (selection.year && selection.month && !selection.day) {
    return `${selection.year}/${String(selection.month).padStart(2, '0')}`
  }
  return `${selection.year}/${String(selection.month).padStart(2, '0')}/${String(selection.day).padStart(2, '0')}`
}
