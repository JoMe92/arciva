import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TOKENS } from './utils'
import { listProjectAssets, assetThumbUrl, assetPreviewUrl, updateAssetPreview, getAsset, type AssetListItem, type AssetDetail } from '../../shared/api/assets'
import { getProject, updateProject, type ProjectApiResponse } from '../../shared/api/projects'
import { initUpload, putUpload, completeUpload } from '../../shared/api/uploads'
import { placeholderRatioForAspect } from '../../shared/placeholder'
import type { Photo, ImgType, ColorTag } from './types'
import {
  TopBar,
  Sidebar,
  GridView,
  DetailView,
  EmptyState,
  NoResults,
  computeCols,
  StarRow,
  type DateTreeYearNode,
  type DateTreeMonthNode,
  type DateTreeDayNode,
  type SidebarMode,
  type GridSelectOptions,
} from './components'

const SIDEBAR_WIDTHS: Record<SidebarMode, number> = {
  expanded: 304,
  slim: 60,
  hidden: 0,
}
const INSPECTOR_WIDTH = 260
const IGNORED_METADATA_WARNINGS = new Set(['EXIFTOOL_ERROR', 'EXIFTOOL_NOT_INSTALLED', 'EXIFTOOL_JSON_ERROR'])
const DATE_KEY_DELIM = '__'
const UNKNOWN_VALUE = 'unknown'
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type DateParts = {
  yearValue: string
  yearLabel: string
  yearSort: number
  monthValue: string
  monthLabel: string
  monthSort: number
  dayValue: string
  dayLabel: string
  daySort: number
}

type YearBuilder = {
  id: string
  year: string
  label: string
  sortValue: number
  count: number
  months: Map<string, MonthBuilder>
}

type MonthBuilder = {
  id: string
  year: string
  month: string
  label: string
  sortValue: number
  count: number
  parentYearId: string
  days: Map<string, DayBuilder>
}

type DayBuilder = {
  id: string
  year: string
  month: string
  day: string
  label: string
  sortValue: number
  count: number
  parentYearId: string
  parentMonthId: string
}

type DateTreeBuildResult = {
  years: DateTreeYearNode[]
  dayNodeMap: Map<string, DateTreeDayNode>
  photoKeyMap: Map<string, string>
}

function makeMonthKey(year: string, month: string) {
  return `${year}${DATE_KEY_DELIM}${month}`
}

function makeDayKey(year: string, month: string, day: string) {
  return `${year}${DATE_KEY_DELIM}${month}${DATE_KEY_DELIM}${day}`
}

function computeDateParts(photo: Photo): DateParts {
  const candidate = photo.capturedAt ?? photo.uploadedAt ?? photo.date ?? null
  const parsed = candidate ? new Date(candidate) : null
  const valid = parsed instanceof Date && !Number.isNaN(parsed.getTime())

  const yearValue = valid ? String(parsed!.getFullYear()) : UNKNOWN_VALUE
  const monthValue = valid ? String(parsed!.getMonth() + 1).padStart(2, '0') : UNKNOWN_VALUE
  const dayValue = valid ? String(parsed!.getDate()).padStart(2, '0') : UNKNOWN_VALUE

  const yearSort = yearValue === UNKNOWN_VALUE ? Number.NEGATIVE_INFINITY : Number(yearValue)
  const monthSort = monthValue === UNKNOWN_VALUE ? Number.NEGATIVE_INFINITY : Number(monthValue)
  const daySort = dayValue === UNKNOWN_VALUE ? Number.NEGATIVE_INFINITY : (parsed ?? new Date(0)).getTime()

  const yearLabel = yearValue === UNKNOWN_VALUE ? 'Unknown date' : yearValue
  const monthLabel =
    monthValue === UNKNOWN_VALUE ? 'Unknown month' : MONTH_NAMES[Math.min(Math.max(Number(monthValue) - 1, 0), MONTH_NAMES.length - 1)]
  const dayLabel =
    yearValue === UNKNOWN_VALUE || monthValue === UNKNOWN_VALUE || dayValue === UNKNOWN_VALUE
      ? 'Unknown day'
      : `${yearValue}-${monthValue}-${dayValue}`

  return {
    yearValue,
    yearLabel,
    yearSort,
    monthValue,
    monthLabel,
    monthSort,
    dayValue,
    dayLabel,
    daySort,
  }
}

function buildDateTree(items: Photo[]): DateTreeBuildResult {
  const yearMap = new Map<string, YearBuilder>()
  const photoKeyMap = new Map<string, string>()

  items.forEach((photo) => {
    const parts = computeDateParts(photo)
    const yearId = parts.yearValue
    const monthId = makeMonthKey(parts.yearValue, parts.monthValue)
    const dayId = makeDayKey(parts.yearValue, parts.monthValue, parts.dayValue)

    photoKeyMap.set(photo.id, dayId)

    let yearBuilder = yearMap.get(yearId)
    if (!yearBuilder) {
      yearBuilder = {
        id: yearId,
        year: parts.yearValue,
        label: parts.yearLabel,
        sortValue: parts.yearSort,
        count: 0,
        months: new Map(),
      }
      yearMap.set(yearId, yearBuilder)
    }
    yearBuilder.count += 1

    let monthBuilder = yearBuilder.months.get(monthId)
    if (!monthBuilder) {
      monthBuilder = {
        id: monthId,
        year: parts.yearValue,
        month: parts.monthValue,
        label: parts.monthLabel,
        sortValue: parts.monthSort,
        count: 0,
        parentYearId: yearBuilder.id,
        days: new Map(),
      }
      yearBuilder.months.set(monthId, monthBuilder)
    }
    monthBuilder.count += 1

    let dayBuilder = monthBuilder.days.get(dayId)
    if (!dayBuilder) {
      dayBuilder = {
        id: dayId,
        year: parts.yearValue,
        month: parts.monthValue,
        day: parts.dayValue,
        label: parts.dayLabel,
        sortValue: parts.daySort,
        count: 0,
        parentYearId: yearBuilder.id,
        parentMonthId: monthBuilder.id,
      }
      monthBuilder.days.set(dayId, dayBuilder)
    }
    dayBuilder.count += 1
  })

  const dayNodeMap = new Map<string, DateTreeDayNode>()

  const years: DateTreeYearNode[] = Array.from(yearMap.values())
    .sort((a, b) => b.sortValue - a.sortValue || a.label.localeCompare(b.label))
    .map((yearBuilder) => {
      const months: DateTreeMonthNode[] = Array.from(yearBuilder.months.values())
        .sort((a, b) => b.sortValue - a.sortValue || a.label.localeCompare(b.label))
        .map((monthBuilder) => {
          const days: DateTreeDayNode[] = Array.from(monthBuilder.days.values())
            .sort((a, b) => b.sortValue - a.sortValue || a.label.localeCompare(b.label))
            .map((dayBuilder) => {
              const node: DateTreeDayNode = {
                id: dayBuilder.id,
                label: dayBuilder.label,
                count: dayBuilder.count,
                year: dayBuilder.year,
                month: dayBuilder.month,
                day: dayBuilder.day,
                parentYearId: dayBuilder.parentYearId,
                parentMonthId: dayBuilder.parentMonthId,
              }
              dayNodeMap.set(node.id, node)
              return node
            })

          const monthNode: DateTreeMonthNode = {
            id: monthBuilder.id,
            label: monthBuilder.label,
            count: monthBuilder.count,
            year: monthBuilder.year,
            month: monthBuilder.month,
            parentYearId: monthBuilder.parentYearId,
            days,
          }

          return monthNode
        })

      const yearNode: DateTreeYearNode = {
        id: yearBuilder.id,
        label: yearBuilder.label,
        count: yearBuilder.count,
        year: yearBuilder.year,
        months,
      }

      return yearNode
    })

  return { years, dayNodeMap, photoKeyMap }
}

function normalizeYearParam(value: string | null): string | null {
  if (!value) return null
  if (value.toLowerCase() === UNKNOWN_VALUE) return UNKNOWN_VALUE
  const year = Number(value)
  return Number.isFinite(year) ? String(Math.trunc(year)) : null
}

function normalizeMonthParam(value: string | null): string | null {
  if (!value) return null
  if (value.toLowerCase() === UNKNOWN_VALUE) return UNKNOWN_VALUE
  const month = Number(value)
  if (!Number.isFinite(month)) return null
  if (month < 1 || month > 12) return null
  return String(Math.trunc(month)).padStart(2, '0')
}

function normalizeDayParam(value: string | null): string | null {
  if (!value) return null
  if (value.toLowerCase() === UNKNOWN_VALUE) return UNKNOWN_VALUE
  const day = Number(value)
  if (!Number.isFinite(day)) return null
  if (day < 1 || day > 31) return null
  return String(Math.trunc(day)).padStart(2, '0')
}

function detectAspect(width?: number | null, height?: number | null): 'portrait' | 'landscape' | 'square' {
  if (!width || !height) return 'square'
  if (width > height) return 'landscape'
  if (height > width) return 'portrait'
  return 'square'
}

function mapAssetToPhoto(item: AssetListItem, existing?: Photo): Photo {
  const name = item.original_filename ?? existing?.name ?? 'Untitled asset'
  const type = inferTypeFromName(name)
  const capturedAt = item.taken_at ?? existing?.capturedAt ?? null
  const uploadedAt = item.completed_at ?? existing?.uploadedAt ?? null
  const date = capturedAt ?? uploadedAt ?? existing?.date ?? null
  const thumbSrc = assetThumbUrl(item) ?? existing?.thumbSrc ?? null
  const previewSrc = assetPreviewUrl(item) ?? existing?.previewSrc ?? thumbSrc
  const aspect = detectAspect(item.width, item.height)
  const placeholderRatio = existing?.placeholderRatio ?? placeholderRatioForAspect(aspect)

  const isPreview = typeof item.is_preview === 'boolean' ? item.is_preview : existing?.isPreview ?? false

  return {
    id: item.id,
    name,
    type,
    date,
    capturedAt,
    uploadedAt,
    rating: existing?.rating ?? 0,
    picked: existing?.picked ?? isPreview,
    rejected: existing?.rejected ?? false,
    tag: existing?.tag ?? 'None',
    thumbSrc,
    previewSrc,
    placeholderRatio,
    isPreview,
    previewOrder: typeof item.preview_order === 'number' ? item.preview_order : existing?.previewOrder ?? null,
    metadataWarnings: Array.isArray(item.metadata_warnings) ? item.metadata_warnings : existing?.metadataWarnings ?? [],
    status: item.status,
  }
}

