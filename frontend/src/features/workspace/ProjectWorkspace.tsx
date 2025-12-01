import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { TOKENS } from './utils'
import {
  listProjectAssets,
  assetThumbUrl,
  assetPreviewUrl,
  updateAssetInteractions,
  getAsset,
  linkAssetsToProject,
  listAssetProjects,
  loadMetadataFromProject,
  type AssetListItem,
  type AssetDetail,
  type AssetProjectUsage,
  type LoadMetadataFromProjectResponse,
  previewQuickFix,
  saveQuickFixAdjustments,
} from '../../shared/api/assets'
import {
  getProject,
  updateProject,
  type ProjectApiResponse,
  type ProjectUpdatePayload,
} from '../../shared/api/projects'
import { initUpload, putUpload, completeUpload } from '../../shared/api/uploads'
import { placeholderRatioForAspect, RATIO_DIMENSIONS } from '../../shared/placeholder'
import type {
  Photo,
  ImgType,
  ColorTag,
  CropSettings,
  CropAspectRatioId,
  CropRect,
  CropOrientation,
} from './types'
import type { PendingItem } from './importTypes'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { InspectorPanel, type InspectorTab } from './components/InspectorPanel'
import { GridView, DetailView } from './components/Views'
import { MobileBottomBar, MobilePhotosModeToggle } from './components/MobileComponents'
import { EmptyState, NoResults, StarRow } from './components/Common'
import { computeCols } from './utils'
import {
  type DateTreeYearNode,
  type DateTreeMonthNode,
  type DateTreeDayNode,
  type GridSelectOptions,
  CURRENT_CONFIG_SOURCE_ID,
  type MetadataSourceId,
  type InspectorViewportRect,
  type InspectorPreviewPanCommand,
  type MobileWorkspacePanel,
} from './types'
import {
  clampCropRect,
  fitRectToAspect,
  resolveAspectRatioValue,
  createDefaultCropSettings,
  clamp,
  applyOrientationToRatio,
  inferAspectRatioSelection,
} from './cropUtils'
import {
  QuickFixState,
  createDefaultQuickFixState,
  cloneQuickFixState,
  quickFixStateFromApi,
  quickFixStateToPayload,
  hasQuickFixAdjustments,
  areQuickFixStatesEqual,
  resetQuickFixGroup,
  type QuickFixGroupKey,
} from './quickFixState'

const COLOR_SHORTCUT_MAP = {
  '6': 'Red',
  '7': 'Yellow',
  '8': 'Green',
  '9': 'Blue',
  '0': 'Purple',
} satisfies Record<string, ColorTag>
type ColorShortcutKey = keyof typeof COLOR_SHORTCUT_MAP

const isColorShortcutKey = (key: string): key is ColorShortcutKey => key in COLOR_SHORTCUT_MAP

const isTextInputTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true
  return target.isContentEditable
}
import ImageHubImportPane from './ImageHubImportPane'
import ErrorBoundary from '../../components/ErrorBoundary'
import { fetchImageHubAssetStatus, type ImageHubAssetStatus } from '../../shared/api/hub'
import { getImageHubSettings } from '../../shared/api/settings'
import ExportDialog from './ExportDialog'
import DialogHeader from '../../components/DialogHeader'
import GeneralSettingsDialog from '../../components/modals/GeneralSettingsDialog'
import { useGeneralSettings } from '../../shared/settings/general'
import { useExperimentalStorageSettings } from '../../shared/settings/experimentalImageStorage'
import type { GeneralSettings } from '../../shared/settings/general'
import { withBase } from '../../shared/api/base'
import UserMenu from '../auth/UserMenu'

const LEFT_MIN_WIDTH = 300
const LEFT_MAX_WIDTH = 560
const LEFT_DEFAULT_WIDTH = 360
const LEFT_COLLAPSED_WIDTH = 56
const RIGHT_MIN_WIDTH = 300
const RIGHT_MAX_WIDTH = 560
const RIGHT_DEFAULT_WIDTH = 360
const RIGHT_COLLAPSED_WIDTH = 56
const HANDLE_WIDTH = 12
const RESIZE_STEP = 16
const DETAIL_MIN_ZOOM = 1
const DETAIL_MAX_ZOOM = 4
const DETAIL_ZOOM_FACTOR = 1.2
const MOBILE_BREAKPOINT = 768

function clampDetailZoom(value: number): number {
  if (!Number.isFinite(value)) return DETAIL_MIN_ZOOM
  return Math.min(DETAIL_MAX_ZOOM, Math.max(DETAIL_MIN_ZOOM, value))
}
const IGNORED_METADATA_WARNINGS = new Set([
  'EXIFTOOL_ERROR',
  'EXIFTOOL_NOT_INSTALLED',
  'EXIFTOOL_JSON_ERROR',
  'ExifPill-Load failed',
  'EXIF_PIL_LOAD_FAILED',
])
const DATE_KEY_DELIM = '__'
const UNKNOWN_VALUE = 'unknown'
const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long' })

function localizedMonthLabel(monthValue: string) {
  if (monthValue === UNKNOWN_VALUE) return 'Unknown month'
  const monthNumber = Number(monthValue)
  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) return 'Unknown month'
  return MONTH_FORMATTER.format(new Date(Date.UTC(2000, monthNumber - 1, 1)))
}

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
  const daySort =
    dayValue === UNKNOWN_VALUE ? Number.NEGATIVE_INFINITY : (parsed ?? new Date(0)).getTime()

  const yearLabel = yearValue === UNKNOWN_VALUE ? 'Unknown date' : yearValue
  const monthLabel = localizedMonthLabel(monthValue)
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

function detectAspect(
  width?: number | null,
  height?: number | null
): 'portrait' | 'landscape' | 'square' {
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

  const isPreview =
    typeof item.is_preview === 'boolean' ? item.is_preview : (existing?.isPreview ?? false)
  const ratingValue = typeof item.rating === 'number' ? item.rating : (existing?.rating ?? 0)
  const rating = Math.max(0, Math.min(5, ratingValue)) as Photo['rating']
  const picked = typeof item.picked === 'boolean' ? item.picked : (existing?.picked ?? false)
  const rejected =
    typeof item.rejected === 'boolean' ? item.rejected : (existing?.rejected ?? false)
  const colorFromApi = item.color_label ?? existing?.tag ?? 'None'
  const colorLabel = (['None', 'Red', 'Green', 'Blue', 'Yellow', 'Purple'] as ColorTag[]).includes(
    colorFromApi as ColorTag
  )
    ? (colorFromApi as ColorTag)
    : (existing?.tag ?? 'None')
  const stackPrimaryAssetId =
    item.stack_primary_asset_id ?? existing?.stackPrimaryAssetId ?? item.id
  const pairId = item.pair_id ?? existing?.pairId ?? null
  const pairedAssetId = item.paired_asset_id ?? existing?.pairedAssetId ?? null
  const pairedAssetType = item.paired_asset_type ?? existing?.pairedAssetType ?? null
  const basename = item.basename ?? existing?.basename ?? null
  const metadataSourceProjectId =
    item.metadata_source_project_id ?? existing?.metadataSourceProjectId ?? null

  return {
    id: item.id,
    name,
    type,
    date,
    capturedAt,
    uploadedAt,
    rating,
    picked,
    rejected,
    tag: colorLabel,
    thumbSrc,
    previewSrc,
    placeholderRatio,
    isPreview,
    previewOrder:
      typeof item.preview_order === 'number'
        ? item.preview_order
        : (existing?.previewOrder ?? null),
    metadataWarnings: Array.isArray(item.metadata_warnings)
      ? item.metadata_warnings
      : (existing?.metadataWarnings ?? []),
    status: item.status,
    basename,
    pairId,
    pairedAssetId,
    pairedAssetType,
    stackPrimaryAssetId,
    metadataSourceProjectId,
  }
}

function mergePhotosFromItems(current: Photo[], items: AssetListItem[]): Photo[] {
  if (!items.length) return current
  const nextMap = new Map<string, Photo>()
  items.forEach((item) => {
    const existing = current.find((photo) => photo.id === item.id)
    nextMap.set(item.id, mapAssetToPhoto(item, existing))
  })
  return current.map((photo) => nextMap.get(photo.id) ?? photo)
}

type InteractionPatch = {
  rating?: Photo['rating']
  tag?: ColorTag
  picked?: boolean
  rejected?: boolean
}

function patchPhotoInteractions(photo: Photo, patch: InteractionPatch): Photo {
  let next = photo
  if (patch.rating !== undefined && patch.rating !== photo.rating) {
    next = next === photo ? { ...next, rating: patch.rating } : { ...next, rating: patch.rating }
  }
  if (patch.tag && patch.tag !== photo.tag) {
    next = next === photo ? { ...next, tag: patch.tag } : { ...next, tag: patch.tag }
  }
  if (patch.picked !== undefined && patch.picked !== photo.picked) {
    next =
      next === photo
        ? { ...next, picked: patch.picked, rejected: patch.picked ? false : next.rejected }
        : { ...next, picked: patch.picked, rejected: patch.picked ? false : next.rejected }
  }
  if (patch.rejected !== undefined && patch.rejected !== photo.rejected) {
    next =
      next === photo
        ? { ...next, rejected: patch.rejected, picked: patch.rejected ? false : next.picked }
        : { ...next, rejected: patch.rejected, picked: patch.rejected ? false : next.picked }
  }
  return next
}

