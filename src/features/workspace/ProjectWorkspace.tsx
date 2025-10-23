import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { makeDemo, TOKENS, randomPlaceholderRatio } from '../../features/workspace/utils'
import type { Photo, ImgType, ColorTag } from '../../features/workspace/types'
import { TopBar, Sidebar, GridView, DetailView, EmptyState, NoResults } from '../../features/workspace/components'

const SIDEBAR_WIDTH = 288
const INSPECTOR_WIDTH = 260

export default function ProjectWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [projectName] = useState(() => `Project ${id || '—'}`)

  const [photos, setPhotos] = useState<Photo[]>(() => makeDemo())
  const [view, setView] = useState<'grid' | 'detail'>('detail')
  const [current, setCurrent] = useState(0)

  const [showJPEG, setShowJPEG] = useState(true)
  const [showRAW, setShowRAW] = useState(true)
  const [minStars, setMinStars] = useState<0 | 1 | 2 | 3 | 4 | 5>(0)
  const [onlyPicked, setOnlyPicked] = useState(false)
  const [hideRejected, setHideRejected] = useState(true)
  const [filterColor, setFilterColor] = useState<'Any' | ColorTag>('Any')

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

  // Import Sheet
  const [importOpen, setImportOpen] = useState(false)
  function handleImport({ count, types, dest }: { count: number; types: ImgType[]; dest: string }) {
    const add: Photo[] = []
    for (let i = 0; i < count; i++) {
      const t: ImgType = types[Math.floor(Math.random() * types.length)] || 'JPEG'
      const d = new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
      add.push({
        id: `new_${Date.now()}_${i}`,
        name: `NEW_${String(i + 1).padStart(4, '0')}.${t === 'RAW' ? 'ARW' : 'JPG'}`,
        type: t,
        date: d.toISOString(),
        rating: 0,
        picked: false,
        rejected: false,
        tag: 'None',
        src: null,
        placeholderRatio: randomPlaceholderRatio(),
      })
    }
    setPhotos((arr) => [...add, ...arr])
    setImportOpen(false)
  }

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

  const currentPhoto = visible[current]
  const hasAny = photos.length > 0

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
          {visible[current] ? (
            <div className="space-y-2">
              <Row label="Name" value={visible[current].name} />
              <Row label="Type" value={visible[current].type} />
              <Row label="Date" value={new Date(visible[current].date).toLocaleDateString()} />
              <Row label="Rating" value={`${visible[current].rating}★`} />
              <Row label="Flag" value={visible[current].picked ? 'Picked' : '—'} />
              <Row label="Rejected" value={visible[current].rejected ? 'Yes' : 'No'} />
              <Row label="Color" value={visible[current].tag} />
            </div>
          ) : (
            <div className="text-[var(--text-muted,#6B645B)]">No selection</div>
          )}
        </aside>
      </div>

      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} onImport={handleImport} folderMode={folderMode} customFolder={customFolder} />}
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

type PendingItem = {
  id: string
  name: string
  type: ImgType
  previewUrl?: string | null
  source: 'local' | 'hub'
  selected: boolean
  meta?: {
    folder?: string
  }
}