export default function ProjectWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const cachedProjects = queryClient.getQueryData<ProjectApiResponse[]>(['projects'])
  const cachedProject = cachedProjects?.find((proj) => proj.id === id)
  const { data: projectDetail } = useQuery<ProjectApiResponse | undefined>({
    queryKey: ['project', id],
    queryFn: () => getProject(id as string),
    enabled: Boolean(id),
    initialData: cachedProject,
  })
  const projectName = projectDetail?.title?.trim() || `Project ${id || '—'}`
  const renameMutation = useMutation({
    mutationFn: ({ title }: { title: string }) => {
      if (!id) throw new Error('Project id missing')
      return updateProject(id, { title })
    },
    onSuccess: (updated) => {
      if (!id) return
      queryClient.setQueryData(['project', id], updated)
      queryClient.setQueryData<ProjectApiResponse[] | undefined>(['projects'], (prev) => {
        if (!prev) return prev
        return prev.map((proj) => (proj.id === updated.id ? { ...proj, title: updated.title, updated_at: updated.updated_at } : proj))
      })
    },
  })
  const [searchParams, setSearchParams] = useSearchParams()

  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const prevPhotosRef = useRef<Photo[]>([])
  const currentIndexRef = useRef(0)
  const currentPhotoIdRef = useRef<string | null>(null)
  const [view, setView] = useState<'grid' | 'detail'>('detail')
  const [current, setCurrent] = useState(0)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set<string>())
  const lastSelectedPhotoIdRef = useRef<string | null>(null)
  const selectionAnchorRef = useRef<string | null>(null)
  const suppressSelectionSyncRef = useRef(false)
  const resolveActionTargetIds = useCallback((primaryId: string | null) => {
    if (primaryId && selectedPhotoIds.has(primaryId)) {
      return new Set(selectedPhotoIds)
    }
    return primaryId ? new Set([primaryId]) : new Set<string>()
  }, [selectedPhotoIds])
  const importInFlightRef = useRef(false)
  const handleRename = useCallback(async (nextTitle: string) => {
    if (!id) return
    const trimmed = nextTitle.trim() || 'Untitled project'
    if (trimmed === projectName.trim()) return
    await renameMutation.mutateAsync({ title: trimmed })
  }, [id, projectName, renameMutation])

  const refreshAssets = useCallback(async (focusNewest: boolean = false) => {
    if (!id) return
    setLoadingAssets(true)
    try {
      const items = await listProjectAssets(id)
      setLoadError(null)
      const prevPhotos = prevPhotosRef.current
      const prevIds = new Set(prevPhotos.map((p) => p.id))
      const prevMap = new Map(prevPhotos.map((p) => [p.id, p]))
      const mapped = items.map((item) => mapAssetToPhoto(item, prevMap.get(item.id)))
      const newItems = mapped.filter((p) => !prevIds.has(p.id))

      prevPhotosRef.current = mapped
      setPhotos(mapped)

      let nextIndex = currentIndexRef.current
      if (focusNewest && newItems.length) {
        const newestId = newItems[0].id
        const idx = mapped.findIndex((p) => p.id === newestId)
        nextIndex = idx >= 0 ? idx : 0
      } else if (currentPhotoIdRef.current) {
        const idx = mapped.findIndex((p) => p.id === currentPhotoIdRef.current)
        if (idx >= 0) {
          nextIndex = idx
        } else if (mapped.length) {
          nextIndex = Math.min(nextIndex, mapped.length - 1)
        } else {
          nextIndex = 0
        }
      } else if (mapped.length) {
        nextIndex = 0
      } else {
        nextIndex = 0
      }

      if (mapped.length === 0) {
        nextIndex = 0
      } else {
        nextIndex = Math.max(0, Math.min(nextIndex, mapped.length - 1))
      }

      setCurrent(nextIndex)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assets'
      setLoadError(message)
    } finally {
      setLoadingAssets(false)
    }
  }, [id])

  const pickMutation = useMutation({
    mutationFn: async ({ assetId, pick, makePrimary }: { assetId: string; pick: boolean; makePrimary?: boolean }) => {
      if (!id) {
        throw new Error('Missing project identifier')
      }
      return updateAssetPreview(id, assetId, pick, { makePrimary })
    },
    onSuccess: () => {
      setPickError(null)
      refreshAssets()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update preview state'
      setPickError(message)
    },
  })

  const togglePick = useCallback(async (photo: Photo) => {
    if (pickMutation.isPending) return
    const hadOtherPicked = photos.some((p) => p.picked && p.id !== photo.id)
    const nextPicked = !photo.picked
    setPhotos((arr) =>
      arr.map((p) =>
        p.id === photo.id
          ? {
              ...p,
              picked: nextPicked,
              isPreview: nextPicked,
              previewOrder: nextPicked ? p.previewOrder : null,
              rejected: nextPicked ? false : p.rejected,
            }
          : p,
      ),
    )
    setPickError(null)
    try {
      await pickMutation.mutateAsync({ assetId: photo.id, pick: nextPicked, makePrimary: nextPicked && !hadOtherPicked })
    } catch (err) {
      refreshAssets()
    }
  }, [pickMutation, photos, refreshAssets])

  const [showJPEG, setShowJPEG] = useState(true)
  const [showRAW, setShowRAW] = useState(true)
  const [minStars, setMinStars] = useState<0 | 1 | 2 | 3 | 4 | 5>(0)
  const [onlyPicked, setOnlyPicked] = useState(false)
  const [hideRejected, setHideRejected] = useState(true)
  const [filterColor, setFilterColor] = useState<'Any' | ColorTag>('Any')
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('expanded')
  const [lastVisibleSidebarMode, setLastVisibleSidebarMode] = useState<SidebarMode>('expanded')

  useEffect(() => {
    if (sidebarMode !== 'hidden') {
      setLastVisibleSidebarMode(sidebarMode)
    }
  }, [sidebarMode])

  const collapseSidebar = useCallback(() => {
    setSidebarMode((prev) => {
      if (prev === 'expanded') return 'slim'
      if (prev === 'slim') return 'hidden'
      return prev
    })
  }, [])

  const expandSidebar = useCallback(() => {
    setSidebarMode((prev) => {
      if (prev === 'hidden') return lastVisibleSidebarMode
      if (prev === 'slim') return 'expanded'
      return prev
    })
  }, [lastVisibleSidebarMode])

  const handleSidebarModeChange = useCallback((next: SidebarMode) => {
    setSidebarMode(next)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return
      if (event.key === '[') {
        event.preventDefault()
        collapseSidebar()
      } else if (event.key === ']') {
        event.preventDefault()
        expandSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [collapseSidebar, expandSidebar])

  useEffect(() => {
    prevPhotosRef.current = photos
  }, [photos])

  useEffect(() => {
    currentIndexRef.current = current
    currentPhotoIdRef.current = photos[current]?.id ?? null
  }, [photos, current])

  const contentRef = useRef<HTMLDivElement | null>(null)
  const [contentW, setContentW] = useState(1200)
  useEffect(() => {
    if (!contentRef.current) return
    const ro = new ResizeObserver((entries) => setContentW(entries[0].contentRect.width))
    ro.observe(contentRef.current!)
    return () => ro.disconnect()
  }, [])

  const GAP = 12
  const minThumbForSix = Math.max(96, Math.floor((contentW - (6 - 1) * GAP) / 6))
  const [gridSize, setGridSizeState] = useState(Math.max(140, minThumbForSix))
  useEffect(() => setGridSizeState((s) => Math.max(s, minThumbForSix)), [minThumbForSix])
  const setGridSize = (n: number) => setGridSizeState(Math.max(n, minThumbForSix))
  const sidebarWidth = SIDEBAR_WIDTHS[sidebarMode]

  const [folderMode, setFolderMode] = useState<'date' | 'custom'>('date')
  const [customFolder, setCustomFolder] = useState('My Folder')

  const { years: dateTree, dayNodeMap, photoKeyMap } = useMemo(() => buildDateTree(photos), [photos])

  const rawYear = searchParams.get('year')
  const rawMonth = searchParams.get('month')
  const rawDay = searchParams.get('day')

  const normalizedYear = useMemo(() => normalizeYearParam(rawYear), [rawYear])
  const normalizedMonth = useMemo(() => normalizeMonthParam(rawMonth), [rawMonth])
  const normalizedDay = useMemo(() => normalizeDayParam(rawDay), [rawDay])

  const maybeSelectedKey = useMemo(() => {
    if (!normalizedYear || !normalizedMonth || !normalizedDay) return null
    return makeDayKey(normalizedYear, normalizedMonth, normalizedDay)
  }, [normalizedYear, normalizedMonth, normalizedDay])

  useEffect(() => {
    if (!maybeSelectedKey) return
    if (dayNodeMap.has(maybeSelectedKey)) return
    const next = new URLSearchParams(searchParams)
    next.delete('year')
    next.delete('month')
    next.delete('day')
    setSearchParams(next, { replace: true })
  }, [maybeSelectedKey, dayNodeMap, searchParams, setSearchParams])

  const selectedDayKey = maybeSelectedKey && dayNodeMap.has(maybeSelectedKey) ? maybeSelectedKey : null
  const selectedDayNode = selectedDayKey ? dayNodeMap.get(selectedDayKey)! : null

  const handleDaySelect = useCallback((day: DateTreeDayNode) => {
    const next = new URLSearchParams(searchParams)
    if (selectedDayKey === day.id) {
      next.delete('year')
      next.delete('month')
      next.delete('day')
    } else {
      next.set('year', day.year)
      next.set('month', day.month)
      next.set('day', day.day)
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, selectedDayKey, setSearchParams])

  const clearDateFilter = useCallback(() => {
    if (!searchParams.get('year') && !searchParams.get('month') && !searchParams.get('day')) return
    const next = new URLSearchParams(searchParams)
    next.delete('year')
    next.delete('month')
    next.delete('day')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const resetFilters = useCallback(() => {
    setMinStars(0)
    setFilterColor('Any')
    setShowJPEG(true)
    setShowRAW(true)
    setOnlyPicked(false)
    setHideRejected(true)
    clearDateFilter()
  }, [clearDateFilter])

  const visible: Photo[] = useMemo(() => photos.filter((p) => {
    const dateMatch = !selectedDayKey || photoKeyMap.get(p.id) === selectedDayKey
    const typeOk = (p.type === 'JPEG' && showJPEG) || (p.type === 'RAW' && showRAW)
    const ratingOk = p.rating >= minStars
    const pickOk = !onlyPicked || p.picked
    const rejectOk = !hideRejected || !p.rejected
    const colorOk = filterColor === 'Any' || p.tag === filterColor
    return dateMatch && typeOk && ratingOk && pickOk && rejectOk && colorOk
  }), [photos, selectedDayKey, photoKeyMap, showJPEG, showRAW, minStars, onlyPicked, hideRejected, filterColor])

  useEffect(() => {
    setSelectedPhotoIds((prev) => {
      if (!visible.length) {
        if (!prev.size) return prev
        lastSelectedPhotoIdRef.current = null
        selectionAnchorRef.current = null
        return new Set<string>()
      }
      const allowed = new Set(visible.map((p) => p.id))
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowed.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })
      if (!next.size) {
        const fallback = visible[Math.min(current, visible.length - 1)]
        if (fallback) {
          next.add(fallback.id)
          lastSelectedPhotoIdRef.current = fallback.id
          selectionAnchorRef.current = fallback.id
          changed = true
        }
      } else {
        const anchorId = selectionAnchorRef.current
        if (!anchorId || !next.has(anchorId)) {
          selectionAnchorRef.current = next.values().next().value ?? null
        }
        if (!lastSelectedPhotoIdRef.current || !next.has(lastSelectedPhotoIdRef.current)) {
          lastSelectedPhotoIdRef.current = next.values().next().value ?? null
        }
      }
      return changed ? next : prev
    })
  }, [visible, current])

  useEffect(() => {
    if (!visible.length) {
      suppressSelectionSyncRef.current = false
      return
    }
    if (suppressSelectionSyncRef.current) {
      suppressSelectionSyncRef.current = false
      return
    }
    if (selectedPhotoIds.size > 1) {
      return
    }
    const photo = visible[current]
    if (!photo) return
    if (selectedPhotoIds.size === 1 && selectedPhotoIds.has(photo.id)) {
      return
    }
    setSelectedPhotoIds((prev) => {
      if (prev.size === 1 && prev.has(photo.id)) return prev
      return new Set([photo.id])
    })
    lastSelectedPhotoIdRef.current = photo.id
    selectionAnchorRef.current = photo.id
  }, [current, visible, view, selectedPhotoIds])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (minStars > 0) count += 1
    if (filterColor !== 'Any') count += 1
    if (!showJPEG) count += 1
    if (!showRAW) count += 1
    if (onlyPicked) count += 1
    if (!hideRejected) count += 1
    if (selectedDayKey) count += 1
    return count
  }, [minStars, filterColor, showJPEG, showRAW, onlyPicked, hideRejected, selectedDayKey])

  useEffect(() => { if (current >= visible.length) setCurrent(Math.max(0, visible.length - 1)) }, [visible, current])

  // Shortcuts (gleich wie Monolith)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'g' || e.key === 'G') setView('grid')
      if (e.key === 'd' || e.key === 'D') setView('detail')
      if (!visible.length) return
      const cur = visible[current]; if (!cur) return
      if (e.key === 'p' || e.key === 'P') {
        const targets = resolveActionTargetIds(cur.id)
        targets.forEach((id) => {
          const photo = photos.find((x) => x.id === id)
          if (photo) {
            void togglePick(photo)
          }
        })
      }
      if (e.key === 'x' || e.key === 'X') {
        const targets = resolveActionTargetIds(cur.id)
        if (targets.size) {
          photos.forEach((photo) => {
            if (targets.has(photo.id) && photo.picked) {
              void togglePick(photo)
            }
          })
          setPhotos((arr) =>
            arr.map((x) =>
              targets.has(x.id)
                ? {
                    ...x,
                    rejected: !x.rejected,
                    picked: x.picked ? false : x.picked,
                  }
                : x,
            ),
          )
        }
      }
      if (/^[1-5]$/.test(e.key)) {
        const targets = resolveActionTargetIds(cur.id)
        if (targets.size) {
          const rating = Number(e.key) as 1 | 2 | 3 | 4 | 5
          setPhotos((arr) => arr.map((x) => (targets.has(x.id) ? { ...x, rating } : x)))
        }
      }
      if (e.key === 'ArrowRight') setCurrent((i) => Math.min(i + 1, visible.length - 1))
      if (e.key === 'ArrowLeft') setCurrent((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [visible, current, togglePick, resolveActionTargetIds, photos])

  // Custom events vom Grid
  useEffect(() => {
    const onRate = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      const rating = e.detail.r as 1 | 2 | 3 | 4 | 5
      setPhotos((arr) => arr.map((x) => (targets.has(x.id) ? { ...x, rating } : x)))
    }
    const onPick = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      targets.forEach((id) => {
        const photo = photos.find((x) => x.id === id)
        if (photo) {
          void togglePick(photo)
        }
      })
    }
    const onReject = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      photos.forEach((photo) => {
        if (targets.has(photo.id) && photo.picked) {
          void togglePick(photo)
        }
      })
      setPhotos((arr) =>
        arr.map((x) =>
          targets.has(x.id)
            ? {
                ...x,
                rejected: !x.rejected,
                picked: x.picked ? false : x.picked,
              }
            : x,
        ),
      )
    }
    const onColor = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      const color = e.detail.t as ColorTag
      setPhotos((arr) => arr.map((x) => (targets.has(x.id) ? { ...x, tag: color } : x)))
    }
    window.addEventListener('rate', onRate as any)
    window.addEventListener('pick', onPick as any)
    window.addEventListener('reject', onReject as any)
    window.addEventListener('color', onColor as any)
    return () => {
      window.removeEventListener('rate', onRate as any)
      window.removeEventListener('pick', onPick as any)
      window.removeEventListener('reject', onReject as any)
      window.removeEventListener('color', onColor as any)
    }
  }, [photos, togglePick, resolveActionTargetIds])

  useEffect(() => {
    if (!id) return
    refreshAssets()
  }, [id, refreshAssets])

  useEffect(() => {
    if (!id) return
    if (!photos.some((p) => !p.thumbSrc)) return
    const timer = window.setInterval(() => {
      refreshAssets()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [id, photos, refreshAssets])

  // Import Sheet
  const [importOpen, setImportOpen] = useState(false)
  const [uploadBanner, setUploadBanner] = useState<UploadBannerState | null>(null)
  const uploadBannerTimeoutRef = useRef<number | null>(null)

  const handleUploadProgress = useCallback((snapshot: UploadProgressSnapshot) => {
    if (uploadBannerTimeoutRef.current !== null) {
      window.clearTimeout(uploadBannerTimeoutRef.current)
      uploadBannerTimeoutRef.current = null
    }

    if (!snapshot.active && snapshot.total === 0) {
      setUploadBanner(null)
      return
    }

    if (snapshot.active) {
      setUploadBanner({
        ...snapshot,
        status: 'running',
      })
      return
    }

    if (snapshot.error) {
      setUploadBanner({
        ...snapshot,
        status: 'error',
      })
      uploadBannerTimeoutRef.current = window.setTimeout(() => {
        setUploadBanner(null)
        uploadBannerTimeoutRef.current = null
      }, 6000)
      return
    }

    setUploadBanner({
      ...snapshot,
      status: 'success',
    })
    uploadBannerTimeoutRef.current = window.setTimeout(() => {
      setUploadBanner(null)
      uploadBannerTimeoutRef.current = null
    }, 4000)
  }, [])

  useEffect(() => () => {
    if (uploadBannerTimeoutRef.current !== null) {
      window.clearTimeout(uploadBannerTimeoutRef.current)
    }
  }, [])
  const handleImport = useCallback(async (_args: { count: number; types: ImgType[]; dest: string }) => {
    if (importInFlightRef.current) return
    importInFlightRef.current = true
    try {
      await refreshAssets(true)
      setImportOpen(false)
    } finally {
      importInFlightRef.current = false
    }
  }, [refreshAssets])

  // Back to projects
  function goBack() { navigate('/') }

  const currentPhoto = visible[current] ?? null
  const handlePhotoSelect = useCallback(
    (idx: number, options?: GridSelectOptions) => {
      const photo = visible[idx]
      if (!photo) return
      const shouldSuppress = idx !== current
      suppressSelectionSyncRef.current = shouldSuppress
      setCurrent(idx)
      setSelectedPhotoIds((prev) => {
        if (options?.shiftKey) {
          const anchorId =
            selectionAnchorRef.current ??
            lastSelectedPhotoIdRef.current ??
            (prev.size ? prev.values().next().value ?? null : null)
          if (anchorId) {
            const anchorIndex = visible.findIndex((item) => item.id === anchorId)
            if (anchorIndex !== -1) {
              const start = Math.min(anchorIndex, idx)
              const end = Math.max(anchorIndex, idx)
              const next = new Set<string>()
              for (let i = start; i <= end; i += 1) {
                next.add(visible[i].id)
              }
              lastSelectedPhotoIdRef.current = photo.id
              if (!selectionAnchorRef.current) {
                selectionAnchorRef.current = anchorId
              }
              return next
            }
          }
        }
        if (options?.metaKey || options?.ctrlKey) {
          const next = new Set(prev)
          if (next.has(photo.id)) {
            next.delete(photo.id)
            if (!next.size) {
              next.add(photo.id)
            }
          } else {
            next.add(photo.id)
          }
          lastSelectedPhotoIdRef.current = photo.id
          selectionAnchorRef.current = photo.id
          return next
        }
        lastSelectedPhotoIdRef.current = photo.id
        selectionAnchorRef.current = photo.id
        if (prev.size === 1 && prev.has(photo.id)) return prev
        return new Set([photo.id])
      })
      if (!shouldSuppress) {
        suppressSelectionSyncRef.current = false
      }
    },
    [visible, current],
  )
  const currentAssetId = currentPhoto?.id ?? null
  const {
    data: currentAssetDetail,
    isFetching: assetDetailFetching,
    error: assetDetailError,
  } = useQuery<AssetDetail>({
    queryKey: ['asset-detail', currentAssetId],
    queryFn: () => getAsset(currentAssetId as string),
    enabled: Boolean(currentAssetId),
    staleTime: 1000 * 60 * 5,
  })
  const metadataEntries = useMemo(() => {
    if (!currentAssetDetail?.metadata) return []
    return Object.entries(currentAssetDetail.metadata)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ key, value }))
  }, [currentAssetDetail?.metadata])
  const metadataWarnings = useMemo(() => {
    const warnings = currentAssetDetail?.metadata_warnings ?? currentPhoto?.metadataWarnings ?? []
    return warnings.filter((warning) => !IGNORED_METADATA_WARNINGS.has(warning))
  }, [currentAssetDetail?.metadata_warnings, currentPhoto?.metadataWarnings])
  const detailDateLabel = useMemo(() => {
    if (!currentPhoto) return '—'
    const source = currentPhoto.capturedAt ?? currentPhoto.uploadedAt ?? currentPhoto.date
    if (!source) return '—'
    const parsed = new Date(source)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString()
  }, [currentPhoto])

  const hasAny = photos.length > 0

  useEffect(() => {
    setPickError(null)
  }, [currentPhoto?.id])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
      <TopBar
        projectName={projectName}
        onBack={goBack}
        onRename={handleRename}
        renamePending={renameMutation.isPending}
        renameError={renameMutation.isError ? (renameMutation.error as Error).message : null}
        onImport={() => setImportOpen(true)}
        view={view}
        onChangeView={setView}
        gridSize={gridSize}
        minGridSize={minThumbForSix}
        onGridSizeChange={setGridSize}
        filters={{
          minStars,
          setMinStars,
          filterColor,
          setFilterColor,
          showJPEG,
          setShowJPEG,
          showRAW,
          setShowRAW,
          onlyPicked,
          setOnlyPicked,
          hideRejected,
          setHideRejected,
          selectedDayLabel: selectedDayNode ? selectedDayNode.label : null,
          dateFilterActive: Boolean(selectedDayKey),
          clearDateFilter,
        }}
        filterCount={activeFilterCount}
        onResetFilters={resetFilters}
        visibleCount={visible.length}
        selectedDayLabel={selectedDayNode ? selectedDayNode.label : null}
        loadingAssets={loadingAssets}
        loadError={loadError}
      />
      {uploadBanner && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`pointer-events-auto w-72 rounded-lg border px-4 py-3 shadow-lg ${
              uploadBanner.status === 'error'
                ? 'border-[#F7C9C9] bg-[#FDF2F2]'
                : 'border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]'
            }`}
          >
            {uploadBanner.status === 'running' && (
              <>
                <div className="flex items-center justify-between text-sm font-semibold text-[var(--text,#1F1E1B)]">
                  Uploading assets
                  <span className="text-xs text-[var(--text-muted,#6B645B)]">{uploadBanner.percent}%</span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
                  {uploadBanner.completed}/{uploadBanner.total} assets • {formatBytes(uploadBanner.bytesUploaded)} of {formatBytes(uploadBanner.bytesTotal)}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[var(--sand-100,#F3EBDD)]">
                  <div className="h-full rounded-full bg-[var(--charcoal-800,#1F1E1B)]" style={{ width: `${uploadBanner.percent}%` }} />
                </div>
              </>
            )}
            {uploadBanner.status === 'success' && (
              <div>
                <div className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Upload complete</div>
                <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
                  {uploadBanner.total} asset{uploadBanner.total === 1 ? '' : 's'} imported • {formatBytes(uploadBanner.bytesTotal)}
                </div>
              </div>
            )}
            {uploadBanner.status === 'error' && (
              <div>
                <div className="text-sm font-semibold text-[#B42318]">Upload interrupted</div>
                <div className="mt-1 text-[11px] text-[#B42318]">
                  {uploadBanner.error ?? 'Something went wrong. Please reopen the import sheet to retry.'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="flex-1 min-h-0 grid overflow-hidden"
        style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0,1fr) ${INSPECTOR_WIDTH}px` }}
      >
        <Sidebar
          dateTree={dateTree}
          onOpenImport={() => setImportOpen(true)}
          onSelectDay={handleDaySelect}
          selectedDayKey={selectedDayKey}
          selectedDay={selectedDayNode}
          onClearDateFilter={clearDateFilter}
          mode={sidebarMode}
          onModeChange={handleSidebarModeChange}
          onCollapse={collapseSidebar}
          onExpand={expandSidebar}
        />

        <main ref={contentRef} className="relative flex min-h-0 flex-col bg-[var(--surface,#FFFFFF)] border-r border-[var(--border,#E1D3B9)]">
          <div className="flex-1 min-h-0 overflow-hidden">
            {!hasAny ? (
              <div className="flex h-full items-center justify-center overflow-auto p-6">
                <EmptyState onImport={() => setImportOpen(true)} />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex h-full items-center justify-center overflow-auto p-6">
                <NoResults onReset={resetFilters} />
              </div>
            ) : view === 'grid' ? (
              <div className="h-full overflow-auto">
                <GridView
                  items={visible}
                  size={gridSize}
                  gap={GAP}
                  containerWidth={contentW}
                  onOpen={(idx) => { setCurrent(idx); setView('detail') }}
                  onSelect={handlePhotoSelect}
                  selectedIds={selectedPhotoIds}
                />
              </div>
            ) : (
              <DetailView
                items={visible}
                index={current}
                setIndex={setCurrent}
                className="h-full"
                selectedIds={selectedPhotoIds}
                onSelect={handlePhotoSelect}
              />
            )}
          </div>
        </main>

        <aside className="h-full overflow-y-auto bg-[var(--surface,#FFFFFF)] p-3 text-xs">
          <h4 className="font-medium mb-2">Inspector</h4>
          {currentPhoto ? (
            <div className="space-y-2">
              <Row label="Name" value={currentPhoto.name} />
              <Row label="Type" value={currentPhoto.type} />
              <Row label="Date" value={detailDateLabel} />
              <Row
                label="Size"
                value={
                  assetDetailFetching && !currentAssetDetail
                    ? 'Loading…'
                    : currentAssetDetail
                      ? formatBytes(currentAssetDetail.size_bytes)
                      : '—'
                }
              />
              <Row label="Dimensions" value={formatDimensions(currentAssetDetail?.width, currentAssetDetail?.height)} />
              <Row label="Rating" value={`${currentPhoto.rating}★`} />
              <Row label="Flag" value={currentPhoto.picked ? 'Picked' : '—'} />
              <Row label="Rejected" value={currentPhoto.rejected ? 'Yes' : 'No'} />
              <Row label="Color" value={currentPhoto.tag} />
              <MetadataSummary
                entries={metadataEntries}
                warnings={metadataWarnings}
                loading={Boolean(currentAssetId) && assetDetailFetching}
                error={assetDetailError}
              />
            </div>
          ) : (
            <div className="text-[var(--text-muted,#6B645B)]">No selection</div>
          )}
        </aside>
      </div>

      {importOpen && (
        <ImportSheet
          projectId={id}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
          onProgressSnapshot={handleUploadProgress}
          folderMode={folderMode}
          customFolder={customFolder}
        />
      )}
    </div>
  )
}

// Inline Kleinteile (nur diese Seite)
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border,#E1D3B9)] py-1">
      <span className="text-[var(--text-muted,#6B645B)]">{label}</span>
      <span className="font-mono text-[11px]">{value}</span>
    </div>
  )
}

function MetadataSummary({
  entries,
  warnings,
  loading,
  error,
}: {
  entries: { key: string; value: unknown }[]
  warnings: string[]
  loading: boolean
  error: unknown
}) {
  const hasEntries = entries.length > 0
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : null

  return (
    <div className="mt-4 space-y-2 rounded border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
        <span>Metadata</span>
        {loading ? <span className="text-[var(--text-muted,#6B645B)] normal-case">Loading…</span> : null}
      </div>
      {errorMessage ? <p className="text-[10px] text-[#B42318]">{errorMessage}</p> : null}
      {warnings.length ? (
        <ul className="space-y-1 text-[10px] text-[#B45309]">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#F59E0B] text-[#B45309]">!</span>
              <span className="truncate">{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {hasEntries ? (
        <div className="max-h-64 overflow-auto rounded border border-[var(--border,#E1D3B9)]">
          <div className="divide-y divide-[var(--border,#E1D3B9)]">
            {entries.map(({ key, value }) => (
              <div key={key} className="grid grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)] gap-3 px-3 py-1.5">
                <div className="font-mono text-[10px] text-[var(--text-muted,#6B645B)] break-words">{key}</div>
                <div className="text-[11px] text-[var(--text,#1F1E1B)] break-words">{formatMetadataValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !errorMessage ? (
        <p className="text-[11px] text-[var(--text-muted,#6B645B)]">No metadata available for this asset.</p>
      ) : null}
    </div>
  )
}

const RAW_LIKE_EXTENSIONS = new Set(['arw', 'cr2', 'cr3', 'nef', 'raf', 'orf', 'rw2', 'dng', 'sr2', 'pef'])

function inferTypeFromName(name: string): ImgType {
  const ext = name.split('.').pop()?.toLowerCase()
  if (!ext) return 'JPEG'
  if (RAW_LIKE_EXTENSIONS.has(ext)) return 'RAW'
  return 'JPEG'
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '—'
  if (size === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDimensions(width?: number | null, height?: number | null): string {
  if (!width || !height) return '—'
  return `${width}×${height}`
}

function formatMetadataValue(input: unknown): string {
  if (input === null || input === undefined) return '—'
  if (Array.isArray(input)) {
    if (input.length === 0) return '[]'
    return input.map((item) => formatMetadataValue(item)).join(', ')
  }
  if (typeof input === 'object') {
    try {
      return JSON.stringify(input)
    } catch {
      return '[object]'
    }
  }
  if (typeof input === 'boolean') {
    return input ? 'true' : 'false'
  }
  return String(input)
}

type LocalFileDescriptor = {
  id: string
  file: File
  folder: string
  relativePath?: string
}

type LocalQueueProgress = {
  active: boolean
  totalFiles: number
  processedFiles: number
  totalBytes: number
  processedBytes: number
}

type PendingItem = {
  id: string
  name: string
  type: ImgType
  previewUrl?: string | null
  source: 'local' | 'hub'
  selected: boolean
  size: number
  file?: File | null
  meta?: {
    folder?: string
    relativePath?: string
  }
  ready?: boolean
}

type ToggleOptions = {
  shiftKey?: boolean
}

function generateLocalDescriptorId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      // Fall through to fallback when randomUUID is not permitted.
    }
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeLocalPendingItems(files: LocalFileDescriptor[]): PendingItem[] {
  if (!files.length) return []
  return files.map(({ id, file, folder, relativePath }) => {
    const previewUrl = typeof URL === 'undefined' ? null : URL.createObjectURL(file)
    return {
      id,
      name: file.name,
      type: inferTypeFromName(file.name),
      previewUrl,
      source: 'local' as const,
      selected: true,
      size: file.size,
      file,
      meta: { folder, relativePath },
      ready: true,
    }
  })
}

function deriveFolderFromRelativePath(relativePath?: string | null): string {
  if (!relativePath) return 'Loose selection'
  const parts = relativePath.split('/').filter(Boolean)
  if (parts.length <= 1) return 'Loose selection'
  return parts.slice(0, -1).join('/')
}

function buildLocalDescriptorsFromFileList(fileList: FileList | File[]): LocalFileDescriptor[] {
  const files = Array.isArray(fileList) ? fileList : Array.from(fileList)
  return files.map((file) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const folder = deriveFolderFromRelativePath(relativePath)
    return { id: generateLocalDescriptorId(), file, folder, relativePath }
  })
}

async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<LocalFileDescriptor[]> {
  const descriptors: LocalFileDescriptor[] = []
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : []
  const processAsFiles = () => {
    const fallback = buildLocalDescriptorsFromFileList(dataTransfer.files)
    descriptors.push(...fallback)
  }
  if (!items.length) {
    processAsFiles()
    return descriptors
  }
  const traverseEntries = async (entry: any, parentPath: string) => {
    if (!entry) return
    if ((entry as any).isFile) {
      const file: File = await new Promise((resolve, reject) => {
        entry.file((f: File) => resolve(f), reject)
      })
      const relativePath = parentPath ? `${parentPath}/${file.name}` : file.name
      descriptors.push({
        id: generateLocalDescriptorId(),
        file,
        folder: deriveFolderFromRelativePath(relativePath),
        relativePath,
      })
    } else if ((entry as any).isDirectory) {
      const dirPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
      const reader = entry.createReader()
      const readEntries = async (): Promise<any[]> => new Promise((resolve, reject) => {
        const all: any[] = []
        const readChunk = () => {
          reader.readEntries((batch: any[]) => {
            if (!batch.length) {
              resolve(all)
            } else {
              all.push(...batch)
              readChunk()
            }
          }, reject)
        }
        readChunk()
      })
      const children = await readEntries()
      await Promise.all(children.map((child) => traverseEntries(child, dirPath)))
    }
  }

  const entryPromises: Promise<void>[] = []
  items.forEach((item) => {
    const entry = (item as any).webkitGetAsEntry?.()
    if (entry) {
      entryPromises.push(traverseEntries(entry, ''))
    } else if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        const relativePath = file.name
        descriptors.push({
          id: generateLocalDescriptorId(),
          file,
          folder: deriveFolderFromRelativePath(relativePath),
          relativePath,
        })
      }
    }
  })

  if (!entryPromises.length && !descriptors.length) {
    processAsFiles()
    return descriptors
  }

  try {
    await Promise.all(entryPromises)
  } catch {
    // In case of failure, fall back to basic file list handling.
    descriptors.splice(0, descriptors.length)
    processAsFiles()
  }
  return descriptors
}

type UploadPhase = 'pending' | 'initializing' | 'uploading' | 'finalizing' | 'success' | 'error' | 'blocked'

type UploadTaskState = {
  id: string
  name: string
  type: ImgType
  size: number
  file: File
  source: 'local' | 'hub'
  mimeType: string
  bytesUploaded: number
  progress: number
  status: UploadPhase
  error: string | null
  assetId?: string
  uploadToken?: string
  meta?: PendingItem['meta']
}

const BLOCKED_UPLOAD_MESSAGE = 'Blocked by earlier upload failure.'
const MAX_CONCURRENT_UPLOADS = 3

type UploadProgressSnapshot = {
  active: boolean
  percent: number
  completed: number
  total: number
  bytesUploaded: number
  bytesTotal: number
  error: string | null
}

type UploadBannerState = UploadProgressSnapshot & { status: 'running' | 'success' | 'error' }

type HubNode = {
  id: string
  name: string
  assetCount?: number
  types?: ImgType[]
  children?: HubNode[]
}

const IMAGE_HUB_TREE: HubNode[] = [
  {
    id: 'proj-northern-lights',
    name: 'Northern Lights',
    children: [
      {
        id: 'proj-northern-lights/basecamp-2024',
        name: '2024 - Basecamp Diaries',
        assetCount: 64,
        types: ['RAW', 'JPEG'],
      },
      {
        id: 'proj-northern-lights/night-shift',
        name: 'Night Shift Selects',
        assetCount: 28,
        types: ['RAW'],
      },
    ],
  },
  {
    id: 'proj-editorial',
    name: 'Editorial Campaigns',
    children: [
      {
        id: 'proj-editorial/wild-coast',
        name: 'Wild Coast',
        children: [
          {
            id: 'proj-editorial/wild-coast/lookbook',
            name: 'Lookbook Deliverables',
            assetCount: 35,
            types: ['JPEG'],
          },
          {
            id: 'proj-editorial/wild-coast/bts',
            name: 'Behind the Scenes',
            assetCount: 12,
            types: ['RAW', 'JPEG'],
          },
        ],
      },
      {
        id: 'proj-editorial/urban-shapes',
        name: 'Urban Shapes',
        assetCount: 52,
        types: ['RAW', 'JPEG'],
      },
    ],
  },
  {
    id: 'proj-archive',
    name: 'Archive',
    children: [
      {
        id: 'proj-archive/35mm',
        name: '35mm Film',
        assetCount: 120,
        types: ['JPEG'],
      },
      {
        id: 'proj-archive/medium-format',
        name: 'Medium Format Scans',
        assetCount: 76,
        types: ['RAW', 'JPEG'],
      },
    ],
  },
]

type HubAggregate = { count: number; types: ImgType[] }

function buildHubData(nodes: HubNode[]) {
  const nodeMap = new Map<string, HubNode>()
  const parentMap = new Map<string, string | null>()
  const aggregateMap = new Map<string, HubAggregate>()

  const visit = (node: HubNode, parent: string | null) => {
    nodeMap.set(node.id, node)
    parentMap.set(node.id, parent)
    let count = node.assetCount ?? 0
    const typeSet = new Set<ImgType>(node.types ?? [])
    node.children?.forEach((child) => {
      visit(child, node.id)
      const agg = aggregateMap.get(child.id)
      if (agg) {
        count += agg.count
        agg.types.forEach((t) => typeSet.add(t))
      }
    })
    aggregateMap.set(node.id, { count, types: Array.from(typeSet) as ImgType[] })
  }

  nodes.forEach((node) => visit(node, null))

  return { nodeMap, parentMap, aggregateMap }
}

const HUB_DATA = buildHubData(IMAGE_HUB_TREE)

type HubAsset = { id: string; name: string; type: ImgType; folderPath: string }

const HUB_LEAF_ASSET_CACHE = new Map<string, HubAsset[]>()
const HUB_ALL_ASSET_CACHE = new Map<string, HubAsset[]>()

function getHubNodePath(id: string): string[] {
  const path: string[] = []
  let current: string | null = id
  while (current) {
    const node = HUB_DATA.nodeMap.get(current)
    if (!node) break
    path.unshift(node.name)
    current = HUB_DATA.parentMap.get(current) ?? null
  }
  return path
}

function ensureLeafAssets(node: HubNode): HubAsset[] {
  if (!node.assetCount) return []
  if (!HUB_LEAF_ASSET_CACHE.has(node.id)) {
    const path = getHubNodePath(node.id)
    const baseName = path[path.length - 1] || node.name
    const types = node.types && node.types.length ? node.types : (['JPEG'] as ImgType[])
    const assets: HubAsset[] = []
    for (let i = 0; i < node.assetCount; i++) {
      const type = types[i % types.length]
      const suffix = type === 'RAW' ? 'ARW' : 'JPG'
      const index = String(i + 1).padStart(4, '0')
      assets.push({
        id: `${node.id}::${index}`,
        name: `${baseName.replace(/\s+/g, '_')}_${index}.${suffix}`,
        type,
        folderPath: path.join(' / ') || baseName,
      })
    }
    HUB_LEAF_ASSET_CACHE.set(node.id, assets)
  }
  return HUB_LEAF_ASSET_CACHE.get(node.id)!
}

function getAssetsForNode(node: HubNode): HubAsset[] {
  if (HUB_ALL_ASSET_CACHE.has(node.id)) return HUB_ALL_ASSET_CACHE.get(node.id)!
  let assets: HubAsset[] = []
  if (node.assetCount) {
    assets = ensureLeafAssets(node)
  } else {
    node.children?.forEach((child) => {
      assets = assets.concat(getAssetsForNode(child))
    })
  }
  HUB_ALL_ASSET_CACHE.set(node.id, assets)
  return assets
}

function PendingMiniGrid({ items, onToggle, className }: { items: PendingItem[]; onToggle: (id: string, opts?: ToggleOptions) => void; className?: string }) {
  const extra = className ? ` ${className}` : ''
  if (!items.length) {
    return (
      <div className={`rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 text-center text-xs text-[var(--text-muted,#6B645B)]${extra}`}>
        Nothing selected yet.
      </div>
    )
  }
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    setScrollEl(node)
  }, [])

  useEffect(() => {
    if (!scrollEl) return
    const handleScroll = () => setScrollTop(scrollEl.scrollTop)
    handleScroll()
    scrollEl.addEventListener('scroll', handleScroll)
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [scrollEl])

  useEffect(() => {
    if (!scrollEl) return
    if (typeof ResizeObserver === 'undefined') {
      setViewportHeight(scrollEl.clientHeight)
      setContainerWidth(scrollEl.clientWidth)
      return
    }
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return
      const rect = entries[0].contentRect
      setViewportHeight(rect.height)
      setContainerWidth(rect.width)
    })
    observer.observe(scrollEl)
    return () => observer.disconnect()
  }, [scrollEl])

  const VIRTUAL_TILE_WIDTH = 96
  const VIRTUAL_TILE_HEIGHT = 118
  const GRID_GAP = 8
  const rowStride = VIRTUAL_TILE_HEIGHT + GRID_GAP
  const overscanRows = 2

  const columns = useMemo(() => (containerWidth ? Math.max(1, computeCols(containerWidth, VIRTUAL_TILE_WIDTH, GRID_GAP)) : 1), [containerWidth])

  const { startIndex, endIndex, paddingTop, paddingBottom } = useMemo(() => {
    if (!items.length) return { startIndex: 0, endIndex: 0, paddingTop: 0, paddingBottom: 0 }
    const rowCount = Math.max(1, Math.ceil(items.length / columns))
    const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - overscanRows)
    const effectiveViewport = viewportHeight || rowStride
    const endRow = Math.min(rowCount, Math.ceil((scrollTop + effectiveViewport) / rowStride) + overscanRows)
    const clampedStart = Math.min(items.length, startRow * columns)
    const clampedEnd = Math.min(items.length, endRow * columns)
    const visibleRows = Math.max(0, endRow - startRow)
    const totalHeight = rowCount * VIRTUAL_TILE_HEIGHT + Math.max(0, rowCount - 1) * GRID_GAP
    const topPad = startRow * (VIRTUAL_TILE_HEIGHT + GRID_GAP)
    const visibleHeight = visibleRows * VIRTUAL_TILE_HEIGHT + Math.max(0, visibleRows - 1) * GRID_GAP
    const bottomPad = Math.max(0, totalHeight - topPad - visibleHeight)
    return { startIndex: clampedStart, endIndex: clampedEnd, paddingTop: topPad, paddingBottom: bottomPad }
  }, [items, columns, scrollTop, viewportHeight])

  const visibleItems = items.slice(startIndex, endIndex || items.length)

  return (
    <div className={`rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-2${extra}`}>
      <div className="h-full overflow-y-auto pr-1" ref={setScrollRef}>
        <div style={{ height: `${paddingTop}px` }} />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(88px, 1fr))`, gap: `${GRID_GAP}px` }}>
          {visibleItems.map((item) => (
            <label
              key={item.id}
              className={`relative block overflow-hidden rounded-md border text-left ${item.selected ? 'border-[var(--charcoal-800,#1F1E1B)] bg-[var(--surface,#FFFFFF)]' : 'border-[var(--border,#E1D3B9)] bg-[var(--sand-100,#F3EBDD)] opacity-70'}`}
              aria-busy={item.ready === false}
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) => {
                  const native = event.nativeEvent as MouseEvent | KeyboardEvent | PointerEvent
                  onToggle(item.id, { shiftKey: Boolean(native.shiftKey) })
                }}
                className="absolute left-1 top-1 h-4 w-4 accent-[var(--charcoal-800,#1F1E1B)]"
                aria-label={`Toggle ${item.name}`}
              />
              <div className="h-16 w-full bg-[var(--sand-100,#F3EBDD)]">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} className="h-16 w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-16 w-full items-center justify-center text-[10px] font-medium text-[var(--text-muted,#6B645B)] ${
                      item.ready === false ? 'animate-pulse' : ''
                    }`}
                  >
                    {item.ready === false ? (
                      <span className="inline-flex items-center gap-1 text-[var(--text-muted,#6B645B)]">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent" aria-hidden />
                        Preparing…
                      </span>
                    ) : (
                      item.type
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[9px] font-medium uppercase tracking-wide">
                <span className="text-[var(--charcoal-800,#1F1E1B)]">{item.ready === false ? 'Preparing' : 'Pending'}</span>
                <span className="text-[var(--text-muted,#6B645B)]">{formatBytes(item.size)}</span>
              </div>
              <div className="truncate px-2 pb-2 text-[10px] text-[var(--text-muted,#6B645B)]">{item.name}</div>
            </label>
          ))}
        </div>
        <div style={{ height: `${paddingBottom}px` }} />
      </div>
    </div>
  )
}

