import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TOKENS } from './utils'
import { listProjectAssets, assetThumbUrl, updateAssetPreview, type AssetListItem } from '../../shared/api/assets'
import { initUpload, putUpload, completeUpload } from '../../shared/api/uploads'
import { placeholderRatioForAspect } from '../../shared/placeholder'
import type { Photo, ImgType, ColorTag } from './types'
import { TopBar, Sidebar, GridView, DetailView, EmptyState, NoResults, computeCols } from './components'

const SIDEBAR_WIDTH = 288
const INSPECTOR_WIDTH = 260

function detectAspect(width?: number | null, height?: number | null): 'portrait' | 'landscape' | 'square' {
  if (!width || !height) return 'square'
  if (width > height) return 'landscape'
  if (height > width) return 'portrait'
  return 'square'
}

function mapAssetToPhoto(item: AssetListItem, existing?: Photo): Photo {
  const name = item.original_filename ?? existing?.name ?? 'Untitled asset'
  const type = inferTypeFromName(name)
  const date = item.taken_at ?? item.completed_at ?? existing?.date ?? new Date().toISOString()
  const src = assetThumbUrl(item) ?? existing?.src ?? null
  const aspect = detectAspect(item.width, item.height)
  const placeholderRatio = existing?.placeholderRatio ?? placeholderRatioForAspect(aspect)

  return {
    id: item.id,
    name,
    type,
    date,
    rating: existing?.rating ?? 0,
    picked: existing?.picked ?? false,
    rejected: existing?.rejected ?? false,
    tag: existing?.tag ?? 'None',
    src,
    placeholderRatio,
    isPreview: typeof item.is_preview === 'boolean' ? item.is_preview : existing?.isPreview ?? false,
    previewOrder: typeof item.preview_order === 'number' ? item.preview_order : existing?.previewOrder ?? null,
  }
}