function makeLocalPendingItems(files: File[]): PendingItem[] {
  if (!files.length) return []
  const baseId = Date.now().toString(36)
  return files.map((file, index) => {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    const folder = path ? (path.split('/')[0] || 'Folder') : 'Loose selection'
    const previewUrl = typeof URL === 'undefined' ? null : URL.createObjectURL(file)
    return {
      id: `local-${baseId}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      type: inferTypeFromName(file.name),
      previewUrl,
      source: 'local' as const,
      selected: true,
      meta: { folder },
    }
  })
}

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
  return (
    <div className={`rounded-md border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-2${extra}`}>
      <div className="h-full overflow-y-auto pr-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {items.map((item) => (
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
              <div className="truncate px-2 py-1 text-[10px] text-[var(--text-muted,#6B645B)]">{item.name}</div>
            </label>
          ))}
        </div>
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

function ImportSheet({ onClose, onImport, folderMode, customFolder }: { onClose: () => void; onImport: (args: { count: number; types: ImgType[]; dest: string }) => void; folderMode: 'date' | 'custom'; customFolder: string }) {
  const [mode, setMode] = useState<'choose' | 'local' | 'hub'>('choose')
  const [localItems, setLocalItems] = useState<PendingItem[]>([])
  const [hubSelected, setHubSelected] = useState<Set<string>>(() => new Set())
  const [expandedHub, setExpandedHub] = useState<Set<string>>(() => new Set(IMAGE_HUB_TREE.map((node) => node.id)))
  const [ignoreDup, setIgnoreDup] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  const [hubItems, setHubItems] = useState<PendingItem[]>([])
  const localPreviewUrlsRef = useRef<string[]>([])

  const dest = folderMode === 'date' ? 'YYYY/MM/DD' : customFolder.trim() || 'Custom'

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
          items.push({
            id: itemId,
            name: asset.name,
            type: asset.type,
            previewUrl: null,
            source: 'hub',
            selected: prevSelectionMap.get(itemId) ?? true,
            meta: { folder: asset.folderPath },
          })
        })
      })
      return items
    })
  }, [hubSelected])

  const pendingItems = mode === 'hub' ? hubItems : localItems
  const selectedItems = pendingItems.filter((item) => item.selected)
  const selectedTypes = Array.from(new Set(selectedItems.map((item) => item.type))) as ImgType[]
  const selectedFolders = selectedItems.length ? new Set(selectedItems.map((item) => item.meta?.folder ?? 'Selection')) : new Set<string>()
  const selectionSummaryText = selectedItems.length
    ? `${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'} across ${Math.max(1, selectedFolders.size)} folder${Math.max(1, selectedFolders.size) === 1 ? '' : 's'}`
    : 'Nothing selected yet'
  const localSelectedItems = useMemo(() => localItems.filter((item) => item.selected), [localItems])
  const hubSelectedItems = useMemo(() => hubItems.filter((item) => item.selected), [hubItems])
  const localSelectedFolderCount = localSelectedItems.length ? new Set(localSelectedItems.map((item) => item.meta?.folder ?? 'Selection')).size : 0
  const hubSelectedFolderCount = hubSelectedItems.length ? new Set(hubSelectedItems.map((item) => item.meta?.folder ?? 'Selection')).size : 0

  const hubSelectionList = useMemo(() => {
    if (!hubSelected.size) return []
    const ids = Array.from(hubSelected).filter((id) => !hasAncestorSelected(id, hubSelected, HUB_DATA.parentMap))
    return ids.map((id) => HUB_DATA.nodeMap.get(id)?.name).filter(Boolean) as string[]
  }, [hubSelected])

  const canSubmit = selectedItems.length > 0
  const isHubMode = mode === 'hub'
  const isLocalMode = mode === 'local'
  const usesExpandedModal = mode !== 'choose'

  const localFolderGroups = useMemo(() => {
    if (!localItems.length) return []
    const map = new Map<string, { items: PendingItem[]; selected: number }>()
    localItems.forEach((item) => {
      const folder = item.meta?.folder ?? 'Loose selection'
      if (!map.has(folder)) map.set(folder, { items: [], selected: 0 })
      const entry = map.get(folder)!
      entry.items.push(item)
      if (item.selected) entry.selected += 1
    })
    return Array.from(map.entries()).map(([folder, value]) => ({
      folder,
      items: value.items,
      selected: value.selected,
      total: value.items.length,
    })).sort((a, b) => a.folder.localeCompare(b.folder))
  }, [localItems])

  function startLocalFlow() {
    setMode('local')
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  function handleLocalFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) {
      event.target.value = ''
      return
    }
    const newItems = makeLocalPendingItems(files)
    const newUrls = newItems.map((item) => item.previewUrl).filter((url): url is string => !!url)
    localPreviewUrlsRef.current = [...localPreviewUrlsRef.current, ...newUrls]
    setLocalItems((prev) => [...prev, ...newItems])
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

  function renderSummaryCard(wrapperClass: string, includeHubSelection: boolean) {
    return (
      <aside className={`${wrapperClass} flex h-full min-h-0 flex-col gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-3 text-[11px] leading-tight`}>
        <div>
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] text-[var(--text-muted,#6B645B)]">Destination</div>
          <div className="mt-1 truncate text-sm font-medium text-[var(--text,#1F1E1B)]">{dest}</div>
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
    const types = selectedTypes.length ? selectedTypes : (isHubMode ? (['RAW', 'JPEG'] as ImgType[]) : (['JPEG'] as ImgType[]))
    const count = Math.max(1, Math.min(200, selectedItems.length))
    onImport({ count, types, dest })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
      <div
        id="import-sheet"
        tabIndex={-1}
        className={`${usesExpandedModal ? 'h-[min(92vh,820px)] w-[min(95vw,1240px)]' : 'w-[760px] max-h-[90vh]'} flex min-h-0 flex-col overflow-hidden rounded-md bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E1D3B9)] shadow-2xl outline-none`}
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
                <div className="rounded-lg border border-dashed border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] p-6 text-center">
                  <div className="text-sm font-medium">Select photos or folders from your computer</div>
                  <div className="mt-1 text-xs text-[var(--text-muted,#6B645B)]">We support JPEG and RAW formats. Picking a folder pulls in everything inside.</div>
                  <div className="mt-4 flex justify-center gap-3 text-sm">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md bg-[var(--charcoal-800,#1F1E1B)] px-3 py-2 font-medium text-white">Choose files…</button>
                    <button type="button" onClick={() => folderInputRef.current?.click()} className="rounded-md border border-[var(--border,#E1D3B9)] px-3 py-2">Choose folder…</button>
                  </div>
                </div>
                {localItems.length > 0 && (
                  <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
                    <div className="flex items-center justify-between px-4 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Selected files & folders</div>
                      <div className="text-[11px] text-[var(--text-muted,#6B645B)]">{localSelectedItems.length}/{localItems.length}</div>
                    </div>
                    <div className="mt-2 flex-1 overflow-y-auto px-4 pb-3">
                      <ul className="space-y-3 text-[11px] text-[var(--text-muted,#6B645B)]">
                        {localFolderGroups.map(({ folder, items, selected, total }) => (
                          <li key={folder}>
                            <div className="flex items-center justify-between text-[var(--text,#1F1E1B)]">
                              <span className="text-xs font-medium">{folder}</span>
                              <span>{selected}/{total}</span>
                            </div>
                            <ul className="mt-1 space-y-1">
                              {items.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    onClick={() => toggleLocalItem(item.id)}
                                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left transition ${item.selected ? 'bg-[var(--sand-50,#FBF7EF)] text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)]'}`}
                                  >
                                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-[var(--border,#E1D3B9)] text-[10px]">
                                      {item.selected ? '✓' : ''}
                                    </span>
                                    <span className="truncate">{item.name}</span>
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
                    ? `${localSelectedItems.length} item${localSelectedItems.length === 1 ? '' : 's'} across ${Math.max(1, localSelectedFolderCount)} folder${Math.max(1, localSelectedFolderCount) === 1 ? '' : 's'}`
                    : 'No items selected yet. Check thumbnails to include them.'}
                </div>
                <div className="mt-3 flex-1 min-h-0">
                  <PendingMiniGrid items={localItems} onToggle={toggleLocalItem} className="h-full" />
                </div>
                <div className="mt-3 flex-shrink-0 text-xs">
                  <button type="button" onClick={clearLocalSelection} className="text-[var(--river-500,#6B7C7A)] underline">Clear selection</button>
                </div>
              </div>
              {renderSummaryCard('w-56 flex-shrink-0', false)}
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
                      ? `${hubSelectedItems.length} asset${hubSelectedItems.length === 1 ? '' : 's'} across ${Math.max(1, hubSelectedFolderCount)} folder${Math.max(1, hubSelectedFolderCount) === 1 ? '' : 's'}`
                      : 'No assets selected yet. Check thumbnails to include them.'}
                  </div>
                  <div className="mt-3 flex-1 min-h-0">
                    <PendingMiniGrid items={hubItems} onToggle={toggleHubItem} className="h-full" />
                  </div>
                </div>
              </div>
              {renderSummaryCard('w-56 flex-shrink-0', true)}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--border,#E1D3B9)] px-5 py-4 text-sm">
          {mode !== 'choose' && (
            <button onClick={() => setMode('choose')} className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]">Back</button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]">Cancel</button>
          {mode !== 'choose' && (
            <button onClick={submit} disabled={!canSubmit} className={`px-3 py-1.5 rounded text-white ${canSubmit ? 'bg-[var(--basalt-700,#4A463F)]' : 'bg-[var(--sand-300,#E1D3B9)] cursor-not-allowed'}`}>Import</button>
          )}
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple onChange={handleLocalFilesChange} className="hidden" accept="image/*" />
      <input ref={folderInputRef} type="file" multiple onChange={handleLocalFilesChange} className="hidden" accept="image/*" />
    </div>
  )
}
