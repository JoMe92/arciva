import React, { useEffect, useMemo, useRef, useState } from 'react'
import { TOKENS } from './utils'
import type { Photo, ImgType, ColorTag } from './types'

// Brand
export function StoneTrailIcon({ size = 28, title = 'Stone Trail', className = '' }: { size?: number; title?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className={'block ' + className}>
      <ellipse cx={7} cy={16} rx={2.6} ry={2} fill={TOKENS.clay500} />
      <ellipse cx={12} cy={12} rx={2.2} ry={1.7} fill={TOKENS.sand500} />
      <ellipse cx={16.5} cy={8.5} rx={1.9} ry={1.5} fill={TOKENS.basalt700} />
    </svg>
  )
}

export function Motif({ className = '', dot = TOKENS.clay500, bar = TOKENS.basalt700 }: { className?: string; dot?: string; bar?: string }) {
  return (
    <div className={'relative ' + className} aria-hidden>
      <div style={{ position: 'absolute', left: 12, bottom: 12, width: 3, height: 28, background: bar, borderRadius: 2, opacity: 0.9 }} />
      <div style={{ position: 'absolute', right: 12, top: 12, width: 8, height: 8, background: dot, borderRadius: 9999, opacity: 0.9 }} />
    </div>
  )
}

export function TopBar({ projectName, onBack }: { projectName: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface,#FFFFFF)] border-b border-[var(--border,#E1D3B9)] sticky top-0 z-40">
      <StoneTrailIcon size={28} />
      <div className="text-sm opacity-80">{projectName}</div>
      <div className="ml-auto flex items-center gap-2 text-xs">
        <button onClick={onBack} className="px-2 py-1 rounded border border-[var(--border,#E1D3B9)]" aria-label="Back to Projects">← Projects</button>
      </div>
    </div>
  )
}

export function Sidebar({
  dateTree, onOpenImport, folderMode, setFolderMode, customFolder, setCustomFolder,
}: {
  dateTree: { name: string; children?: any[] }[]
  onOpenImport: () => void
  folderMode: 'date' | 'custom'
  setFolderMode: (m: 'date' | 'custom') => void
  customFolder: string
  setCustomFolder: (s: string) => void
}) {
  return (
    <aside className="border-r border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 text-xs">
      <button onClick={onOpenImport} className="w-full mb-3 px-3 py-2 rounded-md text-xs font-medium" style={{ backgroundColor: TOKENS.clay500, color: '#fff' }}>
        Import photos…
      </button>
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted,#6B645B)] mb-1">Destination</div>
        <div className="space-y-2">
          <label className="block">
            <input type="radio" name="dest" checked={folderMode === 'date'} onChange={() => setFolderMode('date')} className="accent-[var(--text,#1F1E1B)]" /> Auto (YYYY/MM/DD)
          </label>
          <label className="block">
            <input type="radio" name="dest" checked={folderMode === 'custom'} onChange={() => setFolderMode('custom')} className="accent-[var(--text,#1F1E1B)]" /> Custom
          </label>
          {folderMode === 'custom' && (
            <input value={customFolder} onChange={(e) => setCustomFolder(e.target.value)} className="mt-1 w-full rounded border border-[var(--border,#E1D3B9)] px-2 py-1" placeholder="Folder name" />
          )}
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted,#6B645B)] mb-1">Folders (virtual)</div>
        <Tree nodes={dateTree} />
      </div>
    </aside>
  )
}

export function Tree({ nodes }: { nodes: { name: string; children?: { name: string; children?: any[] }[] }[] }) {
  return (
    <ul className="space-y-1">
      {nodes.map((n) => (
        <li key={n.name}>
          <details open><summary className="cursor-pointer select-none">{n.name}</summary>
            {n.children && <div className="pl-4 mt-1"><Tree nodes={n.children as any} /></div>}
          </details>
        </li>
      ))}
    </ul>
  )
}