export default function ProjectWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [projectName] = useState(() => `Project ${id || '—'}`)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const prevPhotosRef = useRef<Photo[]>([])
  const currentIndexRef = useRef(0)
  const currentPhotoIdRef = useRef<string | null>(null)
  const [view, setView] = useState<'grid' | 'detail'>('detail')
  const [current, setCurrent] = useState(0)
  const importInFlightRef = useRef(false)

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

  const previewMutation = useMutation({
    mutationFn: async ({ assetId, isPreview, makePrimary }: { assetId: string; isPreview: boolean; makePrimary?: boolean }) => {
      if (!id) {
        throw new Error('Missing project identifier')
      }
      return updateAssetPreview(id, assetId, isPreview, { makePrimary })
    },
    onSuccess: () => {
      setPreviewError(null)
      refreshAssets()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update preview state'
      setPreviewError(message)
    },
  })

  const handleTogglePreview = useCallback(async (photo: Photo) => {
    if (previewMutation.isPending) return
    setPreviewError(null)
    try {
      await previewMutation.mutateAsync({ assetId: photo.id, isPreview: !photo.isPreview })
    } catch (err) {
      // error is surfaced via previewError state
    }
  }, [previewMutation, setPreviewError])

  const handleMakePrimaryPreview = useCallback(async (photo: Photo) => {
    if (previewMutation.isPending) return
    setPreviewError(null)
    try {
      await previewMutation.mutateAsync({ assetId: photo.id, isPreview: true, makePrimary: true })
    } catch (err) {
      // handled via previewError
    }
  }, [previewMutation, setPreviewError])

  const [showJPEG, setShowJPEG] = useState(true)
  const [showRAW, setShowRAW] = useState(true)
  const [minStars, setMinStars] = useState<0 | 1 | 2 | 3 | 4 | 5>(0)
  const [onlyPicked, setOnlyPicked] = useState(false)
  const [hideRejected, setHideRejected] = useState(true)
  const [filterColor, setFilterColor] = useState<'Any' | ColorTag>('Any')

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

  const [folderMode, setFolderMode] = useState<'date' | 'custom'>('date')
  const [customFolder, setCustomFolder] = useState('My Folder')

  const visible: Photo[] = useMemo(() => photos.filter((p) => {
    const typeOk = (p.type === 'JPEG' && showJPEG) || (p.type === 'RAW' && showRAW)
    const ratingOk = p.rating >= minStars
    const pickOk = !onlyPicked || p.picked
    const rejectOk = !hideRejected || !p.rejected
    const colorOk = filterColor === 'Any' || p.tag === filterColor
    return typeOk && ratingOk && pickOk && rejectOk && colorOk
  }), [photos, showJPEG, showRAW, minStars, onlyPicked, hideRejected, filterColor])

  useEffect(() => { if (current >= visible.length) setCurrent(Math.max(0, visible.length - 1)) }, [visible, current])

  // Shortcuts (gleich wie Monolith)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'g' || e.key === 'G') setView('grid')
      if (e.key === 'd' || e.key === 'D') setView('detail')
      if (!visible.length) return
      const cur = visible[current]; if (!cur) return
      if (e.key === 'p' || e.key === 'P') setPhotos((arr) => arr.map((x) => (x.id === cur.id ? { ...x, picked: !x.picked, rejected: x.rejected && false } : x)))
      if (e.key === 'x' || e.key === 'X') setPhotos((arr) => arr.map((x) => (x.id === cur.id ? { ...x, rejected: !x.rejected, picked: x.picked && false } : x)))
      if (/^[1-5]$/.test(e.key)) setPhotos((arr) => arr.map((x) => (x.id === cur.id ? { ...x, rating: Number(e.key) as 1 | 2 | 3 | 4 | 5 } : x)))
      if (e.key === 'ArrowRight') setCurrent((i) => Math.min(i + 1, visible.length - 1))
      if (e.key === 'ArrowLeft') setCurrent((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [visible, current])

  // Custom events vom Grid
  useEffect(() => {
    const onRate = (e: any) => setPhotos((arr) => arr.map((x) => (x.id === e.detail.id ? { ...x, rating: e.detail.r } : x)))
    const onPick = (e: any) => setPhotos((arr) => arr.map((x) => (x.id === e.detail.id ? { ...x, picked: !x.picked, rejected: x.rejected && false } : x)))
    const onReject = (e: any) => setPhotos((arr) => arr.map((x) => (x.id === e.detail.id ? { ...x, rejected: !x.rejected, picked: x.picked && false } : x)))
    const onColor = (e: any) => setPhotos((arr) => arr.map((x) => (x.id === e.detail.id ? { ...x, tag: e.detail.t } : x)))
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
  }, [])

  useEffect(() => {
    if (!id) return
    refreshAssets()
  }, [id, refreshAssets])

  useEffect(() => {
    if (!id) return
    if (!photos.some((p) => !p.src)) return
    const timer = window.setInterval(() => {
      refreshAssets()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [id, photos, refreshAssets])

  // Import Sheet
  const [importOpen, setImportOpen] = useState(false)
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

  // Date tree
  type Node = { name: string; children?: Node[] }
  function buildDateTree(items: Photo[]): Node[] {
    const map = new Map<string, Map<string, Set<string>>>()
    items.forEach((p) => {
      const d = new Date(p.date)
      const y = String(d.getFullYear())
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      if (!map.has(y)) map.set(y, new Map())
      const mm = map.get(y)!
      if (!mm.has(m)) mm.set(m, new Set())
      mm.get(m)!.add(day)
    })
    const nodes: Node[] = []
    for (const [y, ms] of map) {
      const mChildren: Node[] = []
      for (const [m, days] of ms) {
        mChildren.push({ name: `${y}-${m}`, children: Array.from(days).sort().map((d) => ({ name: `${y}-${m}-${d}` })) })
      }
      nodes.push({ name: y, children: mChildren })
    }
    return nodes.sort((a, b) => b.name.localeCompare(a.name))
  }
  const dateTree = useMemo(() => buildDateTree(photos), [photos])

  const currentPhoto = visible[current] ?? null
  const hasAny = photos.length > 0

  useEffect(() => {
    setPreviewError(null)
  }, [currentPhoto?.id])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
      <TopBar projectName={projectName} onBack={goBack} />

      <div
        className="flex-1 min-h-0 grid overflow-hidden"
        style={{ gridTemplateColumns: `${SIDEBAR_WIDTH}px minmax(0,1fr) ${INSPECTOR_WIDTH}px` }}
      >
        <Sidebar
          dateTree={dateTree as any}
          onOpenImport={() => setImportOpen(true)}
          folderMode={folderMode}
          setFolderMode={setFolderMode}
          customFolder={customFolder}
          setCustomFolder={setCustomFolder}
        />

        <main ref={contentRef} className="relative flex min-h-0 flex-col bg-[var(--surface,#FFFFFF)] border-r border-[var(--border,#E1D3B9)]">
          <div className="border-b border-[var(--border,#E1D3B9)] px-3 py-2 flex items-center gap-2 text-xs">
            <button className={`px-2 py-1 rounded border ${view === 'grid' ? 'bg-[var(--sand100,#F3EBDD)] border-[var(--border,#E1D3B9)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => setView('grid')}>Grid</button>
            <button className={`px-2 py-1 rounded border ${view === 'detail' ? 'bg-[var(--sand100,#F3EBDD)] border-[var(--border,#E1D3B9)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => setView('detail')}>Detail</button>
            {view === 'grid' && (
              <div className="inline-flex items-center gap-2 ml-2">
                <span className="text-[11px]">Size</span>
                <input type="range" min={minThumbForSix} max={240} value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} />
              </div>
            )}
            <button
              className="ml-2 inline-flex items-center gap-1 rounded border border-[var(--border,#E1D3B9)] px-2 py-1 text-[11px] hover:border-[var(--text,#1F1E1B)]"
              onClick={() => refreshAssets()}
              type="button"
            >
              Refresh
            </button>
            {loadingAssets && <span className="text-[11px] text-[var(--text-muted,#6B645B)]">Syncing…</span>}
            {loadError && <span className="text-[11px] text-[#B42318]">{loadError}</span>}
            <span className="ml-auto text-[var(--text-muted,#6B645B)]">{visible.length} photos</span>
          </div>

          <div className="border-b border-[var(--border,#E1D3B9)] px-3 py-2 text-xs grid grid-cols-[1fr_1fr_1fr] gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Rating</span>
              <MinStarRow value={minStars} onChange={(v) => setMinStars(v)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Color</span>
              <ColorFilter value={filterColor} onChange={setFilterColor} />
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={showJPEG} onChange={(e) => setShowJPEG(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" /> JPEG
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={showRAW} onChange={(e) => setShowRAW(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" /> RAW
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={onlyPicked} onChange={(e) => setOnlyPicked(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" /> Picks
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" /> Hide rejects
              </label>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {!hasAny ? (
              <div className="flex h-full items-center justify-center overflow-auto p-6">
                <EmptyState onImport={() => setImportOpen(true)} />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex h-full items-center justify-center overflow-auto p-6">
                <NoResults onReset={() => { setMinStars(0); setFilterColor('Any'); setShowJPEG(true); setShowRAW(true); setOnlyPicked(false); setHideRejected(true) }} />
              </div>
            ) : view === 'grid' ? (
              <div className="h-full overflow-auto">
                <GridView items={visible} size={gridSize} gap={GAP} containerWidth={contentW} onOpen={(idx) => { setCurrent(idx); setView('detail') }} />
              </div>
            ) : (
              <DetailView items={visible} index={current} setIndex={setCurrent} className="h-full" />
            )}
          </div>
        </main>

        <aside className="h-full overflow-y-auto bg-[var(--surface,#FFFFFF)] p-3 text-xs">
          <h4 className="font-medium mb-2">Inspector</h4>
          {currentPhoto ? (
            <div className="space-y-2">
              <Row label="Name" value={currentPhoto.name} />
              <Row label="Type" value={currentPhoto.type} />
              <Row label="Date" value={new Date(currentPhoto.date).toLocaleDateString()} />
              <Row label="Rating" value={`${currentPhoto.rating}★`} />
              <Row label="Flag" value={currentPhoto.picked ? 'Picked' : '—'} />
              <Row label="Rejected" value={currentPhoto.rejected ? 'Yes' : 'No'} />
              <Row label="Color" value={currentPhoto.tag} />
              <div className="mt-3 space-y-2 rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted,#6B645B)]">Preview image</span>
                  <span className="font-medium text-[11px] text-[var(--text,#1F1E1B)]">
                    {currentPhoto.isPreview ? `Preview #${(currentPhoto.previewOrder ?? 0) + 1}` : 'Not a preview'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                  Preview images rotate on the project overview.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className={`h-8 rounded-full border px-3 text-[11px] ${
                      currentPhoto.isPreview
                        ? 'border-[var(--border,#E1D3B9)] bg-white hover:border-[var(--text,#1F1E1B)]'
                        : 'border-[var(--basalt-700,#4A463F)] bg-[var(--basalt-700,#4A463F)] text-white hover:bg-[var(--charcoal-800,#1F1E1B)]'
                    } disabled:opacity-60`}
                    onClick={() => handleTogglePreview(currentPhoto)}
                    disabled={previewMutation.isPending}
                  >
                    {previewMutation.isPending ? 'Updating…' : currentPhoto.isPreview ? 'Remove from previews' : 'Mark as preview'}
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-full border border-[var(--border,#E1D3B9)] bg-white px-3 text-[11px] hover:border-[var(--text,#1F1E1B)] disabled:opacity-60"
                    onClick={() => handleMakePrimaryPreview(currentPhoto)}
                    disabled={previewMutation.isPending || currentPhoto.previewOrder === 0}
                  >
                    {previewMutation.isPending ? 'Updating…' : currentPhoto.previewOrder === 0 ? 'Already default' : 'Set as default'}
                  </button>
                </div>
                {previewError ? (
                  <p className="text-[10px] text-[#B42318]">{previewError}</p>
                ) : null}
              </div>
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

function MinStarRow({ value, onChange }: { value: 0 | 1 | 2 | 3 | 4 | 5; onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void }) {
  const stars = [0, 1, 2, 3, 4, 5] as const
  return (
    <div className="inline-flex items-center gap-1">
      {stars.map((s) => (
        <button key={s} className={`px-1 py-0.5 border rounded ${value >= s ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'}`} onClick={() => onChange(s)} aria-label={`Min ${s} stars`}>
          {s === 0 ? '0' : '★'.repeat(s)}
        </button>
      ))}
    </div>
  )
}

function ColorFilter({ value, onChange }: { value: 'Any' | ColorTag; onChange: (v: 'Any' | ColorTag) => void }) {
  const options: ['Any', ColorTag][] = [['Any', 'Any'], ['Red', 'Red'], ['Green', 'Green'], ['Blue', 'Blue'], ['Yellow', 'Yellow'], ['Purple', 'Purple'], ['None', 'None']] as any
  return (
    <select className="border border-[var(--border,#E1D3B9)] rounded px-2 py-1" value={value} onChange={(e) => onChange(e.target.value as any)}>
      {options.map(([k, v]) => <option key={k} value={v}>{k}</option>)}
    </select>
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

type LocalFileDescriptor = {
  file: File
  folder: string
  relativePath?: string
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
}

function makeLocalPendingItems(files: LocalFileDescriptor[]): PendingItem[] {
  if (!files.length) return []
  const baseId = Date.now().toString(36)
  return files.map(({ file, folder, relativePath }, index) => {
    const previewUrl = typeof URL === 'undefined' ? null : URL.createObjectURL(file)
    return {
      id: `local-${baseId}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      type: inferTypeFromName(file.name),
      previewUrl,
      source: 'local' as const,
      selected: true,
      size: file.size,
      file,
      meta: { folder, relativePath },
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
    return { file, folder, relativePath }
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

function PendingMiniGrid({ items, onToggle, className }: { items: PendingItem[]; onToggle: (id: string) => void; className?: string }) {
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
            >
              <input
                type="checkbox"
                checked={item.selected}
                onChange={() => onToggle(item.id)}
                className="absolute left-1 top-1 h-4 w-4 accent-[var(--charcoal-800,#1F1E1B)]"
                aria-label={`Toggle ${item.name}`}
              />
              <div className="h-16 w-full bg-[var(--sand-100,#F3EBDD)]">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} className="h-16 w-full object-cover" />
                ) : (
                  <div className="flex h-16 w-full items-center justify-center text-[10px] font-medium text-[var(--text-muted,#6B645B)]">
                    {item.type}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[9px] font-medium uppercase tracking-wide">
                <span className="text-[var(--charcoal-800,#1F1E1B)]">Pending</span>
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

function ImportSheet({
  projectId,
  onClose,
  onImport,
  folderMode,
  customFolder,
}: {
  projectId?: string
  onClose: () => void
  onImport: (args: { count: number; types: ImgType[]; dest: string }) => void
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
  const localPreviewUrlsRef = useRef<string[]>([])
  const dragDepthRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

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

  const canSubmit = !isUploadMode && selectedItems.length > 0

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

  function appendLocalDescriptors(descriptors: LocalFileDescriptor[]) {
    if (!descriptors.length) return
    const newItems = makeLocalPendingItems(descriptors)
    const newUrls = newItems.map((item) => item.previewUrl).filter((url): url is string => Boolean(url))
    if (newUrls.length) localPreviewUrlsRef.current = [...localPreviewUrlsRef.current, ...newUrls]
    setLocalItems((prev) => [...prev, ...newItems])
  }

  function startLocalFlow() {
    setMode('local')
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  async function handleLocalDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (mode === 'upload') return
    dragDepthRef.current = 0
    setIsDragging(false)
    const descriptors = await collectFilesFromDataTransfer(event.dataTransfer)
    if (!descriptors.length) return
    setMode((prev) => (prev === 'local' ? prev : 'local'))
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
      event.target.value = ''
      return
    }
    if (mode === 'upload') {
      event.target.value = ''
      return
    }
    const descriptors = buildLocalDescriptorsFromFileList(files)
    setMode((prev) => (prev === 'local' ? prev : 'local'))
    appendLocalDescriptors(descriptors)
    event.target.value = ''
  }

  function clearLocalSelection() {
    localPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    localPreviewUrlsRef.current = []
    setLocalItems([])
  }

  function toggleLocalItem(id: string) {
    setLocalItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))
  }

  function toggleHubItem(id: string) {
    setHubItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)))
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
        if (task.status === 'success' || task.status === 'error') return task
        if (task.status === 'blocked' && task.error) return task
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
      if (mode === 'local') startLocalFlow()
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

    const processQueue = async () => {
      let encounteredError = false
      for (const task of uploadTasksRef.current) {
        if (canceled) return
        if (task.status === 'success') continue
        try {
          await processTask(task)
        } catch {
          encounteredError = true
          break
        }
      }

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
    }

    processQueue()
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
        <div className="flex-1 min-h-0 px-5 pb-5 pt-2 text-sm text-[var(--text,#1F1E1B)]">
          {mode === 'choose' && (
            <div className="flex h-full flex-col justify-center gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <button type="button" onClick={startLocalFlow} className="flex flex-col items-start gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-6 text-left transition hover:border-[var(--charcoal-800,#1F1E1B)]">
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
            <div className="flex h-full min-h-0 gap-5 overflow-hidden">
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
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-[var(--charcoal-800,#1F1E1B)] px-3 py-2 font-medium text-white">Choose files…</button>
                    <button type="button" onClick={() => folderInputRef.current?.click()} className="rounded-md border border-[var(--border,#E1D3B9)] px-3 py-2">Choose folder…</button>
                  </div>
                  <div className="mt-3 text-xs text-[var(--text-muted,#6B645B)]">Or just drag & drop files and folders here.</div>
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
                      <div className="text-[11px] text-[var(--text-muted,#6B645B)]">{localSelectedItems.length}/{localItems.length}</div>
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
                                    onClick={() => toggleLocalItem(item.id)}
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
                  <div className="text-xs text-[var(--text-muted,#6B645B)]">{localSelectedItems.length} selected / {localItems.length} total</div>
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">
                  {localSelectedItems.length
                    ? `${localSelectedItems.length} item${localSelectedItems.length === 1 ? '' : 's'} across ${Math.max(1, localSelectedFolderCount)} folder${Math.max(1, localSelectedFolderCount) === 1 ? '' : 's'} • ${formatBytes(totalSelectedBytes)} pending`
                    : 'No items selected yet. Check thumbnails to include them.'}
                </div>
                <div className="mt-3 flex-1 min-h-0">
                  <PendingMiniGrid items={localItems} onToggle={toggleLocalItem} className="h-full" />
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