function collectDescendantIds(node: HubNode, acc: string[] = []) {
  node.children?.forEach((child) => {
    acc.push(child.id)
    collectDescendantIds(child, acc)
  })
  return acc
}

function hasAncestorSelected(id: string, selection: Set<string>, parentMap: Map<string, string | null>) {
  let parent = parentMap.get(id) ?? null
  while (parent) {
    if (selection.has(parent)) return true
    parent = parentMap.get(parent) ?? null
  }
  return false
}

export function ImportSheet({
  projectId,
  onClose,
  onImport,
  onProgressSnapshot,
  folderMode,
  customFolder,
}: {
  projectId?: string
  onClose: () => void
  onImport: (args: { count: number; types: ImgType[]; dest: string }) => void
  onProgressSnapshot?: (snapshot: UploadProgressSnapshot) => void
  folderMode: 'date' | 'custom'
  customFolder: string
}) {
  const [mode, setMode] = useState<'choose' | 'local' | 'hub' | 'upload'>('choose')
  const [localItems, setLocalItems] = useState<PendingItem[]>([])
  const [hubSelected, setHubSelected] = useState<Set<string>>(() => new Set())
  const [expandedHub, setExpandedHub] = useState<Set<string>>(() => new Set(IMAGE_HUB_TREE.map((node) => node.id)))
  const [ignoreDup, setIgnoreDup] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [hubItems, setHubItems] = useState<PendingItem[]>([])
  const lastLocalToggleIdRef = useRef<string | null>(null)
  const lastHubToggleIdRef = useRef<string | null>(null)
  const localPreviewUrlsRef = useRef<string[]>([])
  const dragDepthRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const localDescriptorQueueRef = useRef<LocalFileDescriptor[]>([])
  const localDescriptorProcessingRef = useRef(false)
  const localDescriptorTaskRef = useRef<number | null>(null)
  const localDescriptorRunTokenRef = useRef(0)
  const [localPriming, setLocalPriming] = useState(false)
  const [localQueueProgress, setLocalQueueProgress] = useState<LocalQueueProgress>({
    active: false,
    totalFiles: 0,
    processedFiles: 0,
    totalBytes: 0,
    processedBytes: 0,
  })

  const derivedDest = folderMode === 'date' ? 'YYYY/MM/DD' : customFolder.trim() || 'Custom'
  const [uploadDestination, setUploadDestination] = useState(derivedDest)
  const [uploadTasks, setUploadTasks] = useState<UploadTaskState[]>([])
  const [uploadRunning, setUploadRunning] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadTypesRef = useRef<ImgType[]>([])
  const uploadCompletionNotifiedRef = useRef(false)
  const uploadProcessingRef = useRef(false)
  const uploadTasksRef = useRef<UploadTaskState[]>([])

  useEffect(() => {
    if (mode !== 'upload') {
      setUploadDestination(derivedDest)
    }
  }, [derivedDest, mode])

  useEffect(() => {
    uploadTasksRef.current = uploadTasks
  }, [uploadTasks])

  useEffect(() => { (document.getElementById('import-sheet') as HTMLDivElement | null)?.focus() }, [])

  useEffect(() => {
    if (!folderInputRef.current) return
    folderInputRef.current.setAttribute('webkitdirectory', '')
    folderInputRef.current.setAttribute('directory', '')
  }, [])

  useEffect(() => () => {
    if (localDescriptorTaskRef.current !== null) {
      window.clearTimeout(localDescriptorTaskRef.current)
      localDescriptorTaskRef.current = null
    }
    localDescriptorQueueRef.current = []
    localDescriptorProcessingRef.current = false
    localDescriptorRunTokenRef.current += 1
    localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    localPreviewUrlsRef.current = []
  }, [])

  useEffect(() => {
    setHubItems((prev) => {
      const prevSelectionMap = new Map(prev.map((item) => [item.id, item.selected]))
      const rootIds = Array.from(hubSelected).filter((id) => !hasAncestorSelected(id, hubSelected, HUB_DATA.parentMap))
      const items: PendingItem[] = []
      rootIds.forEach((id) => {
        const node = HUB_DATA.nodeMap.get(id)
        if (!node) return
        const assets = getAssetsForNode(node)
        assets.forEach((asset) => {
          const itemId = `hub-${asset.id}`
          const size = asset.type === 'RAW' ? 48 * 1024 * 1024 : 12 * 1024 * 1024
          items.push({
            id: itemId,
            name: asset.name,
            type: asset.type,
            previewUrl: null,
            source: 'hub',
            selected: prevSelectionMap.get(itemId) ?? true,
            size,
            meta: { folder: asset.folderPath },
          })
        })
      })
      return items
    })
  }, [hubSelected])

  const isUploadMode = mode === 'upload'
  const isHubMode = mode === 'hub'
  const isLocalMode = mode === 'local'
  const usesExpandedModal = mode !== 'choose'
  const effectiveDest = isUploadMode ? uploadDestination : derivedDest

  const localSelectedItems = useMemo(() => localItems.filter((item) => item.selected), [localItems])
  const hubSelectedItems = useMemo(() => hubItems.filter((item) => item.selected), [hubItems])
  const selectedItems = useMemo<PendingItem[]>(() => {
    if (isUploadMode) {
      return uploadTasks.map((task) => ({
        id: task.id,
        name: task.name,
        type: task.type,
        previewUrl: null,
        source: task.source,
        selected: true,
        size: task.size,
        file: task.file,
        meta: task.meta,
      }))
    }
    return isHubMode ? hubSelectedItems : localSelectedItems
  }, [isUploadMode, uploadTasks, isHubMode, hubSelectedItems, localSelectedItems])
  const selectedTypes = useMemo(() => Array.from(new Set(selectedItems.map((item) => item.type))) as ImgType[], [selectedItems])
  const totalSelectedBytes = useMemo(() => selectedItems.reduce((acc, item) => acc + (item.size || 0), 0), [selectedItems])
  const selectedFolders = useMemo(() => {
    const folders = new Set<string>()
    selectedItems.forEach((item) => folders.add(item.meta?.folder ?? 'Selection'))
    return folders
  }, [selectedItems])

  const uploadUploadedBytes = useMemo(() => uploadTasks.reduce((acc, task) => acc + task.bytesUploaded, 0), [uploadTasks])
  const uploadTotalBytes = useMemo(() => uploadTasks.reduce((acc, task) => acc + task.size, 0), [uploadTasks])
  const uploadCompletedCount = uploadTasks.filter((task) => task.status === 'success').length
  const uploadOverallProgress = uploadTotalBytes > 0
    ? uploadUploadedBytes / uploadTotalBytes
    : (uploadTasks.length ? uploadCompletedCount / uploadTasks.length : 0)
  const uploadOverallPercent = Math.max(0, Math.min(100, Math.round(uploadOverallProgress * 100)))
  const uploadIncludesHub = uploadTasks.some((item) => item.source === 'hub')

  useEffect(() => {
    if (!onProgressSnapshot) return
    if (!isUploadMode) {
      onProgressSnapshot({
        active: false,
        percent: 0,
        completed: 0,
        total: 0,
        bytesUploaded: 0,
        bytesTotal: 0,
        error: null,
      })
      return
    }
    onProgressSnapshot({
      active: uploadRunning,
      percent: uploadOverallPercent,
      completed: uploadCompletedCount,
      total: uploadTasks.length,
      bytesUploaded: uploadUploadedBytes,
      bytesTotal: uploadTotalBytes,
      error: uploadError,
    })
  }, [
    isUploadMode,
    onProgressSnapshot,
    uploadRunning,
    uploadOverallPercent,
    uploadCompletedCount,
    uploadTasks.length,
    uploadUploadedBytes,
    uploadTotalBytes,
    uploadError,
  ])

  const selectionSummaryText = useMemo(() => {
    if (!selectedItems.length) return 'Nothing selected yet'
    const folderCount = Math.max(1, selectedFolders.size || 0)
    const folderLabel = `folder${folderCount === 1 ? '' : 's'}`
    if (isUploadMode) {
      return `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} across ${folderCount} ${folderLabel} • ${formatBytes(uploadUploadedBytes)} of ${formatBytes(totalSelectedBytes)} uploaded`
    }
    return `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} across ${folderCount} ${folderLabel} • ${formatBytes(totalSelectedBytes)} pending`
  }, [selectedItems, selectedFolders, isUploadMode, totalSelectedBytes, uploadUploadedBytes])

  const localSelectedFolderCount = useMemo(() => (
    localSelectedItems.length ? new Set(localSelectedItems.map((item) => item.meta?.folder ?? 'Selection')).size : 0
  ), [localSelectedItems])
  const hubSelectedFolderCount = useMemo(() => (
    hubSelectedItems.length ? new Set(hubSelectedItems.map((item) => item.meta?.folder ?? 'Selection')).size : 0
  ), [hubSelectedItems])
  const hubSelectionList = useMemo(() => {
    if (!hubSelected.size) return []
    const ids = Array.from(hubSelected).filter((id) => !hasAncestorSelected(id, hubSelected, HUB_DATA.parentMap))
    return ids.map((id) => HUB_DATA.nodeMap.get(id)?.name).filter(Boolean) as string[]
  }, [hubSelected])

  const localQueuePercent = useMemo(() => {
    if (localQueueProgress.totalBytes > 0) {
      return Math.max(0, Math.min(100, Math.round((localQueueProgress.processedBytes / localQueueProgress.totalBytes) * 100)))
    }
    if (localQueueProgress.totalFiles > 0) {
      return Math.max(0, Math.min(100, Math.round((localQueueProgress.processedFiles / localQueueProgress.totalFiles) * 100)))
    }
    return 0
  }, [localQueueProgress])

  const localQueueDetails = useMemo(() => {
    const pieces: string[] = []
    if (localQueueProgress.totalFiles > 0) {
      pieces.push(`${localQueueProgress.processedFiles}/${localQueueProgress.totalFiles} files`)
    }
    if (localQueueProgress.totalBytes > 0) {
      pieces.push(`${formatBytes(localQueueProgress.processedBytes)} of ${formatBytes(localQueueProgress.totalBytes)}`)
    }
    if (localQueuePercent > 0) {
      pieces.push(`${localQueuePercent}%`)
    }
    return pieces.join(' • ')
  }, [localQueuePercent, localQueueProgress])

  const hasLocalItems = localItems.length > 0
  const totalLocalItems = useMemo(() => (hasLocalItems ? localItems.length : localQueueProgress.totalFiles), [hasLocalItems, localItems.length, localQueueProgress.totalFiles])
  const selectedLocalCount = useMemo(() => {
    if (localSelectedItems.length) return localSelectedItems.length
    if (localQueueProgress.active) {
      return Math.min(localQueueProgress.processedFiles, localQueueProgress.totalFiles)
    }
    return 0
  }, [localQueueProgress.active, localQueueProgress.processedFiles, localQueueProgress.totalFiles, localSelectedItems.length])

  const canSubmit = !isUploadMode
    && selectedItems.length > 0
    && !(isLocalMode && localQueueProgress.active)

  const isPreparingLocalSelection = mode !== 'upload'
    && !hasLocalItems
    && (localPriming || localQueueProgress.active || localQueueProgress.totalFiles > 0)

  useEffect(() => {
    if (mode === 'choose' && (localQueueProgress.totalFiles > 0 || hasLocalItems)) {
      setMode('local')
    }
  }, [hasLocalItems, localQueueProgress.totalFiles, mode])

  useEffect(() => {
    if (hasLocalItems && !localQueueProgress.active) {
      setLocalPriming(false)
    }
  }, [hasLocalItems, localQueueProgress.active])

  useEffect(() => {
    if (mode !== 'local') {
      dragDepthRef.current = 0
      setIsDragging(false)
    }
  }, [mode])

  const localFolderGroups = useMemo(() => {
    if (!localItems.length) return []
    const map = new Map<string, { items: PendingItem[]; selected: number; totalBytes: number; selectedBytes: number }>()
    localItems.forEach((item) => {
      const folder = item.meta?.folder ?? 'Loose selection'
      if (!map.has(folder)) map.set(folder, { items: [], selected: 0, totalBytes: 0, selectedBytes: 0 })
      const entry = map.get(folder)!
      entry.items.push(item)
      if (item.selected) entry.selected += 1
      entry.totalBytes += item.size || 0
      if (item.selected) entry.selectedBytes += item.size || 0
    })
    return Array.from(map.entries()).map(([folder, value]) => ({
      folder,
      items: value.items,
      selected: value.selected,
      total: value.items.length,
      bytes: value.totalBytes,
      selectedBytes: value.selectedBytes,
    })).sort((a, b) => a.folder.localeCompare(b.folder))
  }, [localItems])

  function processLocalDescriptorQueue() {
    if (localDescriptorProcessingRef.current) return
    localDescriptorProcessingRef.current = true
    const runToken = localDescriptorRunTokenRef.current
    const batchSize = 8

    const runBatch = () => {
      if (localDescriptorRunTokenRef.current !== runToken) {
        localDescriptorProcessingRef.current = false
        localDescriptorTaskRef.current = null
        return
      }

      const chunk = localDescriptorQueueRef.current.splice(0, batchSize)
      if (!chunk.length) {
        localDescriptorProcessingRef.current = false
        localDescriptorTaskRef.current = null
        setLocalQueueProgress((prev) => {
          if (!prev.active) return prev
          return {
            ...prev,
            active: false,
            processedFiles: prev.totalFiles,
            processedBytes: prev.totalBytes,
          }
        })
        setLocalPriming(false)
        return
      }

      const preparedItems = makeLocalPendingItems(chunk)
      const preparedMap = new Map(preparedItems.map((item) => [item.id, item]))
      const newUrls = preparedItems.map((item) => item.previewUrl).filter((url): url is string => Boolean(url))
      if (newUrls.length) {
        localPreviewUrlsRef.current = [...localPreviewUrlsRef.current, ...newUrls]
      }
      setLocalItems((prev) => {
        let matched = false
        const mapped = prev.map((item) => {
          const hydrated = preparedMap.get(item.id)
          if (!hydrated) return item
          matched = true
          return {
            ...item,
            previewUrl: hydrated.previewUrl,
            file: hydrated.file,
            ready: true,
          }
        })
        if (!matched) {
          return [...prev, ...preparedItems]
        }
        return mapped
      })

      const chunkBytes = chunk.reduce((acc, descriptor) => acc + descriptor.file.size, 0)
      setLocalQueueProgress((prev) => {
        if (!prev.active) return prev
        const processedFiles = Math.min(prev.totalFiles, prev.processedFiles + chunk.length)
        const processedBytes = Math.min(prev.totalBytes, prev.processedBytes + chunkBytes)
        return {
          ...prev,
          processedFiles,
          processedBytes,
        }
      })

      if (localDescriptorQueueRef.current.length) {
        localDescriptorTaskRef.current = window.setTimeout(runBatch, 0)
      } else {
        localDescriptorProcessingRef.current = false
        localDescriptorTaskRef.current = null
        setLocalQueueProgress((prev) => {
          if (!prev.active) return prev
          return {
            ...prev,
            active: false,
            processedFiles: prev.totalFiles,
            processedBytes: prev.totalBytes,
          }
        })
        setLocalPriming(false)
      }
    }

    runBatch()
  }

  function appendLocalDescriptors(descriptors: LocalFileDescriptor[]) {
    if (!descriptors.length) return
    const addedBytes = descriptors.reduce((acc, descriptor) => acc + descriptor.file.size, 0)
    localDescriptorQueueRef.current.push(...descriptors)
    setLocalQueueProgress((prev) => {
      if (prev.active) {
        return {
          ...prev,
          totalFiles: prev.totalFiles + descriptors.length,
          totalBytes: prev.totalBytes + addedBytes,
        }
      }
      return {
        active: true,
        totalFiles: descriptors.length,
        processedFiles: 0,
        totalBytes: addedBytes,
        processedBytes: 0,
      }
    })
    setLocalItems((prev) => {
      if (!descriptors.length) return prev
      const existingIds = new Set(prev.map((item) => item.id))
      const placeholders = descriptors
        .filter((descriptor) => !existingIds.has(descriptor.id))
        .map((descriptor) => ({
          id: descriptor.id,
          name: descriptor.file.name,
          type: inferTypeFromName(descriptor.file.name),
          previewUrl: null,
          source: 'local' as const,
          selected: true,
          size: descriptor.file.size,
          file: descriptor.file,
          meta: { folder: descriptor.folder, relativePath: descriptor.relativePath },
          ready: false,
        }))
      if (!placeholders.length) return prev
      return [...prev, ...placeholders]
    })
    processLocalDescriptorQueue()
  }

function openLocalPicker(kind: 'files' | 'folder' = 'files') {
  const inputRef = kind === 'folder' ? folderInputRef : fileInputRef
  const input = inputRef.current
  setMode('local')
  if (input) {
    input.click()
  } else {
    // Defer in the unlikely event the ref is not attached yet.
    window.requestAnimationFrame(() => inputRef.current?.click())
  }
}

  async function handleLocalDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'upload') return
    dragDepthRef.current = 0
    setIsDragging(false)
    setLocalPriming(true)
    setMode((prev) => (prev === 'local' ? prev : 'local'))
    const descriptors = await collectFilesFromDataTransfer(event.dataTransfer)
    if (!descriptors.length) {
      setLocalPriming(false)
      return
    }
    appendLocalDescriptors(descriptors)
    event.dataTransfer.clearData()
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'upload') return
    if (mode === 'choose') setMode('local')
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'upload') return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'upload') {
      event.dataTransfer.dropEffect = 'none'
      return
    }
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleLocalFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      setLocalPriming(false)
      event.target.value = ''
      return
    }
    if (mode === 'upload') {
      setLocalPriming(false)
      event.target.value = ''
      return
    }
    setMode((prev) => (prev === 'local' ? prev : 'local'))
    setLocalPriming(true)
    const descriptors = buildLocalDescriptorsFromFileList(files)
    appendLocalDescriptors(descriptors)
    event.target.value = ''
  }

  function clearLocalSelection() {
    if (localDescriptorTaskRef.current !== null) {
      window.clearTimeout(localDescriptorTaskRef.current)
      localDescriptorTaskRef.current = null
    }
    localDescriptorQueueRef.current = []
    localDescriptorProcessingRef.current = false
    localDescriptorRunTokenRef.current += 1
    setLocalQueueProgress({
      active: false,
      totalFiles: 0,
      processedFiles: 0,
      totalBytes: 0,
      processedBytes: 0,
    })
    localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    localPreviewUrlsRef.current = []
    lastLocalToggleIdRef.current = null
    setLocalItems([])
  }

  function toggleLocalItem(id: string, opts: ToggleOptions = {}) {
    const anchorId = opts.shiftKey ? lastLocalToggleIdRef.current : null
    setLocalItems((prev) => {
      const targetIndex = prev.findIndex((item) => item.id === id)
      if (targetIndex === -1) return prev
      const nextSelected = !prev[targetIndex].selected
      if (opts.shiftKey && anchorId) {
        const anchorIndex = prev.findIndex((item) => item.id === anchorId)
        if (anchorIndex !== -1 && anchorIndex !== targetIndex) {
          const start = Math.min(anchorIndex, targetIndex)
          const end = Math.max(anchorIndex, targetIndex)
          let changed = false
          const next = prev.map((item, index) => {
            if (index >= start && index <= end) {
              if (item.selected === nextSelected) return item
              changed = true
              return { ...item, selected: nextSelected }
            }
            return item
          })
          lastLocalToggleIdRef.current = id
          return changed ? next : prev
        }
      }
      lastLocalToggleIdRef.current = id
      return prev.map((item, index) => (index === targetIndex ? { ...item, selected: nextSelected } : item))
    })
  }

  function toggleHubItem(id: string, opts: ToggleOptions = {}) {
    const anchorId = opts.shiftKey ? lastHubToggleIdRef.current : null
    setHubItems((prev) => {
      const targetIndex = prev.findIndex((item) => item.id === id)
      if (targetIndex === -1) return prev
      const nextSelected = !prev[targetIndex].selected
      if (opts.shiftKey && anchorId) {
        const anchorIndex = prev.findIndex((item) => item.id === anchorId)
        if (anchorIndex !== -1 && anchorIndex !== targetIndex) {
          const start = Math.min(anchorIndex, targetIndex)
          const end = Math.max(anchorIndex, targetIndex)
          let changed = false
          const next = prev.map((item, index) => {
            if (index >= start && index <= end) {
              if (item.selected === nextSelected) return item
              changed = true
              return { ...item, selected: nextSelected }
            }
            return item
          })
          lastHubToggleIdRef.current = id
          return changed ? next : prev
        }
      }
      lastHubToggleIdRef.current = id
      return prev.map((item, index) => (index === targetIndex ? { ...item, selected: nextSelected } : item))
    })
  }

  function toggleExpand(id: string) {
    setExpandedHub((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleHubNode(id: string) {
    const node = HUB_DATA.nodeMap.get(id)
    if (!node) return
    setHubSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        collectDescendantIds(node).forEach((childId) => next.delete(childId))
        let parent = HUB_DATA.parentMap.get(id) ?? null
        while (parent) {
          next.delete(parent)
          parent = HUB_DATA.parentMap.get(parent) ?? null
        }
      }
      return next
    })
  }

  function renderHubNodes(nodes: HubNode[], depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const hasChildren = !!node.children?.length
      const expanded = expandedHub.has(node.id)
      const selected = hubSelected.has(node.id)
      const aggregate = HUB_DATA.aggregateMap.get(node.id) ?? { count: node.assetCount ?? 0, types: node.types ?? [] }
      const typeLabel = aggregate.types.length ? aggregate.types.join(' / ') : 'JPEG'
      return (
        <li key={node.id}>
          <div className="flex items-start gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
            {hasChildren ? (
              <button type="button" onClick={() => toggleExpand(node.id)} className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] text-xs font-medium">
                {expanded ? '-' : '+'}
              </button>
            ) : (
              <span className="inline-flex h-6 w-6 items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">-</span>
            )}
            <label className="flex flex-1 cursor-pointer items-start gap-2">
              <input type="checkbox" checked={selected} onChange={() => toggleHubNode(node.id)} className="mt-1 accent-[var(--text,#1F1E1B)]" />
              <span className="flex-1">
                <div className="text-sm font-medium text-[var(--text,#1F1E1B)]">{node.name}</div>
                <div className="text-xs text-[var(--text-muted,#6B645B)]">{aggregate.count} assets / {typeLabel}</div>
              </span>
            </label>
          </div>
          {hasChildren && expanded && (
            <ul className="ml-8">
              {renderHubNodes(node.children!, depth + 1)}
            </ul>
          )}
        </li>
      )
    })
  }

  const mutateTask = useCallback((taskId: string, updater: (task: UploadTaskState) => UploadTaskState) => {
    setUploadTasks((tasks) => tasks.map((task) => (task.id === taskId ? updater(task) : task)))
  }, [])

  const markBlockedAfter = useCallback((failedId: string) => {
    setUploadTasks((tasks) => {
      let seenFailed = false
      return tasks.map((task) => {
        if (task.id === failedId) {
          seenFailed = true
          return task
        }
        if (!seenFailed) return task
        if (task.status !== 'pending') return task
        return {
          ...task,
          status: 'blocked',
          error: task.error ?? BLOCKED_UPLOAD_MESSAGE,
        }
      })
    })
  }, [])

  function getStatusLabel(task: UploadTaskState): string {
    switch (task.status) {
      case 'pending': return 'Queued'
      case 'initializing': return 'Preparing'
      case 'uploading': return 'Uploading'
      case 'finalizing': return 'Finalizing'
      case 'success': return 'Completed'
      case 'error': return 'Error'
      case 'blocked': return 'Blocked'
      default: return 'Pending'
    }
  }

  function renderSummaryCard(wrapperClass: string, includeHubSelection: boolean, destination: string) {
    return (
      <aside className={`${wrapperClass} flex h-full min-h-0 flex-col gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-3 text-[11px] leading-tight`}>
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">Destination</div>
          <div className="mt-1 truncate text-sm font-medium text-[var(--text,#1F1E1B)]">{destination}</div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">Duplicates</div>
          <label className="mt-1 flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={ignoreDup} onChange={(e) => setIgnoreDup(e.target.checked)} className="h-4 w-4 accent-[var(--text,#1F1E1B)]" />
            Ignore duplicates
          </label>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">Selection</div>
          <div className="mt-1 text-sm font-medium text-[var(--text,#1F1E1B)]">{selectedItems.length ? `${selectedItems.length} asset${selectedItems.length === 1 ? '' : 's'} selected` : 'Nothing selected yet'}</div>
          <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
            {selectedTypes.length ? selectedTypes.join(' / ') : 'Waiting for selection'}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">{selectionSummaryText}</div>
          {includeHubSelection && hubSelectionList.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-muted,#6B645B)]">
              {hubSelectionList.slice(0, 4).map((name) => <li key={name} className="truncate">- {name}</li>)}
              {hubSelectionList.length > 4 && <li>- +{hubSelectionList.length - 4} more</li>}
            </ul>
          )}
        </div>
      </aside>
    )
  }

  function submit() {
    if (!canSubmit) {
      if (mode === 'local') openLocalPicker('files')
      return
    }
    if (!selectedItems.length) return
    const missingFiles = selectedItems.filter((item) => !item.file)
    if (missingFiles.length) {
      console.error('Upload aborted: missing File blobs for items', missingFiles.map((item) => item.id))
      setUploadError('Some selected items are missing file data. Please reselect the files and try again.')
      return
    }
    const tasks: UploadTaskState[] = selectedItems.map((item) => {
      const file = item.file as File
      const mimeType = file.type && file.type.trim() ? file.type : 'application/octet-stream'
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        size: file.size,
        file,
        source: item.source,
        mimeType,
        bytesUploaded: 0,
        progress: 0,
        status: 'pending',
        error: null,
        meta: item.meta,
      }
    })
    if (!tasks.length) return
    const fallbackTypes = selectedTypes.length ? selectedTypes : (['JPEG'] as ImgType[])
    uploadTypesRef.current = fallbackTypes
    uploadCompletionNotifiedRef.current = false
    uploadProcessingRef.current = false
    uploadTasksRef.current = tasks
    setUploadTasks(tasks)
    setUploadError(null)
    setUploadDestination(derivedDest)
    setUploadRunning(true)
    setMode('upload')
  }

  useEffect(() => {
    if (!isUploadMode || !uploadRunning) return
    if (uploadProcessingRef.current) return
    if (!projectId) {
      const message = 'Cannot start upload: missing project context.'
      console.error(message)
      setUploadError(`${message} Please reopen the project and try again.`)
      setUploadTasks((tasks) => tasks.map((task) => ({
        ...task,
        status: 'error',
        error: task.error ?? message,
      })))
      setUploadRunning(false)
      return
    }

    let canceled = false
    uploadProcessingRef.current = true

    const processTask = async (task: UploadTaskState) => {
      const taskId = task.id
      const file = task.file
      mutateTask(taskId, (prev) => ({
        ...prev,
        status: 'initializing',
        error: null,
        bytesUploaded: 0,
        progress: 0,
      }))

      try {
        const init = await initUpload(projectId, {
          filename: file.name,
          sizeBytes: file.size,
          mimeType: task.mimeType,
        })

        mutateTask(taskId, (prev) => ({
          ...prev,
          assetId: init.assetId,
          uploadToken: init.uploadToken,
        }))

        await putUpload(init.assetId, file, init.uploadToken, (event) => {
          const total = event.lengthComputable && event.total ? event.total : file.size
          const loaded = typeof event.loaded === 'number' ? event.loaded : 0
          mutateTask(taskId, (prev) => {
            const bytesUploaded = Math.min(total, loaded)
            const progress = total > 0 ? Math.min(1, bytesUploaded / total) : prev.progress
            return {
              ...prev,
              status: 'uploading',
              bytesUploaded,
              progress,
            }
          })
        })

        mutateTask(taskId, (prev) => ({
          ...prev,
          status: 'finalizing',
          bytesUploaded: file.size,
          progress: 1,
        }))

        await completeUpload(init.assetId, init.uploadToken, { ignoreDuplicates: ignoreDup })

        mutateTask(taskId, (prev) => ({
          ...prev,
          status: 'success',
          bytesUploaded: file.size,
          progress: 1,
          error: null,
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        console.error(`Upload failed for ${task.name}`, err)
        setUploadError(`${task.name}: ${message}. Please retry.`)
        mutateTask(taskId, (prev) => ({
          ...prev,
          status: 'error',
          error: message,
        }))
        markBlockedAfter(taskId)
        throw err
      }
    }

    const processQueue = async (): Promise<boolean> => {
      const pendingIds = uploadTasksRef.current
        .filter((task) => !['success', 'error', 'blocked'].includes(task.status))
        .map((task) => task.id)

      if (!pendingIds.length) {
        return false
      }

      let encounteredError = false
      let pointer = 0
      let active = 0

      await new Promise<void>((resolve) => {
        let finished = false
        const finish = () => {
          if (finished) return
          finished = true
          resolve()
        }

        const startNext = () => {
          if (finished) return
          if (canceled) {
            if (active === 0) finish()
            return
          }
          if (encounteredError) {
            if (active === 0) finish()
            return
          }

          while (active < MAX_CONCURRENT_UPLOADS && pointer < pendingIds.length) {
            const taskId = pendingIds[pointer++]
            const currentTask = uploadTasksRef.current.find((candidate) => candidate.id === taskId)
            if (!currentTask) continue
            if (currentTask.status === 'success' || currentTask.status === 'error' || currentTask.status === 'blocked') {
              continue
            }

            active += 1
            processTask(currentTask)
              .catch(() => {
                encounteredError = true
              })
              .finally(() => {
                active -= 1
                if (finished) return
                if (canceled) {
                  if (active === 0) finish()
                  return
                }
                if (encounteredError) {
                  if (active === 0) finish()
                  return
                }
                if (pointer >= pendingIds.length && active === 0) {
                  finish()
                  return
                }
                startNext()
              })
          }

          if (pointer >= pendingIds.length && active === 0) {
            finish()
          }
        }

        startNext()
      })

      return encounteredError
    }

    processQueue()
      .then((encounteredError) => {
        if (canceled) return
        setUploadRunning(false)
        if (encounteredError) return

        setUploadError(null)
        if (!uploadCompletionNotifiedRef.current) {
          uploadCompletionNotifiedRef.current = true
          const successTypes = Array.from(new Set(uploadTasksRef.current.map((task) => task.type))) as ImgType[]
          const fallbackTypes = successTypes.length
            ? successTypes
            : (uploadTypesRef.current.length ? uploadTypesRef.current : (['JPEG'] as ImgType[]))
          const count = uploadTasksRef.current.length
          if (count > 0) {
            onImport({ count, types: fallbackTypes, dest: uploadDestination })
          }
        }
      })
      .catch((err) => {
        if (!canceled) {
          console.error('Upload queue aborted', err)
        }
      })
      .finally(() => {
        uploadProcessingRef.current = false
      })

    return () => {
      canceled = true
    }
  }, [ignoreDup, isUploadMode, markBlockedAfter, mutateTask, onImport, projectId, uploadDestination, uploadRunning])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div
        id="import-sheet"
        tabIndex={-1}
        className={`${usesExpandedModal ? 'h-[min(92vh,820px)] w-[min(95vw,1240px)]' : 'w-[760px] max-h-[90vh]'} flex min-h-0 flex-col overflow-hidden rounded-md bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E1D3B9)] shadow-2xl outline-none`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleLocalDrop}
      >
        <div className="flex flex-shrink-0 items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full" style={{ backgroundColor: TOKENS.clay500 }} />
            <div className="text-sm font-semibold">Import photos</div>
          </div>
          <button onClick={onClose} className="px-2 py-1 text-sm rounded border border-[var(--border,#E1D3B9)]" aria-label="Close">Close</button>
        </div>
        <div className="relative flex-1 min-h-0 px-5 pb-5 pt-2 text-sm text-[var(--text,#1F1E1B)]">
          {isPreparingLocalSelection && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--surface,#FFFFFF)]/70 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm font-semibold text-[var(--text,#1F1E1B)] shadow-lg" role="status" aria-live="polite">
                <span className="inline-block h-5 w-5 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent" aria-hidden />
                Preparing files…
              </div>
            </div>
          )}
          {mode === 'choose' && (
            <div className="flex h-full flex-col justify-center gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <button type="button" onClick={() => setMode('local')} className="flex flex-col items-start gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 text-left transition hover:border-[var(--charcoal-800,#1F1E1B)]">
                  <div className="text-base font-semibold">Upload Photo</div>
                  <p className="text-xs text-[var(--text-muted,#6B645B)]">Open the native picker to choose individual images or entire folders from your computer.</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--charcoal-800,#1F1E1B)]">Choose files…</span>
                </button>
                <button type="button" onClick={() => setMode('hub')} className="flex flex-col items-start gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 text-left transition hover:border-[var(--charcoal-800,#1F1E1B)]">
                  <div className="text-base font-semibold">Upload from ImageHub</div>
                  <p className="text-xs text-[var(--text-muted,#6B645B)]">Browse the shared ImageHub library to pull complete project folders into this workspace.</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--charcoal-800,#1F1E1B)]">Open ImageHub</span>
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted,#6B645B)] text-center md:text-left">You can switch sources at any time before importing.</p>
            </div>
          )}

          {isLocalMode && (
            <div className="relative flex h-full min-h-0 gap-5 overflow-hidden">
              <div className="flex w-72 flex-shrink-0 flex-col gap-4 overflow-hidden">
                <div
                  className={`rounded-lg border border-dashed p-6 text-center transition ${isDragging ? 'border-[var(--charcoal-800,#1F1E1B)] bg-[var(--sand-100,#F3EBDD)]' : 'border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)]'}`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleLocalDrop}
                >
                  <div className="text-sm font-medium">Select photos or folders from your computer</div>
                  <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">We support JPEG and RAW formats. Picking a folder pulls in everything inside.</div>
                  <div className="mt-4 flex justify-center gap-3 text-sm">
                    <button type="button" onClick={() => openLocalPicker('files')} className="rounded-md bg-[var(--charcoal-800,#1F1E1B)] px-3 py-2 font-medium text-white">Choose files…</button>
                    <button type="button" onClick={() => openLocalPicker('folder')} className="rounded-md border border-[var(--border,#E1D3B9)] px-3 py-2">Choose folder…</button>
                  </div>
                  <div className="mt-3 text-xs text-[var(--text-muted,#6B645B)]">Or just drag & drop files and folders here.</div>
                  {localQueueProgress.active && (
                    <div role="status" aria-live="polite" className="mt-4 flex w-full max-w-[260px] flex-col items-center gap-2 rounded-md border border-[var(--border,#E1D3B9)] bg-white/90 px-3 py-2 text-center text-[11px] text-[var(--text,#1F1E1B)]">
                      <div className="flex items-center justify-center gap-2 font-medium">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent" aria-hidden />
                        Preparing files…
                      </div>
                      {localQueueDetails && (
                        <div className="text-[10px] text-[var(--text-muted,#6B645B)]">{localQueueDetails}</div>
                      )}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sand-100,#F3EBDD)]">
                        <div className="h-full rounded-full bg-[var(--charcoal-800,#1F1E1B)] transition-[width]" style={{ width: `${localQueuePercent}%` }} />
                      </div>
                    </div>
                  )}
                  {isDragging && (
                    <div className="mt-4 rounded-md border border-dashed border-[var(--charcoal-800,#1F1E1B)] bg-white/80 px-3 py-2 text-xs font-medium text-[var(--charcoal-800,#1F1E1B)]">
                      Drop to add {mode === 'local' ? 'to your selection' : 'and review before importing'}.
                    </div>
                  )}
                </div>
                {localItems.length > 0 && (
                  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                    <div className="flex items-center justify-between px-4 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Selected files & folders</div>
                      <div className="text-[11px] text-[var(--text-muted,#6B645B)]">{selectedLocalCount}/{totalLocalItems}</div>
                    </div>
                    <div className="mt-2 flex-1 overflow-y-auto px-4 pb-3">
                      <ul className="space-y-3 text-[11px] text-[var(--text-muted,#6B645B)]">
                        {localFolderGroups.map(({ folder, items, selected, total, bytes, selectedBytes }) => (
                          <li key={folder}>
                            <div className="flex items-center justify-between text-[var(--text,#1F1E1B)]">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{folder}</span>
                                <span className="text-[10px] text-[var(--text-muted,#6B645B)]">{formatBytes(selectedBytes)} of {formatBytes(bytes)}</span>
                              </div>
                              <span className="text-[10px] font-medium text-[var(--text-muted,#6B645B)]">{selected}/{total} pending</span>
                            </div>
                            <ul className="mt-1 space-y-1">
                              {items.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={(event) => toggleLocalItem(item.id, { shiftKey: event.shiftKey })}
                                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition ${item.selected ? 'bg-[var(--sand-50,#FBF7EF)] text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)] hover:bg-[var(--sand-50,#FBF7EF)]/60'}`}
                                  >
                                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-[var(--border,#E1D3B9)] text-[10px]">
                                      {item.selected ? '✓' : ''}
                                    </span>
                                    <span className="flex-1 truncate">
                                      <span className="block truncate text-[11px] leading-snug">{item.name}</span>
                                      <span className="block text-[9px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Pending • {formatBytes(item.size)}</span>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Ready to import</div>
                  <div className="text-xs text-[var(--text-muted,#6B645B)]">{selectedLocalCount} selected / {totalLocalItems} total</div>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                  {localQueueProgress.active
                    ? (localQueueDetails ? `Preparing ${localQueueDetails}` : `Preparing ${totalLocalItems} file${totalLocalItems === 1 ? '' : 's'}…`)
                    : localSelectedItems.length
                      ? `${localSelectedItems.length} item${localSelectedItems.length === 1 ? '' : 's'} across ${Math.max(1, localSelectedFolderCount)} folder${Math.max(1, localSelectedFolderCount) === 1 ? '' : 's'} • ${formatBytes(totalSelectedBytes)} pending`
                      : totalLocalItems
                        ? `Ready to import ${totalLocalItems} file${totalLocalItems === 1 ? '' : 's'}`
                        : localPriming
                          ? 'Collecting files…'
                          : 'No items selected yet. Check thumbnails to include them.'}
                </div>
                <div className="mt-3 flex-1 min-h-0">
                  {localQueueProgress.active && (
                    <div
                      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-[11px] text-[var(--text,#1F1E1B)]"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent" aria-hidden />
                        Preparing files…
                      </span>
                      <span className="text-[var(--text-muted,#6B645B)]">{localQueueDetails || `Preparing ${totalLocalItems} file${totalLocalItems === 1 ? '' : 's'}…`}</span>
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    {localItems.length ? (
                      <PendingMiniGrid items={localItems} onToggle={toggleLocalItem} className="h-full" />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] text-xs text-[var(--text-muted,#6B645B)]">
                        <div className="flex flex-col items-center gap-2 py-6">
                          {(localPriming || localQueueProgress.active) ? (
                            <>
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent" aria-hidden />
                              <span>{localQueueDetails || 'Preparing file list…'}</span>
                            </>
                          ) : (
                            <span>No items selected yet. Check thumbnails to include them.</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex-shrink-0 text-xs">
                  <button type="button" onClick={clearLocalSelection} className="text-[var(--river-500,#6B7C7A)] underline">Clear selection</button>
                </div>
              </div>
              {renderSummaryCard('w-56 flex-shrink-0', false, effectiveDest)}
            </div>
          )}

          {isHubMode && (
            <div className="flex h-full min-h-0 gap-5 overflow-hidden">
              <div className="flex w-64 flex-shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                <div className="px-4 py-3 text-sm font-semibold">ImageHub projects</div>
                <div className="flex-1 overflow-y-auto px-3 pb-4">
                  <ul className="space-y-1">
                    {renderHubNodes(IMAGE_HUB_TREE)}
                  </ul>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Ready to import</div>
                    <div className="text-xs text-[var(--text-muted,#6B645B)]">{hubSelectedItems.length} selected / {hubItems.length} total</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                    {hubSelectedItems.length
                      ? `${hubSelectedItems.length} asset${hubSelectedItems.length === 1 ? '' : 's'} across ${Math.max(1, hubSelectedFolderCount)} folder${Math.max(1, hubSelectedFolderCount) === 1 ? '' : 's'} • ${formatBytes(totalSelectedBytes)} pending`
                      : 'No assets selected yet. Check thumbnails to include them.'}
                  </div>
                  <div className="mt-3 flex-1 min-h-0">
                    <PendingMiniGrid items={hubItems} onToggle={toggleHubItem} className="h-full" />
                  </div>
                </div>
              </div>
              {renderSummaryCard('w-56 flex-shrink-0', true, effectiveDest)}
            </div>
          )}

          {isUploadMode && (
            <div className="flex h-full min-h-0 gap-5 overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                <div className="border-b border-[var(--border,#E1D3B9)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text,#1F1E1B)]">Uploading {uploadCompletedCount}/{uploadTasks.length} assets</div>
                      <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                        {formatBytes(uploadUploadedBytes)} of {formatBytes(uploadTotalBytes)} • {uploadOverallPercent}%
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-muted,#6B645B)]">{uploadRunning ? 'In progress…' : 'Queue stopped'}</span>
                  </div>
                  {uploadError && (
                    <div className="mt-3 rounded border border-[#F7C9C9] bg-[#FDF2F2] px-3 py-2 text-xs text-[#B42318]">
                      {uploadError} You can close this sheet and retry once the issue is resolved.
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                  {uploadTasks.length ? (
                    <ul className="space-y-3">
                      {uploadTasks.map((task) => {
                        const progressPercent = Math.max(0, Math.min(100, Math.round(task.progress * 100)))
                        const statusLabel = getStatusLabel(task)
                        const barColor = task.status === 'error'
                          ? 'bg-[#B42318]'
                          : task.status === 'blocked'
                            ? 'bg-[var(--sand-300,#E1D3B9)]'
                            : 'bg-[var(--charcoal-800,#1F1E1B)]'
                        return (
                          <li key={task.id} className="rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 items-center justify-center rounded bg-[var(--sand-50,#FBF7EF)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                                    {task.type}
                                  </span>
                                  <span className="truncate text-sm font-medium text-[var(--text,#1F1E1B)]">{task.name}</span>
                                </div>
                                <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                                  {formatBytes(task.bytesUploaded)} / {formatBytes(task.size)} • {statusLabel}
                                </div>
                                {task.error && (
                                  <div className="mt-1 text-xs text-[#B42318]">{task.error}</div>
                                )}
                              </div>
                              <span className="text-xs text-[var(--text-muted,#6B645B)]">{progressPercent}%</span>
                            </div>
                            <div className="mt-3 h-2 rounded bg-[var(--sand-100,#F3EBDD)]">
                              <div className={`h-2 rounded ${barColor}`} style={{ width: `${progressPercent}%` }} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted,#6B645B)]">
                      No uploads queued.
                    </div>
                  )}
                </div>
              </div>
              {renderSummaryCard('w-56 flex-shrink-0', uploadIncludesHub, uploadDestination)}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--border,#E1D3B9)] px-5 py-4 text-sm">
          {(isLocalMode || isHubMode) && (
            <button onClick={() => setMode('choose')} className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]">Back</button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]">
            {isUploadMode ? 'Close' : 'Cancel'}
          </button>
          {(isLocalMode || isHubMode) && (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className={`px-3 py-1.5 rounded text-white ${canSubmit ? 'bg-[var(--basalt-700,#4A463F)]' : 'bg-[var(--sand-300,#E1D3B9)] cursor-not-allowed'}`}
            >
              Start upload
            </button>
          )}
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple onChange={handleLocalFilesChange} className="hidden" accept="image/*" />
      <input ref={folderInputRef} type="file" multiple onChange={handleLocalFilesChange} className="hidden" accept="image/*" />
    </div>
  )
}
