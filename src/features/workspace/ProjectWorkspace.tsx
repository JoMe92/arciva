import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { makeDemo, TOKENS, ph } from '../../features/workspace/utils'
import type { Photo, ImgType, ColorTag } from '../../features/workspace/types'
import { TopBar, Sidebar, GridView, DetailView, EmptyState, NoResults } from '../../features/workspace/components'

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
        src: ph(1200, 800, `NEW_${i + 1}@${dest}`),
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
    <div className="min-h-screen bg-[var(--surface-subtle,#FBF7EF)] text-[var(--text,#1F1E1B)]">
      <TopBar projectName={projectName} onBack={goBack} />

      <div className="grid grid-cols-[240px_1fr_260px] gap-0 min-h-[80vh]">
        <Sidebar
          dateTree={dateTree as any}
          onOpenImport={() => setImportOpen(true)}
          folderMode={folderMode}
          setFolderMode={setFolderMode}
          customFolder={customFolder}
          setCustomFolder={setCustomFolder}
        />

        <main ref={contentRef} className="bg-[var(--surface,#FFFFFF)] border-r border-[var(--border,#E1D3B9)] relative">
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

          {!hasAny ? (
            <EmptyState onImport={() => setImportOpen(true)} />
          ) : visible.length === 0 ? (
            <NoResults onReset={() => { setMinStars(0); setFilterColor('Any'); setShowJPEG(true); setShowRAW(true); setOnlyPicked(false); setHideRejected(true) }} />
          ) : view === 'grid' ? (
            <GridView items={visible} size={gridSize} gap={GAP} containerWidth={contentW} onOpen={(idx) => { setCurrent(idx); setView('detail') }} />
          ) : (
            <DetailView items={visible} index={current} setIndex={setCurrent} />
          )}
        </main>

        <aside className="bg-[var(--surface,#FFFFFF)] p-3 text-xs">
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

function ImportSheet({ onClose, onImport, folderMode, customFolder }: { onClose: () => void; onImport: (args: { count: number; types: ImgType[]; dest: string }) => void; folderMode: 'date' | 'custom'; customFolder: string }) {
  const [count, setCount] = useState(24)
  const [jpeg, setJpeg] = useState(true)
  const [raw, setRaw] = useState(true)
  const [ignoreDup, setIgnoreDup] = useState(true)
  const dest = folderMode === 'date' ? 'YYYY/MM/DD' : customFolder.trim() || 'Custom'

  useEffect(() => { (document.getElementById('import-sheet') as HTMLDivElement | null)?.focus() }, [])

  function submit() {
    const types: ImgType[] = [jpeg && 'JPEG', raw && 'RAW'].filter(Boolean) as ImgType[]
    if (types.length === 0) return alert('Select at least one type (JPEG/RAW)')
    onImport({ count: Math.max(1, Math.min(200, count)), types, dest })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20">
      <div id="import-sheet" tabIndex={-1} className="w-[720px] rounded-md bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E1D3B9)] shadow-2xl p-4 outline-none">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: TOKENS.clay500 }} />
            <div className="text-sm font-semibold">Import photos</div>
          </div>
          <button onClick={onClose} className="px-2 py-1 rounded border border-[var(--border,#E1D3B9)]" aria-label="Close">Close</button>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium mb-2">Source</div>
            <ul className="space-y-2">
              <li><label className="flex items-center gap-2"><input type="radio" name="src" defaultChecked className="accent-[var(--text,#1F1E1B)]" />Camera / SD</label></li>
              <li><label className="flex items-center gap-2"><input type="radio" name="src" className="accent-[var(--text,#1F1E1B)]" />Folder…</label></li>
              <li><label className="flex items-center gap-2"><input type="radio" name="src" className="accent-[var(--text,#1F1E1B)]" />Recent Source</label></li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-2">Types</div>
            <label className="flex items-center gap-2 mb-1"><input type="checkbox" checked={jpeg} onChange={(e) => setJpeg(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" />JPEG</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={raw} onChange={(e) => setRaw(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" />RAW</label>
            <div className="mt-3 font-medium mb-1">Duplicates</div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={ignoreDup} onChange={(e) => setIgnoreDup(e.target.checked)} className="accent-[var(--text,#1F1E1B)]" />Ignore duplicates</label>
          </div>
          <div>
            <div className="font-medium mb-2">Destination</div>
            <div className="border rounded p-2 text-xs">{dest}</div>
            <div className="mt-3 font-medium mb-1">Count</div>
            <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24 border rounded px-2 py-1" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-[var(--border,#E1D3B9)]">Cancel</button>
          <button onClick={submit} className="px-3 py-1.5 rounded bg-[var(--basalt-700,#4A463F)] text-white">Import</button>
        </div>
      </div>
    </div>
  )
}