export default function ProjectWorkspace() {
  const { id } = useParams()
  const projectId = id ?? undefined
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
  const [stackPairsEnabled, setStackPairsEnabled] = useState(
    projectDetail?.stack_pairs_enabled ?? false
  )
  useEffect(() => {
    if (typeof projectDetail?.stack_pairs_enabled === 'boolean') {
      setStackPairsEnabled(projectDetail.stack_pairs_enabled)
    }
  }, [projectDetail?.stack_pairs_enabled])
  const applyProjectUpdate = useCallback(
    (updated: ProjectApiResponse) => {
      if (!id) return
      setStackPairsEnabled(updated.stack_pairs_enabled ?? false)
      queryClient.setQueryData(['project', id], updated)
      queryClient.setQueryData<ProjectApiResponse[] | undefined>(['projects'], (prev) => {
        if (!prev) return prev
        return prev.map((proj) =>
          proj.id === updated.id
            ? {
              ...proj,
              title: updated.title,
              updated_at: updated.updated_at,
              stack_pairs_enabled: updated.stack_pairs_enabled,
              client: updated.client,
              note: updated.note,
              tags: updated.tags ?? proj.tags,
              asset_count: updated.asset_count ?? proj.asset_count,
            }
            : proj
        )
      })
    },
    [id, queryClient]
  )

  const renameMutation = useMutation({
    mutationFn: ({ title }: { title: string }) => {
      if (!id) throw new Error('Project id missing')
      return updateProject(id, { title })
    },
    onSuccess: (updated) => {
      applyProjectUpdate(updated)
    },
  })
  const stackToggleMutation = useMutation({
    mutationFn: (nextEnabled: boolean) => {
      if (!id) throw new Error('Project id missing')
      return updateProject(id, { stack_pairs_enabled: nextEnabled })
    },
    onSuccess: (updated) => {
      applyProjectUpdate(updated)
    },
  })
  const projectInfoMutation = useMutation({
    mutationFn: (patch: ProjectUpdatePayload) => {
      if (!id) throw new Error('Project id missing')
      return updateProject(id, patch)
    },
    onSuccess: (updated) => {
      applyProjectUpdate(updated)
    },
  })
  const renameErrorValue = (renameMutation as { error?: unknown }).error
  const renameErrorMessage = renameMutation.isError
    ? renameErrorValue instanceof Error
      ? renameErrorValue.message
      : typeof renameErrorValue === 'string'
        ? renameErrorValue
        : 'Unable to rename project'
    : null
  const projectInfoErrorValue = (projectInfoMutation as { error?: unknown }).error
  const projectInfoErrorMessage = projectInfoMutation.isError
    ? projectInfoErrorValue instanceof Error
      ? projectInfoErrorValue.message
      : typeof projectInfoErrorValue === 'string'
        ? projectInfoErrorValue
        : 'Unable to update project details'
    : null
  const [searchParams, setSearchParams] = useSearchParams()

  const [photos, setPhotos] = useState<Photo[]>([])
  const prevPhotosRef = useRef<Photo[]>([])
  const currentIndexRef = useRef(0)
  const currentPhotoIdRef = useRef<string | null>(null)
  const [view, setViewState] = useState<'grid' | 'detail'>('detail')
  const userChangedViewRef = useRef(false)
  const setView = useCallback((next: 'grid' | 'detail') => {
    userChangedViewRef.current = true
    setViewState(next)
  }, [])
  const [current, setCurrent] = useState(0)
  const [detailZoom, setDetailZoom] = useState(1)
  const [detailViewportRect, setDetailViewportRect] = useState<InspectorViewportRect | null>(null)
  const [cropSettingsByPhoto, setCropSettingsByPhoto] = useState<Record<string, CropSettings>>({})
  const [quickFixStateByPhoto, setQuickFixStateByPhoto] = useState<Record<string, QuickFixState>>({})
  const quickFixPersistedRef = useRef<Record<string, QuickFixState>>({})
  const [quickFixPreview, setQuickFixPreview] = useState<{ assetId: string; url: string } | null>(null)
  const quickFixPreviewRef = useRef<{ assetId: string; url: string } | null>(null)
  const quickFixPreviewControllerRef = useRef<AbortController | null>(null)
  const quickFixPreviewTimeoutRef = useRef<number | null>(null)
  const quickFixPreviewSeqRef = useRef(0)
  const [quickFixPreviewBusy, setQuickFixPreviewBusy] = useState(false)
  const quickFixSaveTimeoutRef = useRef<number | null>(null)
  const quickFixSaveSeqRef = useRef(0)
  const [quickFixSaving, setQuickFixSaving] = useState(false)
  const [quickFixError, setQuickFixError] = useState<string | null>(null)
  const quickFixServerHashRef = useRef<{ assetId: string | null; hash: string | null }>({
    assetId: null,
    hash: null,
  })
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('details')
  const handleInspectorTabChange = useCallback((tab: InspectorTab) => {
    setActiveInspectorTab(tab)
  }, [])
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobileWorkspacePanel>('photos')
  const mobileViewInitializedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateLayout = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isPortrait = height >= width
      setIsMobileLayout(width < MOBILE_BREAKPOINT && isPortrait)
    }
    updateLayout()
    window.addEventListener('resize', updateLayout)
    window.addEventListener('orientationchange', updateLayout)
    return () => {
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('orientationchange', updateLayout)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (quickFixPreviewTimeoutRef.current !== null) {
        window.clearTimeout(quickFixPreviewTimeoutRef.current)
        quickFixPreviewTimeoutRef.current = null
      }
      if (quickFixSaveTimeoutRef.current !== null) {
        window.clearTimeout(quickFixSaveTimeoutRef.current)
        quickFixSaveTimeoutRef.current = null
      }
      if (quickFixPreviewControllerRef.current) {
        quickFixPreviewControllerRef.current.abort()
        quickFixPreviewControllerRef.current = null
      }
      if (quickFixPreviewRef.current) {
        URL.revokeObjectURL(quickFixPreviewRef.current.url)
        quickFixPreviewRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const previous = quickFixPreviewRef.current
    if (previous && previous !== quickFixPreview) {
      URL.revokeObjectURL(previous.url)
    }
    quickFixPreviewRef.current = quickFixPreview
  }, [quickFixPreview])

  useEffect(() => {
    if (!isMobileLayout) {
      mobileViewInitializedRef.current = false
      return
    }
    if (mobileViewInitializedRef.current) return
    mobileViewInitializedRef.current = true
    if (!userChangedViewRef.current && view !== 'grid') {
      setViewState('grid')
    }
  }, [isMobileLayout, view])
  const [detailViewportResetKey, setDetailViewportResetKey] = useState(0)
  const [previewPanRequest, setPreviewPanRequest] = useState<InspectorPreviewPanCommand | null>(
    null
  )
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set<string>())
  const lastSelectedPhotoIdRef = useRef<string | null>(null)
  const selectionAnchorRef = useRef<string | null>(null)
  const suppressSelectionSyncRef = useRef(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const { settings: generalSettings, setSettings: setGeneralSettings } = useGeneralSettings()
  const experimentalUiEnabled = import.meta.env.DEV
  const { data: experimentalStorageSettings } = useExperimentalStorageSettings({
    enabled: experimentalUiEnabled,
  })
  const experimentalStorageWarning =
    experimentalUiEnabled &&
    experimentalStorageSettings?.enabled &&
    experimentalStorageSettings.warning_active
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false)
  const openGeneralSettings = useCallback(() => setGeneralSettingsOpen(true), [])
  const closeGeneralSettings = useCallback(() => setGeneralSettingsOpen(false), [])
  const handleGeneralSettingsSave = useCallback(
    (nextSettings: GeneralSettings) => {
      setGeneralSettings(nextSettings)
    },
    [setGeneralSettings]
  )
  const resolveActionTargetIds = useCallback(
    (primaryId: string | null) => {
      if (primaryId && selectedPhotoIds.has(primaryId)) {
        return new Set(selectedPhotoIds)
      }
      return primaryId ? new Set([primaryId]) : new Set<string>()
    },
    [selectedPhotoIds]
  )
  const importInFlightRef = useRef(false)
  const handleRename = useCallback(
    async (nextTitle: string) => {
      if (!id) return
      const trimmed = nextTitle.trim() || 'Untitled project'
      if (trimmed === projectName.trim()) return
      await renameMutation.mutateAsync({ title: trimmed })
    },
    [id, projectName, renameMutation]
  )
  const handleStackToggle = useCallback(
    (next: boolean) => {
      const previous = stackPairsEnabled
      setStackPairsEnabled(next)
      stackToggleMutation.mutate(next, {
        onError: () => {
          setStackPairsEnabled(previous)
        },
      })
    },
    [stackPairsEnabled, stackToggleMutation]
  )
  const handleProjectInfoChange = useCallback(
    async (patch: ProjectUpdatePayload) => {
      if (!id) return
      await projectInfoMutation.mutateAsync(patch)
    },
    [id, projectInfoMutation]
  )

  const refreshAssets = useCallback(
    async (focusNewest: boolean = false) => {
      if (!id) return
      try {
        const items = await listProjectAssets(id)
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
        console.error(err)
      }
    },
    [id]
  )

  const interactionMutation = useMutation({
    mutationFn: async ({
      assetIds,
      changes,
    }: {
      assetIds: string[]
      changes: InteractionPatch
    }) => {
      if (!id) {
        throw new Error('Missing project identifier')
      }
      return updateAssetInteractions(id, {
        assetIds,
        rating: changes.rating,
        colorLabel: changes.tag,
        picked: changes.picked,
        rejected: changes.rejected,
      })
    },
    onSuccess: (response) => {
      setPhotos((prev) => mergePhotosFromItems(prev, response.items))
      prevPhotosRef.current = mergePhotosFromItems(prevPhotosRef.current, response.items)
    },
    onError: (error) => {
      console.error('Failed to update interactions', error)
      refreshAssets()
    },
  })

  const metadataSyncMutation: UseMutationResult<
    LoadMetadataFromProjectResponse,
    Error,
    { assetId: string; sourceProjectId: string },
    unknown
  > = useMutation<
    LoadMetadataFromProjectResponse,
    Error,
    { assetId: string; sourceProjectId: string },
    unknown
  >({
    mutationFn: async ({ assetId, sourceProjectId }) => {
      if (!projectId) {
        throw new Error('Missing project identifier')
      }
      return loadMetadataFromProject({ assetId, sourceProjectId, targetProjectId: projectId })
    },
    onSuccess: (response, variables) => {
      if (response?.asset) {
        setPhotos((prev) => mergePhotosFromItems(prev, [response.asset]))
        prevPhotosRef.current = mergePhotosFromItems(prevPhotosRef.current, [response.asset])
      } else {
        refreshAssets()
      }
      queryClient.invalidateQueries({ queryKey: ['asset-detail', variables.assetId, projectId] })
      queryClient.invalidateQueries({ queryKey: ['asset-projects', variables.assetId] })
    },
    onError: (error) => {
      console.error('Failed to adopt metadata from source project', error)
    },
  })

  const pairLookup = useMemo(() => {
    const map = new Map<string, string>()
    photos.forEach((photo) => {
      if (photo.pairedAssetId) {
        map.set(photo.id, photo.pairedAssetId)
      }
    })
    return map
  }, [photos])
  const [showJPEG, setShowJPEG] = useState(true)
  const [showRAW, setShowRAW] = useState(true)
  const [minStars, setMinStars] = useState<0 | 1 | 2 | 3 | 4 | 5>(0)
  const [onlyPicked, setOnlyPicked] = useState(false)
  const [hideRejected, setHideRejected] = useState(true)
  const [filterColor, setFilterColor] = useState<'Any' | ColorTag>('Any')

  const applyInteraction = useCallback(
    (targetIds: Set<string>, patch: InteractionPatch) => {
      if (!targetIds.size) return
      const expanded = new Set<string>()
      targetIds.forEach((assetId) => {
        expanded.add(assetId)
        const partner = pairLookup.get(assetId)
        if (partner) {
          expanded.add(partner)
        }
      })
      setPhotos((arr) =>
        arr.map((photo) => (expanded.has(photo.id) ? patchPhotoInteractions(photo, patch) : photo))
      )
      interactionMutation.mutate({ assetIds: Array.from(expanded), changes: patch })
    },
    [pairLookup, interactionMutation]
  )

  const storageScope = useMemo(() => (id ? `workspace:${id}` : 'workspace'), [id])
  const leftWidthKey = `${storageScope}:left-width`
  const leftCollapsedKey = `${storageScope}:left-collapsed`
  const rightWidthKey = `${storageScope}:right-width`
  const rightCollapsedKey = `${storageScope}:right-collapsed`
  const [leftPanelWidth, setLeftPanelWidth] = useState(LEFT_DEFAULT_WIDTH)
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_DEFAULT_WIDTH)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedWidth = window.localStorage.getItem(leftWidthKey)
    if (storedWidth) {
      const parsed = Number(storedWidth)
      if (Number.isFinite(parsed)) {
        setLeftPanelWidth(clampNumber(parsed, LEFT_MIN_WIDTH, LEFT_MAX_WIDTH))
      }
    }
    const storedCollapsed = window.localStorage.getItem(leftCollapsedKey)
    if (storedCollapsed !== null) {
      setLeftPanelCollapsed(storedCollapsed === '1')
    }
  }, [leftWidthKey, leftCollapsedKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedWidth = window.localStorage.getItem(rightWidthKey)
    if (storedWidth) {
      const parsed = Number(storedWidth)
      if (Number.isFinite(parsed)) {
        setRightPanelWidth(clampNumber(parsed, RIGHT_MIN_WIDTH, RIGHT_MAX_WIDTH))
      }
    }
    const storedCollapsed = window.localStorage.getItem(rightCollapsedKey)
    if (storedCollapsed !== null) {
      setRightPanelCollapsed(storedCollapsed === '1')
    }
  }, [rightWidthKey, rightCollapsedKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(leftWidthKey, String(leftPanelWidth))
  }, [leftPanelWidth, leftWidthKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(rightWidthKey, String(rightPanelWidth))
  }, [rightPanelWidth, rightWidthKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(leftCollapsedKey, leftPanelCollapsed ? '1' : '0')
  }, [leftCollapsedKey, leftPanelCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(rightCollapsedKey, rightPanelCollapsed ? '1' : '0')
  }, [rightCollapsedKey, rightPanelCollapsed])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return
      if (event.key === '[') {
        event.preventDefault()
        setLeftPanelCollapsed(true)
      } else if (event.key === ']') {
        event.preventDefault()
        setLeftPanelCollapsed(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    prevPhotosRef.current = photos
  }, [photos])

  const contentRef = useRef<HTMLDivElement | null>(null)
  const [contentNode, setContentNode] = useState<HTMLDivElement | null>(null)
  const [contentW, setContentW] = useState(1200)
  const paginatorRef = useRef<HTMLDivElement | null>(null)
  const setContentRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    setContentNode(node)
  }, [])
  useEffect(() => {
    if (!contentNode) return
    const ro = new ResizeObserver((entries) => {
      if (!entries.length) return
      setContentW(entries[0].contentRect.width)
    })
    ro.observe(contentNode)
    return () => ro.disconnect()
  }, [contentNode])

  const GAP = 12
  const minThumbForSix = Math.max(96, Math.floor((contentW - (6 - 1) * GAP) / 6))
  const [gridSize, setGridSizeState] = useState(Math.max(140, minThumbForSix))
  useEffect(() => setGridSizeState((s) => Math.max(s, minThumbForSix)), [minThumbForSix])
  const setGridSize = (n: number) => setGridSizeState(Math.max(n, minThumbForSix))
  const mobileGridSize = Math.max(140, Math.floor(Math.max(contentW - GAP, 0) / 2) || 140)
  const gridSizeForView = isMobileLayout ? mobileGridSize : gridSize
  const effectiveLeftWidth = leftPanelCollapsed ? LEFT_COLLAPSED_WIDTH : leftPanelWidth
  const effectiveRightWidth = rightPanelCollapsed ? RIGHT_COLLAPSED_WIDTH : rightPanelWidth

  const handleLeftHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      const pointerId = event.pointerId
      const target = event.currentTarget
      const startX = event.clientX
      const startWidth = leftPanelWidth
      if (leftPanelCollapsed) {
        setLeftPanelCollapsed(false)
      }
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        setLeftPanelWidth(clampNumber(startWidth + delta, LEFT_MIN_WIDTH, LEFT_MAX_WIDTH))
      }
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        target.releasePointerCapture?.(pointerId)
      }
      target.setPointerCapture?.(pointerId)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [leftPanelCollapsed, leftPanelWidth]
  )

  const handleRightHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()
      if (rightPanelCollapsed) return
      const pointerId = event.pointerId
      const target = event.currentTarget
      const startX = event.clientX
      const startWidth = rightPanelWidth
      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        setRightPanelWidth(clampNumber(startWidth - delta, RIGHT_MIN_WIDTH, RIGHT_MAX_WIDTH))
      }
      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        target.releasePointerCapture?.(pointerId)
      }
      target.setPointerCapture?.(pointerId)
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [rightPanelCollapsed, rightPanelWidth]
  )

  const handleLeftHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowLeft') {
        if (leftPanelCollapsed) return
        event.preventDefault()
        setLeftPanelWidth((prev) => clampNumber(prev - RESIZE_STEP, LEFT_MIN_WIDTH, LEFT_MAX_WIDTH))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setLeftPanelCollapsed(false)
        setLeftPanelWidth((prev) => clampNumber(prev + RESIZE_STEP, LEFT_MIN_WIDTH, LEFT_MAX_WIDTH))
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setLeftPanelCollapsed((prev) => !prev)
      }
    },
    [leftPanelCollapsed]
  )

  const handleRightHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowLeft') {
        if (rightPanelCollapsed) return
        event.preventDefault()
        setRightPanelWidth((prev) =>
          clampNumber(prev - RESIZE_STEP, RIGHT_MIN_WIDTH, RIGHT_MAX_WIDTH)
        )
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (rightPanelCollapsed) {
          setRightPanelCollapsed(false)
          return
        }
        setRightPanelWidth((prev) =>
          clampNumber(prev + RESIZE_STEP, RIGHT_MIN_WIDTH, RIGHT_MAX_WIDTH)
        )
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setRightPanelCollapsed((prev) => !prev)
      }
    },
    [rightPanelCollapsed]
  )

  const [folderMode, setFolderMode] = useState<'date' | 'custom'>('date')
  const [customFolder, setCustomFolder] = useState('My Folder')

  const {
    years: dateTree,
    dayNodeMap,
    photoKeyMap,
  } = useMemo(() => buildDateTree(photos), [photos])

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

  const selectedDayKey =
    maybeSelectedKey && dayNodeMap.has(maybeSelectedKey) ? maybeSelectedKey : null
  const selectedDayNode = selectedDayKey ? dayNodeMap.get(selectedDayKey)! : null

  const handleDaySelect = useCallback(
    (day: DateTreeDayNode) => {
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
    },
    [searchParams, selectedDayKey, setSearchParams]
  )

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

  const displayPhotos: Photo[] = useMemo(() => {
    if (!stackPairsEnabled) return photos
    return photos.reduce<Photo[]>((acc, photo) => {
      if (photo.pairId && photo.type === 'JPEG' && photo.pairedAssetId) {
        return acc
      }
      if (photo.pairId && photo.pairedAssetId) {
        acc.push({ ...photo, displayType: 'JPEG + RAW', isStacked: true })
        return acc
      }
      acc.push({ ...photo, displayType: photo.displayType ?? photo.type, isStacked: false })
      return acc
    }, [])
  }, [photos, stackPairsEnabled])

  const visible: Photo[] = useMemo(
    () =>
      displayPhotos.filter((p) => {
        const dateMatch = !selectedDayKey || photoKeyMap.get(p.id) === selectedDayKey
        const typeOk =
          stackPairsEnabled && p.pairId && p.pairedAssetId
            ? showJPEG || showRAW
            : (p.type === 'JPEG' && showJPEG) || (p.type === 'RAW' && showRAW)
        const ratingOk = p.rating >= minStars
        const pickOk = !onlyPicked || p.picked
        const rejectOk = !hideRejected || !p.rejected
        const colorOk = filterColor === 'Any' || p.tag === filterColor
        return dateMatch && typeOk && ratingOk && pickOk && rejectOk && colorOk
      }),
    [
      displayPhotos,
      selectedDayKey,
      photoKeyMap,
      showJPEG,
      showRAW,
      minStars,
      onlyPicked,
      hideRejected,
      filterColor,
      stackPairsEnabled,
    ]
  )

  const selectedPhotos = useMemo(() => {
    if (!selectedPhotoIds.size) return []
    return visible.filter((photo) => selectedPhotoIds.has(photo.id))
  }, [visible, selectedPhotoIds])

  const photoById = useMemo(() => {
    const map = new Map<string, Photo>()
    photos.forEach((photo) => map.set(photo.id, photo))
    return map
  }, [photos])

  const shortcutPrimaryId = useCallback(() => {
    const firstSelected = selectedPhotoIds.values().next().value as string | undefined
    if (firstSelected) return firstSelected
    const fallback = visible[current]
    return fallback ? fallback.id : null
  }, [selectedPhotoIds, visible, current])

  const runWithShortcutTargets = useCallback(
    (callback: (targets: Set<string>) => void) => {
      const primaryId = shortcutPrimaryId()
      if (!primaryId) return
      const targets = resolveActionTargetIds(primaryId)
      if (!targets.size) return
      callback(targets)
    },
    [shortcutPrimaryId, resolveActionTargetIds]
  )

  const togglePickSelection = useCallback(() => {
    runWithShortcutTargets((targets) => {
      targets.forEach((id) => {
        const photo = photoById.get(id)
        if (!photo) return
        applyInteraction(new Set([id]), { picked: !photo.picked })
      })
    })
  }, [runWithShortcutTargets, photoById, applyInteraction])

  const toggleRejectSelection = useCallback(() => {
    runWithShortcutTargets((targets) => {
      targets.forEach((id) => {
        const photo = photoById.get(id)
        if (!photo) return
        applyInteraction(new Set([id]), { rejected: !photo.rejected })
      })
    })
  }, [runWithShortcutTargets, photoById, applyInteraction])

  const applyRatingShortcut = useCallback(
    (rating: 1 | 2 | 3 | 4 | 5) => {
      runWithShortcutTargets((targets) => {
        applyInteraction(targets, { rating })
      })
    },
    [runWithShortcutTargets, applyInteraction]
  )

  const applyColorShortcut = useCallback(
    (tag: ColorTag) => {
      runWithShortcutTargets((targets) => {
        applyInteraction(targets, { tag })
      })
    },
    [runWithShortcutTargets, applyInteraction]
  )

  useEffect(() => {
    if (exportDialogOpen && selectedPhotos.length === 0) {
      setExportDialogOpen(false)
    }
  }, [exportDialogOpen, selectedPhotos.length])

  useEffect(() => {
    currentIndexRef.current = current
    currentPhotoIdRef.current = visible[current]?.id ?? null
  }, [visible, current])

  useEffect(() => {
    const targetId = currentPhotoIdRef.current
    if (!targetId) return
    const idx = visible.findIndex((photo) => photo.id === targetId)
    if (idx >= 0 && idx !== current) {
      setCurrent(idx)
    }
  }, [visible, current])

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

  const applyChanges = useCallback(() => {
    // Placeholder for future non-destructive edit syncing.
  }, [])

  useEffect(() => {
    if (current >= visible.length) setCurrent(Math.max(0, visible.length - 1))
  }, [visible, current])

  const visibleCount = visible.length

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if ((event.metaKey || event.ctrlKey) && normalizedKey === 's') {
        event.preventDefault()
        applyChanges()
        return
      }
      if (isTextInputTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (normalizedKey === 'g') {
        setView('grid')
        return
      }
      if (normalizedKey === 'd') {
        setView('detail')
        return
      }
      if (normalizedKey === 'p') {
        paginatorRef.current?.focus({ preventScroll: true })
        togglePickSelection()
        return
      }
      if (normalizedKey === 'x') {
        toggleRejectSelection()
        return
      }
      if (/^[1-5]$/.test(event.key)) {
        applyRatingShortcut(Number(event.key) as 1 | 2 | 3 | 4 | 5)
        return
      }
      if (isColorShortcutKey(event.key)) {
        applyColorShortcut(COLOR_SHORTCUT_MAP[event.key])
        return
      }
      if (event.key === 'ArrowRight') {
        setCurrent((index) => Math.min(index + 1, visibleCount - 1))
        return
      }
      if (event.key === 'ArrowLeft') {
        setCurrent((index) => Math.max(index - 1, 0))
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        setCurrent(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        setCurrent(Math.max(0, visibleCount - 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    applyChanges,
    setView,
    togglePickSelection,
    toggleRejectSelection,
    applyRatingShortcut,
    applyColorShortcut,
    setCurrent,
    visibleCount,
  ])

  // Custom events vom Grid
  useEffect(() => {
    const onRate = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      const rating = e.detail.r as 1 | 2 | 3 | 4 | 5
      applyInteraction(targets, { rating })
    }
    const onPick = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      targets.forEach((id) => {
        const photo = photos.find((x) => x.id === id)
        if (photo) {
          applyInteraction(new Set([id]), { picked: !photo.picked })
        }
      })
    }
    const onReject = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      targets.forEach((id) => {
        const photo = photos.find((x) => x.id === id)
        if (photo) {
          applyInteraction(new Set([id]), { rejected: !photo.rejected })
        }
      })
    }
    const onColor = (e: any) => {
      const targets = resolveActionTargetIds(e.detail.id as string | null)
      if (!targets.size) return
      const color = e.detail.t as ColorTag
      applyInteraction(targets, { tag: color })
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
  }, [photos, resolveActionTargetIds, applyInteraction])

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
  const [uploadInfo, setUploadInfo] = useState<string | null>(null)
  const uploadInfoTimeoutRef = useRef<number | null>(null)

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

  useEffect(
    () => () => {
      if (uploadBannerTimeoutRef.current !== null) {
        window.clearTimeout(uploadBannerTimeoutRef.current)
      }
    },
    []
  )

  const dismissUploadInfo = useCallback(() => {
    if (uploadInfoTimeoutRef.current !== null) {
      window.clearTimeout(uploadInfoTimeoutRef.current)
      uploadInfoTimeoutRef.current = null
    }
    setUploadInfo(null)
  }, [])

  const showUploadInfo = useCallback((message: string) => {
    setUploadInfo(message)
    if (uploadInfoTimeoutRef.current !== null) {
      window.clearTimeout(uploadInfoTimeoutRef.current)
    }
    uploadInfoTimeoutRef.current = window.setTimeout(() => {
      setUploadInfo(null)
      uploadInfoTimeoutRef.current = null
    }, 6000)
  }, [])

  useEffect(
    () => () => {
      if (uploadInfoTimeoutRef.current !== null) {
        window.clearTimeout(uploadInfoTimeoutRef.current)
      }
    },
    []
  )
  const handleImport = useCallback(
    async (_args: { count: number; types: ImgType[]; dest: string }) => {
      if (importInFlightRef.current) return
      importInFlightRef.current = true
      try {
        await refreshAssets(true)
        setImportOpen(false)
      } finally {
        importInFlightRef.current = false
      }
    },
    [refreshAssets]
  )

  // Back to projects
  function goBack() {
    navigate('/')
  }

  const baseCurrentPhoto = visible[current] ?? null
  const currentAssetId = baseCurrentPhoto?.id ?? null
  const detailItems: Photo[] = useMemo(() => {
    if (!quickFixPreview) return visible
    return visible.map((photo) =>
      quickFixPreview.assetId === photo.id ? { ...photo, previewSrc: quickFixPreview.url } : photo
    )
  }, [quickFixPreview, visible])
  const currentPhoto = detailItems[current] ?? baseCurrentPhoto ?? null
  useEffect(() => {
    if (activeMobilePanel === 'details' && !currentPhoto) {
      setActiveMobilePanel('photos')
    }
  }, [activeMobilePanel, currentPhoto])
  useEffect(() => {
    if (!currentPhoto?.id) return
    setCropSettingsByPhoto((prev) => {
      if (prev[currentPhoto.id]) return prev
      return { ...prev, [currentPhoto.id]: createDefaultCropSettings() }
    })
  }, [currentPhoto?.id])
  useEffect(() => {
    if (!currentPhoto?.id) return
    setQuickFixStateByPhoto((prev) => {
      if (prev[currentPhoto.id]) return prev
      return { ...prev, [currentPhoto.id]: createDefaultQuickFixState() }
    })
  }, [currentPhoto?.id])
  useEffect(() => {
    if (!quickFixPreview) return
    if (quickFixPreview.assetId === currentAssetId) return
    setQuickFixPreview(null)
  }, [currentAssetId, quickFixPreview])
  useEffect(() => {
    if (quickFixPreviewControllerRef.current) {
      quickFixPreviewControllerRef.current.abort()
      quickFixPreviewControllerRef.current = null
    }
    quickFixPreviewSeqRef.current += 1
    setQuickFixPreviewBusy(false)
    setQuickFixError(null)
  }, [currentAssetId])

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
            (prev.size ? (prev.values().next().value ?? null) : null)
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
    [visible, current]
  )
  useEffect(() => {
    setDetailZoom(1)
    setDetailViewportResetKey((key) => key + 1)
    setPreviewPanRequest(null)
    if (!currentAssetId) {
      setDetailViewportRect(null)
    }
  }, [currentAssetId])
  const handleDetailZoomIn = useCallback(() => {
    setDetailZoom((prev) => clampDetailZoom(prev * DETAIL_ZOOM_FACTOR))
  }, [])
  const handleDetailZoomOut = useCallback(() => {
    setDetailZoom((prev) => clampDetailZoom(prev / DETAIL_ZOOM_FACTOR))
  }, [])
  const handleDetailZoomReset = useCallback(() => {
    setDetailZoom(1)
    setDetailViewportResetKey((key) => key + 1)
  }, [])
  const handlePreviewPan = useCallback((position: { x: number; y: number }) => {
    setDetailViewportRect((prev) => (prev ? { ...prev, x: position.x, y: position.y } : prev))
    setPreviewPanRequest({ ...position, token: Date.now() })
  }, [])
  const requestQuickFixPreview = useCallback(
    (assetId: string, state: QuickFixState) => {
      if (!assetId) return
      if (!hasQuickFixAdjustments(state)) {
        setQuickFixPreview((prev) => (prev?.assetId === assetId ? null : prev))
        setQuickFixPreviewBusy(false)
        if (quickFixPreviewControllerRef.current) {
          quickFixPreviewControllerRef.current.abort()
          quickFixPreviewControllerRef.current = null
        }
        setQuickFixError(null)
        return
      }
      const payload = quickFixStateToPayload(state)
      if (!payload) {
        setQuickFixPreview((prev) => (prev?.assetId === assetId ? null : prev))
        setQuickFixPreviewBusy(false)
        return
      }
      if (quickFixPreviewControllerRef.current) {
        quickFixPreviewControllerRef.current.abort()
      }
      const controller = new AbortController()
      quickFixPreviewControllerRef.current = controller
      const seq = ++quickFixPreviewSeqRef.current
      setQuickFixPreviewBusy(true)
      previewQuickFix(assetId, payload, { signal: controller.signal })
        .then((blob) => {
          if (quickFixPreviewSeqRef.current !== seq) return
          const url = URL.createObjectURL(blob)
          setQuickFixPreview({ assetId, url })
          setQuickFixPreviewBusy(false)
          setQuickFixError(null)
        })
        .catch((error) => {
          if (controller.signal.aborted) return
          console.error('Failed to render Quick Fix preview', error)
          if (quickFixPreviewSeqRef.current === seq) {
            setQuickFixPreviewBusy(false)
          }
          setQuickFixError('Preview update failed. Please try again.')
        })
    },
    []
  )
  const scheduleQuickFixPreview = useCallback(
    (assetId: string, state: QuickFixState) => {
      if (!assetId) return
      if (quickFixPreviewTimeoutRef.current !== null) {
        window.clearTimeout(quickFixPreviewTimeoutRef.current)
      }
      quickFixPreviewTimeoutRef.current = window.setTimeout(() => {
        quickFixPreviewTimeoutRef.current = null
        requestQuickFixPreview(assetId, state)
      }, 150)
    },
    [requestQuickFixPreview]
  )
  const requestQuickFixSave = useCallback(
    async (assetId: string, state: QuickFixState) => {
      if (!projectId) return
      const payload = quickFixStateToPayload(state) ?? {}
      const seq = ++quickFixSaveSeqRef.current
      setQuickFixSaving(true)
      try {
        const updated = await saveQuickFixAdjustments(projectId, assetId, payload)
        if (quickFixSaveSeqRef.current !== seq) return
        quickFixPersistedRef.current[assetId] = cloneQuickFixState(state)
        queryClient.setQueryData(['asset-detail', assetId, projectId], updated)
        setQuickFixSaving(false)
        setQuickFixError(null)
      } catch (error) {
        if (quickFixSaveSeqRef.current === seq) {
          setQuickFixSaving(false)
        }
        console.error('Failed to save Quick Fix adjustments', error)
        setQuickFixError('Saving adjustments failed. Please check your connection and try again.')
      }
    },
    [projectId, queryClient]
  )
  const scheduleQuickFixSave = useCallback(
    (assetId: string, state: QuickFixState) => {
      if (!projectId) return
      const persisted = quickFixPersistedRef.current[assetId]
      if (areQuickFixStatesEqual(state, persisted)) return
      if (quickFixSaveTimeoutRef.current !== null) {
        window.clearTimeout(quickFixSaveTimeoutRef.current)
      }
      quickFixSaveTimeoutRef.current = window.setTimeout(() => {
        quickFixSaveTimeoutRef.current = null
        requestQuickFixSave(assetId, state)
      }, 800)
    },
    [projectId, requestQuickFixSave]
  )
  const {
    data: currentAssetDetail,
    isFetching: assetDetailFetching,
    error: assetDetailError,
  } = useQuery<AssetDetail>({
    queryKey: ['asset-detail', currentAssetId, projectId],
    queryFn: () => getAsset(currentAssetId as string, { projectId }),
    enabled: Boolean(currentAssetId && projectId),
    staleTime: 1000 * 60 * 5,
  })
  const {
    data: assetProjects,
    isFetching: assetProjectsLoading,
    error: assetProjectsError,
  } = useQuery<AssetProjectUsage[]>({
    queryKey: ['asset-projects', currentAssetId],
    queryFn: () => listAssetProjects(currentAssetId as string),
    enabled: Boolean(currentAssetId),
    staleTime: 1000 * 60 * 5,
  })
  const metadataSyncPending = metadataSyncMutation.isPending
  const handleMetadataSourceChange = useCallback(
    (nextId: MetadataSourceId) => {
      if (!currentAssetId) return
      if (nextId === CURRENT_CONFIG_SOURCE_ID) {
        return
      }
      metadataSyncMutation.mutate({ assetId: currentAssetId, sourceProjectId: nextId })
    },
    [currentAssetId, metadataSyncMutation]
  )
  const metadataEntries = useMemo(() => {
    if (!currentAssetDetail?.metadata) return []
    return Object.entries(currentAssetDetail.metadata)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        normalizedKey: normalizeMetadataKey(key),
        label: formatMetadataKeyLabel(key),
        value,
      }))
  }, [currentAssetDetail?.metadata])
  const metadataWarnings = useMemo(() => {
    const warnings = currentAssetDetail?.metadata_warnings ?? currentPhoto?.metadataWarnings ?? []
    return warnings.filter((warning) => !IGNORED_METADATA_WARNINGS.has(warning))
  }, [currentAssetDetail?.metadata_warnings, currentPhoto?.metadataWarnings])
  const generalInspectorFields = useMemo(() => {
    if (!currentPhoto) return []
    const sizeLabel =
      assetDetailFetching && !currentAssetDetail
        ? 'Loading…'
        : currentAssetDetail
          ? formatBytes(currentAssetDetail.size_bytes)
          : '—'
    return [
      {
        label: 'File Name',
        value: currentAssetDetail?.original_filename ?? currentPhoto.name ?? '—',
      },
      { label: 'File Type', value: currentPhoto.displayType ?? currentPhoto.type },
      {
        label: 'Dimensions',
        value: formatDimensions(currentAssetDetail?.width, currentAssetDetail?.height),
      },
      {
        label: 'Capture Date',
        value: formatCaptureDateLabel(
          currentAssetDetail?.metadata,
          currentAssetDetail?.taken_at ?? currentPhoto.capturedAt ?? null
        ),
      },
      {
        label: 'Import Date',
        value: formatImportDateLabel(currentPhoto.uploadedAt ?? currentPhoto.date),
      },
      { label: 'File Size', value: sizeLabel },
      { label: 'Storage Origin', value: formatStorageOriginLabel(currentAssetDetail?.storage_uri) },
    ]
  }, [assetDetailFetching, currentAssetDetail, currentPhoto])
  const captureInspectorFields = useMemo(() => {
    if (!currentPhoto) return []
    const metadata = currentAssetDetail?.metadata ?? null
    return [
      { label: 'Camera', value: formatCameraModel(metadata) },
      { label: 'Lens', value: formatLensModel(metadata) },
      { label: 'Aperture', value: formatApertureValue(metadata) },
      { label: 'Shutter', value: formatShutterValue(metadata) },
      { label: 'ISO', value: formatIsoValue(metadata) },
      { label: 'Focal Length', value: formatFocalLengthValue(metadata) },
    ]
  }, [currentPhoto, currentAssetDetail?.metadata])
  const metadataSummary = useMemo(() => {
    if (!currentPhoto) return null
    const edits = currentAssetDetail?.metadata_state?.edits
    const hasEdits = Boolean(edits && typeof edits === 'object' && Object.keys(edits).length)
    return {
      rating: currentPhoto.rating,
      colorLabel: currentPhoto.tag,
      pickRejectLabel: currentPhoto.picked ? 'Picked' : currentPhoto.rejected ? 'Rejected' : '—',
      picked: currentPhoto.picked,
      rejected: currentPhoto.rejected,
      hasEdits,
    }
  }, [currentPhoto, currentAssetDetail?.metadata_state?.edits])
  const currentAssetDimensions = useMemo(() => {
    if (currentAssetDetail?.width && currentAssetDetail?.height) {
      return { width: currentAssetDetail.width, height: currentAssetDetail.height }
    }
    if (currentPhoto) {
      const ratioSpec = RATIO_DIMENSIONS[currentPhoto.placeholderRatio]
      if (ratioSpec) {
        return { width: ratioSpec.width, height: ratioSpec.height }
      }
    }
    return null
  }, [currentAssetDetail?.width, currentAssetDetail?.height, currentPhoto?.placeholderRatio])
  const currentDetailAspectRatio = useMemo(() => {
    const width = currentAssetDimensions?.width
    const height = currentAssetDimensions?.height
    if (Number.isFinite(width) && Number.isFinite(height) && width && height) {
      const ratio = width / height
      if (ratio > 0) return ratio
    }
    return 1
  }, [currentAssetDimensions?.width, currentAssetDimensions?.height])
  useEffect(() => {
    if (!currentAssetId) return
    const serverPayload = currentAssetDetail?.metadata_state?.edits?.quick_fix ?? null
    const hash = JSON.stringify(serverPayload ?? null)
    const previous = quickFixServerHashRef.current
    if (previous.assetId === currentAssetId && previous.hash === hash) return
    quickFixServerHashRef.current = { assetId: currentAssetId, hash }
    const serverState = quickFixStateFromApi(serverPayload) ?? createDefaultQuickFixState()
    quickFixPersistedRef.current[currentAssetId] = cloneQuickFixState(serverState)
    setQuickFixStateByPhoto((prev) => ({ ...prev, [currentAssetId]: serverState }))
    setCropSettingsByPhoto((prev) => {
      const existing = prev[currentAssetId] ?? createDefaultCropSettings()
      const ratioInfo = inferAspectRatioSelection(serverState.crop.aspectRatio, currentDetailAspectRatio)
      const nextValue = {
        ...existing,
        angle: serverState.crop.rotation,
        aspectRatioId: ratioInfo.id,
        orientation: ratioInfo.orientation,
      }
      return { ...prev, [currentAssetId]: nextValue }
    })
    if (hasQuickFixAdjustments(serverState)) {
      requestQuickFixPreview(currentAssetId, serverState)
    } else {
      setQuickFixPreview((prev) => (prev?.assetId === currentAssetId ? null : prev))
    }
    setQuickFixError(null)
  }, [currentAssetDetail?.metadata_state?.edits?.quick_fix, currentAssetId, currentDetailAspectRatio, requestQuickFixPreview])
  const currentCropSettings = currentPhoto?.id ? cropSettingsByPhoto[currentPhoto.id] ?? null : null
  const currentQuickFixState = currentAssetId ? quickFixStateByPhoto[currentAssetId] ?? null : null
  const cropModeActive = activeInspectorTab === 'quick-fix'
  const applyQuickFixChange = useCallback(
    (updater: (prev: QuickFixState) => QuickFixState) => {
      if (!currentAssetId) return
      setQuickFixStateByPhoto((prev) => {
        const prevState = prev[currentAssetId] ?? createDefaultQuickFixState()
        const nextState = updater(prevState)
        if (areQuickFixStatesEqual(prevState, nextState)) return prev
        scheduleQuickFixPreview(currentAssetId, nextState)
        scheduleQuickFixSave(currentAssetId, nextState)
        return { ...prev, [currentAssetId]: nextState }
      })
    },
    [currentAssetId, scheduleQuickFixPreview, scheduleQuickFixSave]
  )
  const updateCropSettings = useCallback(
    (updater: (prev: CropSettings) => CropSettings) => {
      const photoId = currentPhoto?.id
      if (!photoId) return
      setCropSettingsByPhoto((prev) => {
        const prevValue = prev[photoId] ?? createDefaultCropSettings()
        const nextValue = updater(prevValue)
        if (nextValue === prevValue) return prev
        return { ...prev, [photoId]: nextValue }
      })
    },
    [currentPhoto?.id]
  )
  const handleCropRectChange = useCallback(
    (nextRect: CropRect) => {
      updateCropSettings((prev) => ({
        ...prev,
        rect: clampCropRect(nextRect),
      }))
    },
    [updateCropSettings]
  )
  const handleCropAngleChange = useCallback(
    (nextAngle: number) => {
      const clampedAngle = clamp(nextAngle, -45, 45)
      updateCropSettings((prev) => ({
        ...prev,
        angle: clampedAngle,
      }))
      applyQuickFixChange((prev) => ({
        ...prev,
        crop: { ...prev.crop, rotation: clampedAngle },
      }))
    },
    [applyQuickFixChange, updateCropSettings]
  )
  const handleCropReset = useCallback(() => {
    updateCropSettings(() => createDefaultCropSettings())
    applyQuickFixChange((prev) => ({
      ...prev,
      crop: { rotation: 0, aspectRatio: null },
    }))
  }, [applyQuickFixChange, updateCropSettings])
  const handleCropAspectRatioChange = useCallback(
    (ratioId: CropAspectRatioId) => {
      updateCropSettings((prev) => {
        if (prev.aspectRatioId === ratioId) return prev
        const ratioValue = resolveAspectRatioValue(ratioId, currentDetailAspectRatio)
        const orientedRatio = applyOrientationToRatio(ratioValue, prev.orientation)
        applyQuickFixChange((state) => ({
          ...state,
          crop: { ...state.crop, aspectRatio: orientedRatio },
        }))
        const ratioBase = currentDetailAspectRatio || 1
        const nextRect = orientedRatio
          ? fitRectToAspect(prev.rect, orientedRatio, undefined, ratioBase)
          : clampCropRect(prev.rect)
        return {
          ...prev,
          rect: nextRect,
          aspectRatioId: ratioId,
        }
      })
    },
    [applyQuickFixChange, currentDetailAspectRatio, updateCropSettings]
  )
  const handleCropOrientationChange = useCallback(
    (orientation: CropOrientation) => {
      updateCropSettings((prev) => {
        if (prev.orientation === orientation) return prev
        const ratioValue = resolveAspectRatioValue(prev.aspectRatioId, currentDetailAspectRatio)
        const orientedRatio = applyOrientationToRatio(ratioValue, orientation)
        applyQuickFixChange((state) => ({
          ...state,
          crop: { ...state.crop, aspectRatio: orientedRatio },
        }))
        const ratioBase = currentDetailAspectRatio || 1
        const rect = orientedRatio
          ? fitRectToAspect(prev.rect, orientedRatio, undefined, ratioBase)
          : rotateRectDimensions(prev.rect)
        return {
          ...prev,
          rect,
          orientation,
        }
      })
    },
    [applyQuickFixChange, currentDetailAspectRatio, updateCropSettings]
  )
  const handleQuickFixGroupReset = useCallback(
    (group: QuickFixGroupKey) => {
      if (!currentAssetId) return
      let shouldResetCrop = false
      setQuickFixStateByPhoto((prev) => {
        const prevState = prev[currentAssetId] ?? createDefaultQuickFixState()
        const nextState = resetQuickFixGroup(prevState, group)
        if (areQuickFixStatesEqual(prevState, nextState)) return prev
        if (group === 'crop') {
          shouldResetCrop = true
        }
        scheduleQuickFixPreview(currentAssetId, nextState)
        scheduleQuickFixSave(currentAssetId, nextState)
        return { ...prev, [currentAssetId]: nextState }
      })
      if (group === 'crop' && shouldResetCrop) {
        setCropSettingsByPhoto((prev) => ({
          ...prev,
          [currentAssetId]: createDefaultCropSettings(),
        }))
      }
    },
    [currentAssetId, scheduleQuickFixPreview, scheduleQuickFixSave]
  )
  const handleQuickFixGlobalReset = useCallback(() => {
    if (!currentAssetId) return
    const defaults = createDefaultQuickFixState()
    setQuickFixStateByPhoto((prev) => {
      const prevState = prev[currentAssetId] ?? defaults
      if (areQuickFixStatesEqual(prevState, defaults)) return prev
      scheduleQuickFixPreview(currentAssetId, defaults)
      scheduleQuickFixSave(currentAssetId, defaults)
      return { ...prev, [currentAssetId]: defaults }
    })
    setCropSettingsByPhoto((prev) => ({
      ...prev,
      [currentAssetId]: createDefaultCropSettings(),
    }))
  }, [currentAssetId, scheduleQuickFixPreview, scheduleQuickFixSave])
  const quickFixControls = useMemo(
    () => ({
      cropSettings: currentCropSettings,
      onAspectRatioChange: handleCropAspectRatioChange,
      onAngleChange: handleCropAngleChange,
      onOrientationChange: handleCropOrientationChange,
      onReset: handleCropReset,
      quickFixState: currentQuickFixState,
      onQuickFixChange: applyQuickFixChange,
      onQuickFixGroupReset: handleQuickFixGroupReset,
      onQuickFixGlobalReset: handleQuickFixGlobalReset,
      previewBusy: quickFixPreviewBusy,
      saving: quickFixSaving,
      errorMessage: quickFixError,
    }),
    [
      applyQuickFixChange,
      currentCropSettings,
      currentQuickFixState,
      handleCropAngleChange,
      handleCropAspectRatioChange,
      handleCropOrientationChange,
      handleCropReset,
      handleQuickFixGlobalReset,
      handleQuickFixGroupReset,
      quickFixError,
      quickFixPreviewBusy,
      quickFixSaving,
    ]
  )
  const inspectorPreviewAsset = useMemo(() => {
    if (!currentPhoto) return null
    const detailPreviewUrl = withBase(currentAssetDetail?.preview_url ?? null)
    const detailThumbUrl = withBase(currentAssetDetail?.thumb_url ?? null)
    const quickFixPreviewSrc =
      quickFixPreview && quickFixPreview.assetId === currentAssetId ? quickFixPreview.url : null
    const primarySrc =
      quickFixPreviewSrc ??
      detailPreviewUrl ??
      currentPhoto.previewSrc ??
      currentPhoto.thumbSrc ??
      detailThumbUrl
    const fallback = quickFixPreviewSrc ?? currentPhoto.thumbSrc ?? detailThumbUrl ?? null
    return {
      src: primarySrc,
      thumbSrc: fallback,
      alt: currentPhoto.name || 'Selected photo preview',
      placeholderRatio: currentPhoto.placeholderRatio,
    }
  }, [
    currentPhoto?.id,
    currentPhoto?.previewSrc,
    currentPhoto?.thumbSrc,
    currentPhoto?.name,
    currentPhoto?.placeholderRatio,
    currentAssetDetail?.preview_url,
    currentAssetDetail?.thumb_url,
    currentAssetId,
    quickFixPreview,
  ])
  const metadataSourceProjectId =
    currentPhoto?.metadataSourceProjectId ??
    currentAssetDetail?.metadata_state?.source_project_id ??
    null
  const metadataSourceId: MetadataSourceId = metadataSourceProjectId ?? CURRENT_CONFIG_SOURCE_ID
  const projectOverview = useMemo(() => {
    if (!projectDetail) return null
    return {
      title: projectName,
      description: projectDetail.note ?? '',
      client: projectDetail.client ?? '',
      tags: Array.isArray(projectDetail.tags) ? projectDetail.tags : [],
      assetCount:
        typeof projectDetail.asset_count === 'number' ? projectDetail.asset_count : photos.length,
      createdAt: projectDetail.created_at ?? null,
    }
  }, [projectDetail, projectName, photos.length])
  const usedProjects = useMemo(() => {
    const source = assetProjects ?? currentAssetDetail?.projects ?? []
    if (!Array.isArray(source)) return []
    const formatLabel = (label?: string | null, timestamp?: string | null) => {
      if (label?.trim()) return label
      if (!timestamp) return 'Last updated —'
      const parsed = new Date(timestamp)
      if (Number.isNaN(parsed.getTime())) return 'Last updated —'
      return `Last updated ${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return source
      .map((proj) => {
        const lastModified = proj.last_modified ?? null
        return {
          id: proj.project_id,
          name: proj.name,
          previewImageUrl: proj.preview_image_url ?? proj.cover_thumb ?? null,
          lastUpdatedLabel: formatLabel(proj.last_updated_label, lastModified),
          isCurrentProject: Boolean(projectId && proj.project_id === projectId),
          __sortValue: lastModified ? new Date(lastModified).getTime() : 0,
        }
      })
      .sort((a, b) => {
        if (a.isCurrentProject !== b.isCurrentProject) return a.isCurrentProject ? -1 : 1
        return b.__sortValue - a.__sortValue
      })
      .map(({ __sortValue, ...project }) => project)
  }, [assetProjects, currentAssetDetail?.projects, projectId])
  const usedProjectsErrorMessage = useMemo(() => {
    if (!assetProjectsError) return null
    if (assetProjectsError instanceof Error) return assetProjectsError.message
    if (typeof assetProjectsError === 'string') return assetProjectsError
    return 'Unable to load project usage'
  }, [assetProjectsError])
  const metadataSyncError = (metadataSyncMutation as { error?: unknown }).error
  const metadataSourceActionError = useMemo(() => {
    if (!metadataSyncError) return null
    if (metadataSyncError instanceof Error) return metadataSyncError.message
    if (typeof metadataSyncError === 'string') return metadataSyncError
    return 'Unable to replace metadata'
  }, [metadataSyncError])
  const metadataLoading = Boolean(currentAssetId) && assetDetailFetching
  const metadataErrorMessage = useMemo(() => {
    if (!assetDetailError) return null
    if (assetDetailError instanceof Error) return assetDetailError.message
    if (typeof assetDetailError === 'string') return assetDetailError
    return 'Unable to load metadata'
  }, [assetDetailError])

  const hasAny = photos.length > 0
  const photosWorkspaceContent = !hasAny ? (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <EmptyState />
    </div>
  ) : visible.length === 0 ? (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <NoResults onReset={resetFilters} />
    </div>
  ) : view === 'grid' ? (
    <div className="h-full overflow-auto">
      <GridView
        items={visible}
        size={gridSizeForView}
        gap={GAP}
        containerWidth={contentW}
        columns={isMobileLayout ? 2 : undefined}
        onOpen={(idx) => {
          setCurrent(idx)
          setView('detail')
        }}
        onSelect={handlePhotoSelect}
        selectedIds={selectedPhotoIds}
      />
    </div>
  ) : (
    <DetailView
      items={detailItems}
      index={current}
      setIndex={setCurrent}
      className="h-full"
      selectedIds={selectedPhotoIds}
      onSelect={handlePhotoSelect}
      paginatorRef={paginatorRef}
      zoom={detailZoom}
      minZoom={DETAIL_MIN_ZOOM}
      maxZoom={DETAIL_MAX_ZOOM}
      zoomStep={DETAIL_ZOOM_FACTOR}
      onViewportChange={setDetailViewportRect}
      viewportResetKey={detailViewportResetKey}
      assetDimensions={currentAssetDimensions}
      onZoomChange={setDetailZoom}
      previewPanRequest={previewPanRequest}
      showFilmstrip={!isMobileLayout}
      enableSwipeNavigation={isMobileLayout}
      cropSettings={currentCropSettings}
      onCropRectChange={handleCropRectChange}
      cropModeActive={cropModeActive && Boolean(currentPhoto)}
    />
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
      <TopBar
        projectName={projectName}
        onBack={goBack}
        onRename={handleRename}
        renamePending={renameMutation.isPending}
        renameError={renameErrorMessage}
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
        stackPairsEnabled={stackPairsEnabled}
        onToggleStackPairs={handleStackToggle}
        stackTogglePending={stackToggleMutation.isPending}
        selectedCount={selectedPhotoIds.size}
        onOpenExport={() => setExportDialogOpen(true)}
        onOpenSettings={openGeneralSettings}
        layout={isMobileLayout ? 'mobile' : 'desktop'}
        accountControl={<UserMenu variant={isMobileLayout ? 'compact' : 'full'} />}
      />
      {experimentalStorageWarning ? (
        <div className="mx-4 mt-3 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          Experimental storage configuration: one or more paths are not available. Some images may
          be missing until all configured drives are available.
        </div>
      ) : null}
      {uploadBanner && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`pointer-events-auto w-72 rounded-lg border px-4 py-3 shadow-lg ${uploadBanner.status === 'error'
                ? 'border-[#F7C9C9] bg-[#FDF2F2]'
                : 'border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]'
              }`}
          >
            {uploadBanner.status === 'running' && (
              <>
                <div className="flex items-center justify-between text-sm font-semibold text-[var(--text,#1F1E1B)]">
                  Uploading assets
                  <span className="text-xs text-[var(--text-muted,#6B645B)]">
                    {uploadBanner.percent}%
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
                  {uploadBanner.completed}/{uploadBanner.total} assets •{' '}
                  {formatBytes(uploadBanner.bytesUploaded)} of{' '}
                  {formatBytes(uploadBanner.bytesTotal)}
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[var(--sand-100,#F3EBDD)]">
                  <div
                    className="h-full rounded-full bg-[var(--charcoal-800,#1F1E1B)]"
                    style={{ width: `${uploadBanner.percent}%` }}
                  />
                </div>
              </>
            )}
            {uploadBanner.status === 'success' && (
              <div>
                <div className="text-sm font-semibold text-[var(--text,#1F1E1B)]">
                  Upload complete
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
                  {uploadBanner.total} asset{uploadBanner.total === 1 ? '' : 's'} imported •{' '}
                  {formatBytes(uploadBanner.bytesTotal)}
                </div>
              </div>
            )}
            {uploadBanner.status === 'error' && (
              <div>
                <div className="text-sm font-semibold text-[#B42318]">Upload interrupted</div>
                <div className="mt-1 text-[11px] text-[#B42318]">
                  {uploadBanner.error ??
                    'Something went wrong. Please reopen the import sheet to retry.'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {uploadInfo && (
        <div className="fixed bottom-6 left-6 z-50 w-80 rounded-lg border border-[var(--river-200,#DCEDEC)] bg-[var(--river-50,#F0F7F6)] px-4 py-3 text-sm text-[var(--river-900,#10302E)] shadow-lg">
          <div className="flex items-start gap-3">
            <span>{uploadInfo}</span>
            <button
              type="button"
              className="ml-auto text-xs text-[var(--river-700,#2C5B58)] hover:text-[var(--river-900,#10302E)]"
              onClick={dismissUploadInfo}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isMobileLayout ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden pb-24">
            {activeMobilePanel === 'project' ? (
              <div className="h-full overflow-y-auto px-3">
                <Sidebar
                  dateTree={dateTree}
                  projectOverview={projectOverview}
                  onRenameProject={handleRename}
                  renamePending={renameMutation.isPending}
                  renameError={renameErrorMessage}
                  onProjectOverviewChange={handleProjectInfoChange}
                  projectOverviewPending={projectInfoMutation.isPending}
                  projectOverviewError={projectInfoErrorMessage}
                  onOpenImport={() => setImportOpen(true)}
                  onSelectDay={handleDaySelect}
                  selectedDayKey={selectedDayKey}
                  selectedDay={selectedDayNode}
                  onClearDateFilter={clearDateFilter}
                  collapsed={false}
                  onCollapse={() => { }}
                  onExpand={() => { }}
                  mode="mobile"
                />
              </div>
            ) : activeMobilePanel === 'details' ? (
              <div className="h-full overflow-y-auto px-3">
                <InspectorPanel
                  collapsed={false}
                  onCollapse={() => { }}
                  onExpand={() => { }}
                  hasSelection={Boolean(currentPhoto)}
                  selectionCount={selectedPhotoIds.size}
                  usedProjects={usedProjects}
                  usedProjectsLoading={assetProjectsLoading}
                  usedProjectsError={usedProjectsErrorMessage}
                  metadataSourceId={metadataSourceId}
                  onChangeMetadataSource={handleMetadataSourceChange}
                  metadataSourceBusy={metadataSyncPending}
                  metadataSourceError={metadataSourceActionError}
                  keyMetadataSections={{
                    general: generalInspectorFields,
                    capture: captureInspectorFields,
                  }}
                  metadataSummary={metadataSummary}
                  metadataEntries={metadataEntries}
                  metadataWarnings={metadataWarnings}
                  metadataLoading={metadataLoading}
                  metadataError={metadataErrorMessage}
                  previewAsset={inspectorPreviewAsset}
                  detailZoom={detailZoom}
                  detailMinZoom={DETAIL_MIN_ZOOM}
                  detailMaxZoom={DETAIL_MAX_ZOOM}
                  onDetailZoomIn={handleDetailZoomIn}
                  onDetailZoomOut={handleDetailZoomOut}
                  onDetailZoomReset={handleDetailZoomReset}
                  detailViewport={detailViewportRect}
                  onPreviewPan={handlePreviewPan}
                  mode="mobile"
                  quickFixControls={quickFixControls}
                  activeTab={activeInspectorTab}
                  onActiveTabChange={handleInspectorTabChange}
                />
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <MobilePhotosModeToggle view={view} onChange={setView} />
                <div
                  ref={activeMobilePanel === 'photos' ? setContentRef : undefined}
                  className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[var(--surface,#FFFFFF)]"
                >
                  {photosWorkspaceContent}
                </div>
              </div>
            )}
          </div>
          <MobileBottomBar
            activePanel={activeMobilePanel}
            onSelectPanel={setActiveMobilePanel}
            onOpenExport={() => setExportDialogOpen(true)}
            canExport={selectedPhotoIds.size > 0}
            detailsDisabled={!currentPhoto}
          />
        </>
      ) : (
        <div
          className="flex-1 min-h-0 grid overflow-hidden"
          style={{
            gridTemplateColumns: `${effectiveLeftWidth}px ${HANDLE_WIDTH}px minmax(0,1fr) ${HANDLE_WIDTH}px ${effectiveRightWidth}px`,
          }}
        >
          <Sidebar
            dateTree={dateTree}
            projectOverview={projectOverview}
            onRenameProject={handleRename}
            renamePending={renameMutation.isPending}
            renameError={renameErrorMessage}
            onProjectOverviewChange={handleProjectInfoChange}
            projectOverviewPending={projectInfoMutation.isPending}
            projectOverviewError={projectInfoErrorMessage}
            onOpenImport={() => setImportOpen(true)}
            onSelectDay={handleDaySelect}
            selectedDayKey={selectedDayKey}
            selectedDay={selectedDayNode}
            onClearDateFilter={clearDateFilter}
            collapsed={leftPanelCollapsed}
            onCollapse={() => setLeftPanelCollapsed(true)}
            onExpand={() => setLeftPanelCollapsed(false)}
          />

          <button
            type="button"
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={LEFT_COLLAPSED_WIDTH}
            aria-valuemax={LEFT_MAX_WIDTH}
            aria-valuenow={leftPanelCollapsed ? LEFT_COLLAPSED_WIDTH : leftPanelWidth}
            aria-valuetext={
              leftPanelCollapsed ? 'Collapsed' : `${Math.round(leftPanelWidth)} pixels`
            }
            aria-label="Resize Project Overview panel"
            tabIndex={0}
            className="group flex h-full w-full cursor-col-resize items-center justify-center border-x border-[var(--border,#EDE1C6)] bg-[var(--sand-50,#FBF7EF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
            onPointerDown={handleLeftHandlePointerDown}
            onKeyDown={handleLeftHandleKeyDown}
            onDoubleClick={() => setLeftPanelCollapsed((prev) => !prev)}
          >
            <span
              className="h-10 w-[2px] rounded-full bg-[var(--border,#EDE1C6)] transition-colors group-hover:bg-[var(--text-muted,#6B645B)]"
              aria-hidden="true"
            />
          </button>

          <main
            ref={setContentRef}
            className="relative flex min-h-0 min-w-0 flex-col bg-[var(--surface,#FFFFFF)]"
          >
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden">{photosWorkspaceContent}</div>
          </main>

          <button
            type="button"
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={RIGHT_COLLAPSED_WIDTH}
            aria-valuemax={RIGHT_MAX_WIDTH}
            aria-valuenow={rightPanelCollapsed ? RIGHT_COLLAPSED_WIDTH : rightPanelWidth}
            aria-valuetext={
              rightPanelCollapsed ? 'Collapsed' : `${Math.round(rightPanelWidth)} pixels`
            }
            aria-label="Resize Image Details panel"
            tabIndex={0}
            className="group flex h-full w-full cursor-col-resize items-center justify-center border-x border-[var(--border,#EDE1C6)] bg-[var(--sand-50,#FBF7EF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
            onPointerDown={handleRightHandlePointerDown}
            onKeyDown={handleRightHandleKeyDown}
            onDoubleClick={() => setRightPanelCollapsed((prev) => !prev)}
          >
            <span
              className="h-10 w-[2px] rounded-full bg-[var(--border,#EDE1C6)] transition-colors group-hover:bg-[var(--text-muted,#6B645B)]"
              aria-hidden="true"
            />
          </button>

          <InspectorPanel
            collapsed={rightPanelCollapsed}
            onCollapse={() => setRightPanelCollapsed(true)}
            onExpand={() => setRightPanelCollapsed(false)}
            hasSelection={Boolean(currentPhoto)}
            selectionCount={selectedPhotoIds.size}
            usedProjects={usedProjects}
            usedProjectsLoading={assetProjectsLoading}
            usedProjectsError={usedProjectsErrorMessage}
            metadataSourceId={metadataSourceId}
            onChangeMetadataSource={handleMetadataSourceChange}
            metadataSourceBusy={metadataSyncPending}
            metadataSourceError={metadataSourceActionError}
            keyMetadataSections={{
              general: generalInspectorFields,
              capture: captureInspectorFields,
            }}
            metadataSummary={metadataSummary}
            metadataEntries={metadataEntries}
            metadataWarnings={metadataWarnings}
            metadataLoading={metadataLoading}
            metadataError={metadataErrorMessage}
            previewAsset={inspectorPreviewAsset}
            detailZoom={detailZoom}
            detailMinZoom={DETAIL_MIN_ZOOM}
            detailMaxZoom={DETAIL_MAX_ZOOM}
            onDetailZoomIn={handleDetailZoomIn}
            onDetailZoomOut={handleDetailZoomOut}
            onDetailZoomReset={handleDetailZoomReset}
            detailViewport={detailViewportRect}
            onPreviewPan={handlePreviewPan}
            quickFixControls={quickFixControls}
            activeTab={activeInspectorTab}
            onActiveTabChange={handleInspectorTabChange}
          />
        </div>
      )}

      {importOpen && (
        <ErrorBoundary
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
              <div className="w-[min(95vw,640px)] rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 text-sm text-[var(--text,#1F1E1B)] shadow-2xl">
                <div className="text-base font-semibold">Import panel crashed</div>
                <p className="mt-2 text-[var(--text-muted,#6B645B)]">
                  Something went wrong while loading the import sheet. Close it and try again.
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setImportOpen(false)}
                    className="rounded border border-[var(--border,#E1D3B9)] px-3 py-1.5"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          }
        >
          <ImportSheet
            projectId={id}
            onClose={() => setImportOpen(false)}
            onImport={handleImport}
            onProgressSnapshot={handleUploadProgress}
            folderMode={folderMode}
            customFolder={customFolder}
            onInfoMessage={showUploadInfo}
          />
        </ErrorBoundary>
      )}
      <GeneralSettingsDialog
        open={generalSettingsOpen}
        settings={generalSettings}
        onClose={closeGeneralSettings}
        onSave={handleGeneralSettingsSave}
      />
      <ExportDialog
        isOpen={exportDialogOpen}
        photos={selectedPhotos}
        projectId={projectId ?? null}
        onClose={() => setExportDialogOpen(false)}
      />
    </div>
  )
}

const RAW_LIKE_EXTENSIONS = new Set([
  'arw',
  'cr2',
  'cr3',
  'nef',
  'raf',
  'orf',
  'rw2',
  'dng',
  'sr2',
  'pef',
])

function rotateRectDimensions(rect: CropRect): CropRect {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  const width = rect.height
  const height = rect.width
  const x = clamp(centerX - width / 2, 0, 1 - width)
  const y = clamp(centerY - height / 2, 0, 1 - height)
  return clampCropRect({ x, y, width, height })
}

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

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
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
  if (typeof input === 'number') {
    const magnitude = Math.abs(input)
    const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2
    return trimNumber(input, decimals)
  }
  if (typeof input === 'string') {
    const trimmed = input.trim()
    const decimalMatch = trimmed.match(/^-?\d+\.(\d{4,})/)
    if (decimalMatch) {
      const fraction = decimalMatch[1]
      return `${trimmed.split('.')[0]}.${fraction.slice(0, 4)}`
    }
    return trimmed
  }
  return String(input)
}

function formatDateTimeLabel(source?: string | Date | null): string {
  if (!source) return '—'
  const parsed = source instanceof Date ? source : new Date(source)
  if (Number.isNaN(parsed.getTime())) {
    return typeof source === 'string' ? source : '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function formatImportDateLabel(source?: string | null): string {
  return formatDateTimeLabel(source)
}

function formatCaptureDateLabel(
  metadata: Record<string, unknown> | null | undefined,
  fallback?: string | null
): string {
  const cand =
    pickMetadataValue(metadata, [
      'exif:datetimeoriginal',
      'datetimeoriginal',
      'quicktime:createdate',
      'xmp:createdate',
      'iptc:datecreated',
      'photoshop:datecreated',
      'composite:datetimecreated',
    ]) ?? fallback
  return formatDateTimeLabel(typeof cand === 'string' ? cand : fallback)
}

function formatStorageOriginLabel(storageUri?: string | null): string {
  if (!storageUri) return 'Unknown'
  const lower = storageUri.toLowerCase()
  if (lower.startsWith('imagehub')) return 'Image Hub'
  if (lower.startsWith('file://')) return 'Local import'
  if (lower.startsWith('s3://')) return 'S3 bucket'
  if (lower.startsWith('gs://')) return 'Cloud storage'
  const scheme = storageUri.split('://')[0]?.trim()
  if (scheme) {
    return scheme.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
  return storageUri
}

function formatCameraModel(metadata: Record<string, unknown> | null | undefined): string {
  const raw = pickMetadataValue(metadata, [
    'camera_model_name',
    'model',
    'exif.image.model',
    'exif:model',
  ])
  return formatMetadataText(raw)
}

function formatLensModel(metadata: Record<string, unknown> | null | undefined): string {
  const raw = pickMetadataValue(metadata, ['lens_model', 'lens', 'lens_id', 'lens_type'])
  return formatMetadataText(raw)
}

function formatApertureValue(metadata: Record<string, unknown> | null | undefined): string {
  const raw = pickMetadataValue(metadata, ['fnumber', 'aperturevalue', 'aperture'])
  const numeric = parseNumericFromUnknown(raw)
  if (numeric && numeric > 0) {
    return `f/${trimNumber(numeric, numeric >= 10 ? 0 : 1)}`
  }
  if (typeof raw === 'string') {
    const cleaned = raw.toLowerCase().startsWith('f/') ? raw : `f/${raw}`
    return cleaned
  }
  return '—'
}

function formatShutterValue(metadata: Record<string, unknown> | null | undefined): string {
  const raw = pickMetadataValue(metadata, ['shutterspeedvalue', 'shutter_speed', 'exposuretime'])
  if (typeof raw === 'string' && raw.includes('/')) {
    return `${raw.trim()} s`
  }
  const numeric = parseNumericFromUnknown(raw)
  if (!numeric || numeric <= 0) return '—'
  if (numeric >= 1) {
    return `${trimNumber(numeric)} s`
  }
  return `${formatFractionFromDecimal(numeric)} s`
}

function formatIsoValue(metadata: Record<string, unknown> | null | undefined): string {
  const raw = pickMetadataValue(metadata, ['iso', 'isospeedratings'])
  const numeric = parseNumericFromUnknown(raw)
  if (numeric && numeric > 0) {
    return `ISO ${Math.round(numeric)}`
  }
  if (typeof raw === 'string' && raw.trim()) {
    return `ISO ${raw.trim()}`
  }
  return '—'
}

function formatFocalLengthValue(metadata: Record<string, unknown> | null | undefined): string {
  const raw = pickMetadataValue(metadata, ['focallengthin35mmfilm', 'focallength'])
  const numeric = parseNumericFromUnknown(raw)
  if (numeric && numeric > 0) {
    return `${Math.round(numeric)} mm`
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().endsWith('mm') ? raw.trim() : `${raw.trim()} mm`
  }
  return '—'
}

function formatMetadataText(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return trimNumber(value)
  return formatMetadataValue(value)
}

function pickMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  candidates: string[]
): unknown {
  if (!metadata) return null
  const entries = Object.entries(metadata)
  if (!entries.length) return null
  const normalized = candidates.map((candidate) => candidate.toLowerCase())
  for (const target of normalized) {
    const hit = entries.find(([key]) => key.toLowerCase() === target)
    if (hit) return hit[1]
  }
  for (const target of normalized) {
    const hit = entries.find(([key]) => key.toLowerCase().includes(target))
    if (hit) return hit[1]
  }
  return null
}

function parseNumericFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
    if (fraction) {
      const numerator = Number(fraction[1])
      const denominator = Number(fraction[2])
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
        return numerator / denominator
      }
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function trimNumber(value: number, decimals: number = 2): string {
  const options = Math.max(0, Math.min(decimals, 4))
  const fixed = value.toFixed(options)
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function formatFractionFromDecimal(value: number): string {
  if (value <= 0) return String(value)
  const denominator = Math.max(1, Math.round(1 / value))
  return `1/${denominator}`
}

const METADATA_LABEL_OVERRIDES: Record<string, string> = {
  'exif:lensid': 'Lens ID',
  'composite:aperture': 'Aperture',
  'composite:shutterspeed': 'Shutter Speed',
  'makernotes:focusmode': 'Focus Mode',
  'raf:version': 'Firmware Version',
  'exif:fnumber': 'Aperture',
  'exif:iso': 'ISO',
  'iptc:keywords': 'Keywords',
  'xmp:createdate': 'XMP Create Date',
  'photoshop:datecreated': 'Photoshop Date Created',
}

function normalizeMetadataKey(key: string): string {
  return key ? key.trim().toLowerCase() : ''
}

function formatMetadataKeyLabel(key: string): string {
  const normalized = normalizeMetadataKey(key)
  if (METADATA_LABEL_OVERRIDES[normalized]) {
    return METADATA_LABEL_OVERRIDES[normalized]
  }
  const stripped = key.includes(':') ? key.split(':').slice(-1)[0] : key
  const spaced = stripped
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return key
  return spaced.replace(/\b([a-z])/g, (char) => char.toUpperCase())
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

type ToggleOptions = {
  shiftKey?: boolean
}

type InheritancePromptState = {
  assetIds: string[]
  assetsWithOptions: string[]
  statuses: Record<string, ImageHubAssetStatus>
  candidateProjects: { id: string; name: string }[]
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
    const relativePath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const folder = deriveFolderFromRelativePath(relativePath)
    return { id: generateLocalDescriptorId(), file, folder, relativePath }
  })
}

async function collectFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<LocalFileDescriptor[]> {
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
      const readEntries = async (): Promise<any[]> =>
        new Promise((resolve, reject) => {
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

type UploadPhase =
  | 'pending'
  | 'initializing'
  | 'uploading'
  | 'finalizing'
  | 'success'
  | 'error'
  | 'blocked'

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

function PendingMiniGrid({
  items,
  onToggle,
  className,
}: {
  items: PendingItem[]
  onToggle: (id: string, opts?: ToggleOptions) => void
  className?: string
}) {
  const extra = className ? ` ${className}` : ''
  if (!items.length) {
    return (
      <div
        className={`rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4 text-center text-xs text-[var(--text-muted,#6B645B)]${extra}`}
      >
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

  const columns = useMemo(
    () =>
      containerWidth ? Math.max(1, computeCols(containerWidth, VIRTUAL_TILE_WIDTH, GRID_GAP)) : 1,
    [containerWidth]
  )

  const { startIndex, endIndex, paddingTop, paddingBottom } = useMemo(() => {
    if (!items.length) return { startIndex: 0, endIndex: 0, paddingTop: 0, paddingBottom: 0 }
    const rowCount = Math.max(1, Math.ceil(items.length / columns))
    const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - overscanRows)
    const effectiveViewport = viewportHeight || rowStride
    const endRow = Math.min(
      rowCount,
      Math.ceil((scrollTop + effectiveViewport) / rowStride) + overscanRows
    )
    const clampedStart = Math.min(items.length, startRow * columns)
    const clampedEnd = Math.min(items.length, endRow * columns)
    const visibleRows = Math.max(0, endRow - startRow)
    const totalHeight = rowCount * VIRTUAL_TILE_HEIGHT + Math.max(0, rowCount - 1) * GRID_GAP
    const topPad = startRow * (VIRTUAL_TILE_HEIGHT + GRID_GAP)
    const visibleHeight =
      visibleRows * VIRTUAL_TILE_HEIGHT + Math.max(0, visibleRows - 1) * GRID_GAP
    const bottomPad = Math.max(0, totalHeight - topPad - visibleHeight)
    return {
      startIndex: clampedStart,
      endIndex: clampedEnd,
      paddingTop: topPad,
      paddingBottom: bottomPad,
    }
  }, [items, columns, scrollTop, viewportHeight])

  const visibleItems = items.slice(startIndex, endIndex || items.length)

  return (
    <div
      className={`rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-2${extra}`}
    >
      <div className="h-full overflow-y-auto pr-1" ref={setScrollRef}>
        <div style={{ height: `${paddingTop}px` }} />
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(88px, 1fr))`,
            gap: `${GRID_GAP}px`,
          }}
        >
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
                    className={`flex h-16 w-full items-center justify-center text-[10px] font-medium text-[var(--text-muted,#6B645B)] ${item.ready === false ? 'animate-pulse' : ''
                      }`}
                  >
                    {item.ready === false ? (
                      <span className="inline-flex items-center gap-1 text-[var(--text-muted,#6B645B)]">
                        <span
                          className="inline-block h-3 w-3 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent"
                          aria-hidden
                        />
                        Preparing…
                      </span>
                    ) : (
                      item.type
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[9px] font-medium uppercase tracking-wide">
                <span className="text-[var(--charcoal-800,#1F1E1B)]">
                  {item.ready === false ? 'Preparing' : 'Pending'}
                </span>
                <span className="text-[var(--text-muted,#6B645B)]">{formatBytes(item.size)}</span>
              </div>
              <div className="truncate px-2 pb-2 text-[10px] text-[var(--text-muted,#6B645B)]">
                {item.name}
              </div>
            </label>
          ))}
        </div>
        <div style={{ height: `${paddingBottom}px` }} />
      </div>
    </div>
  )
}

export function ImportSheet({
  projectId,
  onClose,
  onImport,
  onProgressSnapshot,
  folderMode,
  customFolder,
  onInfoMessage,
}: {
  projectId?: string
  onClose: () => void
  onImport: (args: { count: number; types: ImgType[]; dest: string }) => void
  onProgressSnapshot?: (snapshot: UploadProgressSnapshot) => void
  folderMode: 'date' | 'custom'
  customFolder: string
  onInfoMessage?: (message: string) => void
}) {
  const [mode, setMode] = useState<'choose' | 'local' | 'hub' | 'upload'>('choose')
  const [localItems, setLocalItems] = useState<PendingItem[]>([])
  const [hubSelection, setHubSelection] = useState<PendingItem[]>([])
  const [hubStatusSnapshot, setHubStatusSnapshot] = useState<Record<string, ImageHubAssetStatus>>(
    {}
  )
  const hubStatusRef = useRef<Record<string, ImageHubAssetStatus>>({})
  const [hubProjectDirectory, setHubProjectDirectory] = useState<Record<string, string>>({})
  const [hubResetSignal, setHubResetSignal] = useState(0)
  const [hubImporting, setHubImporting] = useState(false)
  const [hubImportError, setHubImportError] = useState<string | null>(null)
  const [inheritancePrompt, setInheritancePrompt] = useState<InheritancePromptState | null>(null)
  const [selectedInheritanceProject, setSelectedInheritanceProject] = useState('')
  const [ignoreDup, setIgnoreDup] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const lastLocalToggleIdRef = useRef<string | null>(null)
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

  const { data: hubSettingsData } = useQuery({
    queryKey: ['image-hub-settings'],
    queryFn: getImageHubSettings,
    staleTime: 5 * 60 * 1000,
  })
  const metadataInheritance = hubSettingsData?.metadata_inheritance ?? 'ask'

  useEffect(() => {
    hubStatusRef.current = hubStatusSnapshot
  }, [hubStatusSnapshot])

  useEffect(() => {
    setHubImportError(null)
  }, [hubSelection])

  const handleStatusSnapshot = useCallback((snapshot: Record<string, ImageHubAssetStatus>) => {
    setHubStatusSnapshot(snapshot)
  }, [])

  const handleProjectDirectoryChange = useCallback((directory: Record<string, string>) => {
    setHubProjectDirectory(directory)
  }, [])

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

  useEffect(() => {
    ; (document.getElementById('import-sheet') as HTMLDivElement | null)?.focus()
  }, [])

  useEffect(() => {
    if (!folderInputRef.current) return
    folderInputRef.current.setAttribute('webkitdirectory', '')
    folderInputRef.current.setAttribute('directory', '')
  }, [])

  useEffect(
    () => () => {
      if (localDescriptorTaskRef.current !== null) {
        window.clearTimeout(localDescriptorTaskRef.current)
        localDescriptorTaskRef.current = null
      }
      localDescriptorQueueRef.current = []
      localDescriptorProcessingRef.current = false
      localDescriptorRunTokenRef.current += 1
      localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      localPreviewUrlsRef.current = []
    },
    []
  )

  const isUploadMode = mode === 'upload'
  const isHubMode = mode === 'hub'
  const isLocalMode = mode === 'local'
  const usesExpandedModal = mode !== 'choose'
  const effectiveDest = isUploadMode ? uploadDestination : derivedDest

  const localSelectedItems = useMemo(() => localItems.filter((item) => item.selected), [localItems])
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
    return isHubMode ? hubSelection : localSelectedItems
  }, [isUploadMode, uploadTasks, isHubMode, hubSelection, localSelectedItems])
  const selectedTypes = useMemo(
    () => Array.from(new Set(selectedItems.map((item) => item.type))) as ImgType[],
    [selectedItems]
  )
  const totalSelectedBytes = useMemo(
    () => selectedItems.reduce((acc, item) => acc + (item.size || 0), 0),
    [selectedItems]
  )
  const selectedFolders = useMemo(() => {
    const folders = new Set<string>()
    selectedItems.forEach((item) => folders.add(item.meta?.folder ?? 'Selection'))
    return folders
  }, [selectedItems])

  const formatProjectName = useCallback(
    (projectId: string) =>
      hubProjectDirectory[projectId] || `Project ${projectId.slice(0, 8).toUpperCase()}`,
    [hubProjectDirectory]
  )

  const ensureHubStatusEntries = useCallback(
    async (assetIds: string[]) => {
      if (!projectId) {
        throw new Error('Missing project context.')
      }
      let snapshot = hubStatusRef.current
      const missing = assetIds.filter((assetId) => !snapshot[assetId])
      if (missing.length) {
        const fetched = await Promise.all(
          missing.map(async (assetId) => {
            const status = await fetchImageHubAssetStatus(assetId, projectId)
            return [assetId, status] as const
          })
        )
        snapshot = { ...snapshot }
        fetched.forEach(([assetId, status]) => {
          snapshot[assetId] = status
        })
        hubStatusRef.current = snapshot
        setHubStatusSnapshot(snapshot)
      }
      return snapshot
    },
    [projectId]
  )

  const buildAutomaticInheritance = useCallback(
    (assetsWithOptions: string[], statuses: Record<string, ImageHubAssetStatus>) => {
      const inheritance: Record<string, string> = {}
      assetsWithOptions.forEach((assetId) => {
        const source = statuses[assetId]?.other_projects?.[0]
        if (source) {
          inheritance[assetId] = source
        }
      })
      return inheritance
    },
    []
  )

  const finalizeHubLink = useCallback(
    async (assetIds: string[], inheritance: Record<string, string | null> = {}) => {
      if (!projectId) {
        throw new Error('Missing project context.')
      }
      await linkAssetsToProject(projectId, { assetIds, inheritance })
      setHubSelection([])
      setHubResetSignal((token) => token + 1)
      const fallbackTypes = selectedTypes.length ? selectedTypes : (['JPEG'] as ImgType[])
      onImport({ count: assetIds.length, types: fallbackTypes, dest: effectiveDest })
    },
    [projectId, onImport, selectedTypes, effectiveDest]
  )

  const handleHubImport = useCallback(async () => {
    if (hubImporting) return
    if (!projectId) {
      setHubImportError('Missing project context. Close this dialog and reopen the project.')
      return
    }
    if (!hubSelection.length) return
    setHubImportError(null)
    setHubImporting(true)
    try {
      const assetIds = Array.from(new Set(hubSelection.map((item) => item.id)))
      const statuses = await ensureHubStatusEntries(assetIds)
      const assetsWithOptions = assetIds.filter(
        (assetId) => statuses[assetId]?.other_projects?.length
      )
      if (metadataInheritance === 'ask' && assetsWithOptions.length) {
        const candidateIds = Array.from(
          new Set(assetsWithOptions.flatMap((assetId) => statuses[assetId]?.other_projects ?? []))
        )
        if (candidateIds.length) {
          const candidateProjects = candidateIds.map((id) => ({ id, name: formatProjectName(id) }))
          setInheritancePrompt({ assetIds, assetsWithOptions, statuses, candidateProjects })
          setSelectedInheritanceProject(candidateProjects[0]?.id ?? '')
          setHubImporting(false)
          return
        }
      }
      let inheritance: Record<string, string | null> = {}
      if (metadataInheritance === 'always' && assetsWithOptions.length) {
        inheritance = buildAutomaticInheritance(assetsWithOptions, statuses)
      }
      await finalizeHubLink(assetIds, inheritance)
    } catch (err) {
      setHubImportError(err instanceof Error ? err.message : 'Failed to import from Image Hub')
    } finally {
      setHubImporting(false)
    }
  }, [
    hubImporting,
    projectId,
    hubSelection,
    ensureHubStatusEntries,
    metadataInheritance,
    formatProjectName,
    buildAutomaticInheritance,
    finalizeHubLink,
  ])

  const handleInheritanceConfirm = useCallback(async () => {
    if (!inheritancePrompt || !selectedInheritanceProject) return
    setInheritancePrompt(null)
    setHubImportError(null)
    setHubImporting(true)
    try {
      const inheritance: Record<string, string> = {}
      inheritancePrompt.assetsWithOptions.forEach((assetId) => {
        const options = inheritancePrompt.statuses[assetId]?.other_projects ?? []
        if (options.includes(selectedInheritanceProject)) {
          inheritance[assetId] = selectedInheritanceProject
        }
      })
      await finalizeHubLink(inheritancePrompt.assetIds, inheritance)
    } catch (err) {
      setHubImportError(err instanceof Error ? err.message : 'Failed to import from Image Hub')
    } finally {
      setSelectedInheritanceProject('')
      setHubImporting(false)
    }
  }, [inheritancePrompt, selectedInheritanceProject, finalizeHubLink])

  const handleInheritanceSkip = useCallback(async () => {
    if (!inheritancePrompt) return
    setInheritancePrompt(null)
    setSelectedInheritanceProject('')
    setHubImportError(null)
    setHubImporting(true)
    try {
      await finalizeHubLink(inheritancePrompt.assetIds, {})
    } catch (err) {
      setHubImportError(err instanceof Error ? err.message : 'Failed to import from Image Hub')
    } finally {
      setHubImporting(false)
    }
  }, [inheritancePrompt, finalizeHubLink])

  const uploadUploadedBytes = useMemo(
    () => uploadTasks.reduce((acc, task) => acc + task.bytesUploaded, 0),
    [uploadTasks]
  )
  const uploadTotalBytes = useMemo(
    () => uploadTasks.reduce((acc, task) => acc + task.size, 0),
    [uploadTasks]
  )
  const uploadCompletedCount = uploadTasks.filter((task) => task.status === 'success').length
  const uploadOverallProgress =
    uploadTotalBytes > 0
      ? uploadUploadedBytes / uploadTotalBytes
      : uploadTasks.length
        ? uploadCompletedCount / uploadTasks.length
        : 0
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

  const localSelectedFolderCount = useMemo(
    () =>
      localSelectedItems.length
        ? new Set(localSelectedItems.map((item) => item.meta?.folder ?? 'Selection')).size
        : 0,
    [localSelectedItems]
  )
  const hubSelectionList = useMemo(() => {
    if (!hubSelection.length) return []
    const folders = new Set<string>()
    hubSelection.forEach((item) => folders.add(item.meta?.folder ?? 'Selection'))
    return Array.from(folders)
  }, [hubSelection])

  const localQueuePercent = useMemo(() => {
    if (localQueueProgress.totalBytes > 0) {
      return Math.max(
        0,
        Math.min(
          100,
          Math.round((localQueueProgress.processedBytes / localQueueProgress.totalBytes) * 100)
        )
      )
    }
    if (localQueueProgress.totalFiles > 0) {
      return Math.max(
        0,
        Math.min(
          100,
          Math.round((localQueueProgress.processedFiles / localQueueProgress.totalFiles) * 100)
        )
      )
    }
    return 0
  }, [localQueueProgress])

  const localQueueDetails = useMemo(() => {
    const pieces: string[] = []
    if (localQueueProgress.totalFiles > 0) {
      pieces.push(`${localQueueProgress.processedFiles}/${localQueueProgress.totalFiles} files`)
    }
    if (localQueueProgress.totalBytes > 0) {
      pieces.push(
        `${formatBytes(localQueueProgress.processedBytes)} of ${formatBytes(localQueueProgress.totalBytes)}`
      )
    }
    if (localQueuePercent > 0) {
      pieces.push(`${localQueuePercent}%`)
    }
    return pieces.join(' • ')
  }, [localQueuePercent, localQueueProgress])

  const hasLocalItems = localItems.length > 0
  const totalLocalItems = useMemo(
    () => (hasLocalItems ? localItems.length : localQueueProgress.totalFiles),
    [hasLocalItems, localItems.length, localQueueProgress.totalFiles]
  )
  const selectedLocalCount = useMemo(() => {
    if (localSelectedItems.length) return localSelectedItems.length
    if (localQueueProgress.active) {
      return Math.min(localQueueProgress.processedFiles, localQueueProgress.totalFiles)
    }
    return 0
  }, [
    localQueueProgress.active,
    localQueueProgress.processedFiles,
    localQueueProgress.totalFiles,
    localSelectedItems.length,
  ])

  const canSubmit =
    !isUploadMode &&
    selectedItems.length > 0 &&
    !(isLocalMode && localQueueProgress.active) &&
    !(isHubMode && (hubImporting || Boolean(inheritancePrompt)))
  const primaryButtonLabel = isHubMode
    ? hubImporting
      ? 'Importing…'
      : 'Import selected'
    : 'Start upload'

  const isPreparingLocalSelection =
    mode !== 'upload' &&
    !hasLocalItems &&
    (localPriming || localQueueProgress.active || localQueueProgress.totalFiles > 0)

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
    const map = new Map<
      string,
      { items: PendingItem[]; selected: number; totalBytes: number; selectedBytes: number }
    >()
    localItems.forEach((item) => {
      const folder = item.meta?.folder ?? 'Loose selection'
      if (!map.has(folder))
        map.set(folder, { items: [], selected: 0, totalBytes: 0, selectedBytes: 0 })
      const entry = map.get(folder)!
      entry.items.push(item)
      if (item.selected) entry.selected += 1
      entry.totalBytes += item.size || 0
      if (item.selected) entry.selectedBytes += item.size || 0
    })
    return Array.from(map.entries())
      .map(([folder, value]) => ({
        folder,
        items: value.items,
        selected: value.selected,
        total: value.items.length,
        bytes: value.totalBytes,
        selectedBytes: value.selectedBytes,
      }))
      .sort((a, b) => a.folder.localeCompare(b.folder))
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
      const newUrls = preparedItems
        .map((item) => item.previewUrl)
        .filter((url): url is string => Boolean(url))
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
      return prev.map((item, index) =>
        index === targetIndex ? { ...item, selected: nextSelected } : item
      )
    })
  }

  const mutateTask = useCallback(
    (taskId: string, updater: (task: UploadTaskState) => UploadTaskState) => {
      setUploadTasks((tasks) => tasks.map((task) => (task.id === taskId ? updater(task) : task)))
    },
    []
  )

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
      case 'pending':
        return 'Queued'
      case 'initializing':
        return 'Preparing'
      case 'uploading':
        return 'Uploading'
      case 'finalizing':
        return 'Finalizing'
      case 'success':
        return 'Completed'
      case 'error':
        return 'Error'
      case 'blocked':
        return 'Blocked'
      default:
        return 'Pending'
    }
  }

  function renderSummaryCard(
    wrapperClass: string,
    includeHubSelection: boolean,
    destination: string
  ) {
    return (
      <aside
        className={`${wrapperClass} flex h-full min-h-0 flex-col gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-3 text-[11px] leading-tight`}
      >
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">
            Destination
          </div>
          <div className="mt-1 truncate text-sm font-medium text-[var(--text,#1F1E1B)]">
            {destination}
          </div>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">
            Duplicates
          </div>
          <label className="mt-1 flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={ignoreDup}
              onChange={(e) => setIgnoreDup(e.target.checked)}
              className="h-4 w-4 accent-[var(--text,#1F1E1B)]"
            />
            Ignore duplicates
          </label>
        </div>
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">
            Selection
          </div>
          <div className="mt-1 text-sm font-medium text-[var(--text,#1F1E1B)]">
            {selectedItems.length
              ? `${selectedItems.length} asset${selectedItems.length === 1 ? '' : 's'} selected`
              : 'Nothing selected yet'}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
            {selectedTypes.length ? selectedTypes.join(' / ') : 'Waiting for selection'}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted,#6B645B)]">
            {selectionSummaryText}
          </div>
          {includeHubSelection && hubSelectionList.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-muted,#6B645B)]">
              {hubSelectionList.slice(0, 4).map((name) => (
                <li key={name} className="truncate">
                  - {name}
                </li>
              ))}
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
    if (isHubMode) {
      void handleHubImport()
      return
    }
    if (!selectedItems.length) return
    const missingFiles = selectedItems.filter((item) => !item.file)
    if (missingFiles.length) {
      console.error(
        'Upload aborted: missing File blobs for items',
        missingFiles.map((item) => item.id)
      )
      setUploadError(
        'Some selected items are missing file data. Please reselect the files and try again.'
      )
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
      setUploadTasks((tasks) =>
        tasks.map((task) => ({
          ...task,
          status: 'error',
          error: task.error ?? message,
        }))
      )
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

        const completion = await completeUpload(init.assetId, init.uploadToken, {
          ignoreDuplicates: ignoreDup,
        })

        if (completion.status === 'DUPLICATE') {
          onInfoMessage?.(
            `${task.name} was already in Image Hub, so we added the existing asset instead of uploading it again.`
          )
        }

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
            if (
              currentTask.status === 'success' ||
              currentTask.status === 'error' ||
              currentTask.status === 'blocked'
            ) {
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
          const successTypes = Array.from(
            new Set(uploadTasksRef.current.map((task) => task.type))
          ) as ImgType[]
          const fallbackTypes = successTypes.length
            ? successTypes
            : uploadTypesRef.current.length
              ? uploadTypesRef.current
              : (['JPEG'] as ImgType[])
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
  }, [
    ignoreDup,
    isUploadMode,
    markBlockedAfter,
    mutateTask,
    onImport,
    projectId,
    uploadDestination,
    uploadRunning,
    onInfoMessage,
  ])

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
        <DialogHeader
          title="Import photos"
          onClose={onClose}
          closeLabel="Close import flow"
          className="flex-shrink-0"
        />
        <div className="relative flex-1 min-h-0 px-5 pb-5 pt-2 text-sm text-[var(--text,#1F1E1B)]">
          {isPreparingLocalSelection && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--surface,#FFFFFF)]/70 backdrop-blur-[1px]">
              <div
                className="flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm font-semibold text-[var(--text,#1F1E1B)] shadow-lg"
                role="status"
                aria-live="polite"
              >
                <span
                  className="inline-block h-5 w-5 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent"
                  aria-hidden
                />
                Preparing files…
              </div>
            </div>
          )}
          {mode === 'choose' && (
            <div className="flex h-full flex-col justify-center gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode('local')}
                  className="flex flex-col items-start gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 text-left transition hover:border-[var(--charcoal-800,#1F1E1B)]"
                >
                  <div className="text-base font-semibold">Upload Photo</div>
                  <p className="text-xs text-[var(--text-muted,#6B645B)]">
                    Open the native picker to choose individual images or entire folders from your
                    computer.
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--charcoal-800,#1F1E1B)]">
                    Choose files…
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('hub')}
                  className="flex flex-col items-start gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 text-left transition hover:border-[var(--charcoal-800,#1F1E1B)]"
                >
                  <div className="text-base font-semibold">Upload from ImageHub</div>
                  <p className="text-xs text-[var(--text-muted,#6B645B)]">
                    Browse the shared ImageHub library to pull complete project folders into this
                    workspace.
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--charcoal-800,#1F1E1B)]">
                    Open ImageHub
                  </span>
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted,#6B645B)] text-center md:text-left">
                You can switch sources at any time before importing.
              </p>
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
                  <div className="text-sm font-medium">
                    Select photos or folders from your computer
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                    We support JPEG and RAW formats. Picking a folder pulls in everything inside.
                  </div>
                  <div className="mt-4 flex justify-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => openLocalPicker('files')}
                      className="rounded-md bg-[var(--primary,#A56A4A)] px-3 py-2 font-medium text-[var(--primary-contrast,#FFFFFF)]"
                    >
                      Choose files…
                    </button>
                    <button
                      type="button"
                      onClick={() => openLocalPicker('folder')}
                      className="rounded-md border border-[var(--border,#E1D3B9)] px-3 py-2"
                    >
                      Choose folder…
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-[var(--text-muted,#6B645B)]">
                    Or just drag & drop files and folders here.
                  </div>
                  {localQueueProgress.active && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="mt-4 flex w-full max-w-[260px] flex-col items-center gap-2 rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--surface-frosted-strong,#FBF7EF)] px-3 py-2 text-center text-[11px] text-[var(--text,#1F1E1B)]"
                    >
                      <div className="flex items-center justify-center gap-2 font-medium">
                        <span
                          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent"
                          aria-hidden
                        />
                        Preparing files…
                      </div>
                      {localQueueDetails && (
                        <div className="text-[10px] text-[var(--text-muted,#6B645B)]">
                          {localQueueDetails}
                        </div>
                      )}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sand-100,#F3EBDD)]">
                        <div
                          className="h-full rounded-full bg-[var(--charcoal-800,#1F1E1B)] transition-[width]"
                          style={{ width: `${localQueuePercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {isDragging && (
                    <div className="mt-4 rounded-md border border-dashed border-[var(--charcoal-800,#1F1E1B)] bg-[var(--surface-frosted,#F8F0E4)] px-3 py-2 text-xs font-medium text-[var(--charcoal-800,#1F1E1B)]">
                      Drop to add{' '}
                      {mode === 'local' ? 'to your selection' : 'and review before importing'}.
                    </div>
                  )}
                </div>
                {localItems.length > 0 && (
                  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                    <div className="flex items-center justify-between px-4 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                        Selected files & folders
                      </div>
                      <div className="text-[11px] text-[var(--text-muted,#6B645B)]">
                        {selectedLocalCount}/{totalLocalItems}
                      </div>
                    </div>
                    <div className="mt-2 flex-1 overflow-y-auto px-4 pb-3">
                      <ul className="space-y-3 text-[11px] text-[var(--text-muted,#6B645B)]">
                        {localFolderGroups.map(
                          ({ folder, items, selected, total, bytes, selectedBytes }) => (
                            <li key={folder}>
                              <div className="flex items-center justify-between text-[var(--text,#1F1E1B)]">
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{folder}</span>
                                  <span className="text-[10px] text-[var(--text-muted,#6B645B)]">
                                    {formatBytes(selectedBytes)} of {formatBytes(bytes)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-medium text-[var(--text-muted,#6B645B)]">
                                  {selected}/{total} pending
                                </span>
                              </div>
                              <ul className="mt-1 space-y-1">
                                {items.map((item) => (
                                  <li key={item.id}>
                                    <button
                                      type="button"
                                      onClick={(event) =>
                                        toggleLocalItem(item.id, { shiftKey: event.shiftKey })
                                      }
                                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition ${item.selected ? 'bg-[var(--sand-50,#FBF7EF)] text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)] hover:bg-[var(--sand-50,#FBF7EF)]/60'}`}
                                    >
                                      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-[var(--border,#E1D3B9)] text-[10px]">
                                        {item.selected ? '✓' : ''}
                                      </span>
                                      <span className="flex-1 truncate">
                                        <span className="block truncate text-[11px] leading-snug">
                                          {item.name}
                                        </span>
                                        <span className="block text-[9px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                                          Pending • {formatBytes(item.size)}
                                        </span>
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Ready to import</div>
                  <div className="text-xs text-[var(--text-muted,#6B645B)]">
                    {selectedLocalCount} selected / {totalLocalItems} total
                  </div>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                  {localQueueProgress.active
                    ? localQueueDetails
                      ? `Preparing ${localQueueDetails}`
                      : `Preparing ${totalLocalItems} file${totalLocalItems === 1 ? '' : 's'}…`
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
                        <span
                          className="inline-block h-4 w-4 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent"
                          aria-hidden
                        />
                        Preparing files…
                      </span>
                      <span className="text-[var(--text-muted,#6B645B)]">
                        {localQueueDetails ||
                          `Preparing ${totalLocalItems} file${totalLocalItems === 1 ? '' : 's'}…`}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    {localItems.length ? (
                      <PendingMiniGrid
                        items={localItems}
                        onToggle={toggleLocalItem}
                        className="h-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] text-xs text-[var(--text-muted,#6B645B)]">
                        <div className="flex flex-col items-center gap-2 py-6">
                          {localPriming || localQueueProgress.active ? (
                            <>
                              <span
                                className="inline-block h-4 w-4 animate-spin rounded-full border border-[var(--charcoal-800,#1F1E1B)] border-b-transparent"
                                aria-hidden
                              />
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
                  <button
                    type="button"
                    onClick={clearLocalSelection}
                    className="text-[var(--river-500,#6B7C7A)] underline"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
              {renderSummaryCard('w-56 flex-shrink-0', false, effectiveDest)}
            </div>
          )}

          {isHubMode && (
            <div className="flex h-full min-h-0 gap-5 overflow-hidden">
              <ImageHubImportPane
                currentProjectId={projectId ?? null}
                onSelectionChange={setHubSelection}
                onStatusSnapshot={handleStatusSnapshot}
                onProjectDirectoryChange={handleProjectDirectoryChange}
                resetSignal={hubResetSignal}
              />
              {renderSummaryCard('w-56 flex-shrink-0', true, effectiveDest)}
            </div>
          )}

          {isUploadMode && (
            <div className="flex h-full min-h-0 gap-5 overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                <div className="border-b border-[var(--border,#E1D3B9)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text,#1F1E1B)]">
                        Uploading {uploadCompletedCount}/{uploadTasks.length} assets
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                        {formatBytes(uploadUploadedBytes)} of {formatBytes(uploadTotalBytes)} •{' '}
                        {uploadOverallPercent}%
                      </div>
                    </div>
                    <span className="text-xs text-[var(--text-muted,#6B645B)]">
                      {uploadRunning ? 'In progress…' : 'Queue stopped'}
                    </span>
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
                        const progressPercent = Math.max(
                          0,
                          Math.min(100, Math.round(task.progress * 100))
                        )
                        const statusLabel = getStatusLabel(task)
                        const barColor =
                          task.status === 'error'
                            ? 'bg-[#B42318]'
                            : task.status === 'blocked'
                              ? 'bg-[var(--sand-300,#E1D3B9)]'
                              : 'bg-[var(--charcoal-800,#1F1E1B)]'
                        return (
                          <li
                            key={task.id}
                            className="rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-5 items-center justify-center rounded bg-[var(--sand-50,#FBF7EF)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                                    {task.type}
                                  </span>
                                  <span className="truncate text-sm font-medium text-[var(--text,#1F1E1B)]">
                                    {task.name}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                                  {formatBytes(task.bytesUploaded)} / {formatBytes(task.size)} •{' '}
                                  {statusLabel}
                                </div>
                                {task.error && (
                                  <div className="mt-1 text-xs text-[#B42318]">{task.error}</div>
                                )}
                              </div>
                              <span className="text-xs text-[var(--text-muted,#6B645B)]">
                                {progressPercent}%
                              </span>
                            </div>
                            <div className="mt-3 h-2 rounded bg-[var(--sand-100,#F3EBDD)]">
                              <div
                                className={`h-2 rounded ${barColor}`}
                                style={{ width: `${progressPercent}%` }}
                              />
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
            <button
              onClick={() => setMode('choose')}
              className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]"
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]"
          >
            {isUploadMode ? 'Close' : 'Cancel'}
          </button>
          {(isLocalMode || isHubMode) && (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className={`px-3 py-1.5 rounded text-[var(--primary-contrast,#FFFFFF)] ${canSubmit ? 'bg-[var(--primary,#A56A4A)]' : 'bg-[var(--sand-300,#E1D3B9)] cursor-not-allowed'}`}
            >
              {primaryButtonLabel}
            </button>
          )}
        </div>
        {isHubMode && hubImportError && (
          <div className="px-5 pb-4 text-xs text-[#B42318]" role="alert">
            {hubImportError}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleLocalFilesChange}
        className="hidden"
        accept="image/*"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={handleLocalFilesChange}
        className="hidden"
        accept="image/*"
      />
      {inheritancePrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-8">
          <div
            className="w-full max-w-md rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="text-base font-semibold text-[var(--text,#1F1E1B)]">
              Load settings from another project?
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted,#6B645B)]">
              {inheritancePrompt.assetsWithOptions.length === 1
                ? 'This asset already exists in another project. Choose where to inherit ratings, labels, and picks from.'
                : `These ${inheritancePrompt.assetsWithOptions.length} assets already exist in other projects. Choose where to inherit ratings, labels, and picks from.`}
            </p>
            <label className="mt-4 flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--text,#1F1E1B)]">Project</span>
              <select
                value={selectedInheritanceProject}
                onChange={(event) => setSelectedInheritanceProject(event.target.value)}
                className="rounded border border-[var(--border,#E1D3B9)] px-3 py-2 text-sm"
              >
                {inheritancePrompt.candidateProjects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 text-[11px] text-[var(--text-muted,#6B645B)]">
              Assets that are not part of the selected project will import without inheriting
              metadata.
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 text-sm">
              <button
                type="button"
                onClick={handleInheritanceSkip}
                className="rounded border border-[var(--border,#E1D3B9)] px-3 py-1.5"
              >
                Don’t inherit
              </button>
              <button
                type="button"
                onClick={handleInheritanceConfirm}
                disabled={!selectedInheritanceProject}
                className={`rounded px-3 py-1.5 text-[var(--primary-contrast,#FFFFFF)] ${selectedInheritanceProject ? 'bg-[var(--primary,#A56A4A)]' : 'bg-[var(--sand-300,#E1D3B9)] cursor-not-allowed'}`}
              >
                Choose project to inherit from
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