// ----- Grid & Detail -----
export function computeCols(containerWidth: number, size: number, gap: number) {
  return Math.max(1, Math.floor((containerWidth + gap) / (size + gap)))
}

export function GridView({
  items, size, gap = 12, containerWidth, onOpen,
}: { items: Photo[]; size: number; gap?: number; containerWidth: number; onOpen: (idx: number) => void }) {
  const cols = computeCols(containerWidth, size, gap)
  const twoLine = cols >= 4
  const template = `repeat(auto-fill, minmax(${size}px, 1fr))`
  return (
    <div className="p-3 grid" style={{ gridTemplateColumns: template, gap }}>
      {items.map((p, idx) => (
        <div key={p.id} className="relative group border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
          <div className="aspect-square w-full overflow-hidden" role="button" tabIndex={0} onDoubleClick={() => onOpen(idx)}>
            <img src={p.src} alt={p.name} className="h-full w-full object-cover" />
          </div>
          <ThumbContent p={p} />
          <ThumbOverlay p={p} twoLine={twoLine} />
        </div>
      ))}
    </div>
  )
}

export function DetailView({ items, index, setIndex }: { items: Photo[]; index: number; setIndex: (n: number) => void }) {
  const cur = items[index]
  const canPrev = index > 0
  const canNext = index < items.length - 1
  const STRIP_H = 128
  const THUMB = 96

  return (
    <div className={`h-full grid`} style={{ gridTemplateRows: `minmax(0,1fr) ${STRIP_H}px` }}>
      <div className="relative">
        {cur ? (
          <>
            <img src={cur.src} alt={cur.name} className="absolute inset-0 h-full w-full object-contain" />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 bg-[var(--charcoal-800,#1F1E1B)] text-white text-xs px-3 py-1.5 rounded shadow flex items-center gap-2">
              <button disabled={!canPrev} onClick={() => setIndex(Math.max(0, index - 1))} className="px-2 py-0.5 rounded border border-white/30 disabled:opacity-40">←</button>
              <span className="opacity-80">{index + 1}/{items.length}</span>
              <button disabled={!canNext} onClick={() => setIndex(Math.min(items.length - 1, index + 1))} className="px-2 py-0.5 rounded border border-white/30 disabled:opacity-40">→</button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative w-[380px] h-[240px] rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
              <Motif className="absolute inset-0" />
              <div style={{ position: 'absolute', left: 14, bottom: 10, width: 4, height: 44, background: TOKENS.basalt700, borderRadius: 2 }} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border,#E1D3B9)] overflow-x-auto whitespace-nowrap p-3 bg-[var(--surface,#FFFFFF)] relative">
        {items.length === 0 ? (
          <div className="h-full grid place-items-center">
            <div className="relative w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
              <Motif className="absolute inset-0" />
              <div style={{ position: 'absolute', left: 10, bottom: 8, width: 4, height: 36, background: TOKENS.basalt700, borderRadius: 2 }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-8">
            {items.map((p, i) => (
              <button key={p.id} onClick={() => setIndex(i)} className={`relative border ${i === index ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'} rounded`} style={{ width: THUMB, height: THUMB }}>
                <img src={p.src} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----- Overlays, Filters, etc. -----
export function ThumbContent({ p }: { p: Photo }) {
  const colorMap: Record<ColorTag, string> = { None: '#E5E7EB', Red: '#F87171', Green: '#34D399', Blue: '#60A5FA', Yellow: '#FBBF24', Purple: '#C084FC' }
  return (
    <div className="absolute top-1 left-1 flex items-center gap-1 text-[10px]">
      <span className="px-1 py-0.5 bg-white/85 border border-[var(--border,#E1D3B9)] rounded">{p.type}</span>
      <span className="w-2.5 h-2.5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: colorMap[p.tag] }} aria-hidden />
    </div>
  )
}

export function ThumbOverlay({ p, twoLine }: { p: Photo; twoLine?: boolean }) {
  // leben via DOM-Custom-Events (gleiche Mechanik wie im Monolith)
  const emit = (name: 'rate' | 'pick' | 'reject' | 'color', detail: any) => {
    const ev = new CustomEvent(name, { detail }); window.dispatchEvent(ev)
  }
  return (
    <div className={`absolute inset-x-0 bottom-0 bg-white/85 backdrop-blur border-t border-[var(--border,#E1D3B9)] px-2 py-1 text-[11px]`}>
      {twoLine ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2"><span className="truncate">{p.name}</span><StarRow value={p.rating} onChange={(r) => emit('rate', { id: p.id, r })} /></div>
          <div className="flex items-center justify-end gap-2">
            <button className={`px-1 border rounded ${p.picked ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('pick', { id: p.id })} title="Pick (P)">P</button>
            <button className={`px-1 border rounded ${p.rejected ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('reject', { id: p.id })} title="Reject (X)">X</button>
            <ColorSwatch value={p.tag} onPick={(t) => emit('color', { id: p.id, t })} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="truncate mr-2">{p.name}</span>
          <div className="flex items-center gap-2">
            <button className={`px-1 border rounded ${p.picked ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('pick', { id: p.id })} title="Pick (P)">P</button>
            <button className={`px-1 border rounded ${p.rejected ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`} onClick={() => emit('reject', { id: p.id })} title="Reject (X)">X</button>
            <StarRow value={p.rating} onChange={(r) => emit('rate', { id: p.id, r })} />
            <ColorSwatch value={p.tag} onPick={(t) => emit('color', { id: p.id, t })} />
          </div>
        </div>
      )}
    </div>
  )
}

export function StarRow({ value, onChange }: { value: number; onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void }) {
  const stars = [1, 2, 3, 4, 5] as const
  return (
    <div className="inline-flex items-center gap-1">
      {stars.map((s) => (
        <button key={s} className={`px-1 py-0.5 border rounded ${value >= s ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'}`} onClick={() => onChange(s)} aria-label={`Rate ${s} stars`}>
          ★
        </button>
      ))}
    </div>
  )
}

export function ColorSwatch({ value, onPick }: { value: ColorTag; onPick: (t: ColorTag) => void }) {
  const map: Record<ColorTag, string> = { None: '#E5E7EB', Red: '#F87171', Green: '#34D399', Blue: '#60A5FA', Yellow: '#FBBF24', Purple: '#C084FC' }
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button aria-label={`Color ${value}`} title={`Color ${value}`} className="w-5 h-5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: map[value] }} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-[var(--border,#E1D3B9)] rounded shadow p-2 grid grid-cols-6 gap-1 z-10">
          {(Object.keys(map) as ColorTag[]).map((k) => (
            <button key={k} aria-label={k} title={k} className="w-5 h-5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: map[k] }} onClick={() => { onPick(k); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

export function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] relative">
        <Motif className="absolute inset-0 pointer-events-none" />
        <div style={{ position: 'absolute', left: 16, bottom: 12, width: 5, height: 48, background: TOKENS.basalt700, borderRadius: 2, opacity: 0.9 }} />
        <div className="text-base font-semibold">Start your project</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">Import photos to begin. You can auto-organize by date (YYYY/MM/DD) or choose a custom folder name.</div>
        <button onClick={onImport} className="mt-1 px-3 py-2 rounded-md text-xs font-medium" style={{ backgroundColor: TOKENS.clay500, color: '#fff' }}>
          Import photos…
        </button>
      </div>
    </div>
  )
}

export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <div className="text-base font-semibold">No matches</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">Your filters hide all photos. Try lowering the minimum rating or clearing the color/type filters.</div>
        <button onClick={onReset} className="mt-1 px-3 py-2 rounded-md border border-[var(--border,#E1D3B9)] text-xs">Reset filters</button>
      </div>
    </div>
  )
}
