import React, { useCallback, useEffect, useState } from 'react'
import { RawPlaceholder, RawPlaceholderFrame } from '../../components/RawPlaceholder'
import { TOKENS } from './utils'
import type { Photo, ImgType, ColorTag } from './types'

const COLOR_MAP: Record<ColorTag, string> = {
  None: '#E5E7EB',
  Red: '#F87171',
  Green: '#34D399',
  Blue: '#60A5FA',
  Yellow: '#FBBF24',
  Purple: '#C084FC',
}

export type DateTreeDayNode = {
  id: string
  label: string
  count: number
  year: string
  month: string
  day: string
  parentYearId: string
  parentMonthId: string
}

export type DateTreeMonthNode = {
  id: string
  label: string
  count: number
  year: string
  month: string
  parentYearId: string
  days: DateTreeDayNode[]
}

export type DateTreeYearNode = {
  id: string
  label: string
  count: number
  year: string
  months: DateTreeMonthNode[]
}

function setsAreEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

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

function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span
      className={`inline-flex min-w-[1.75rem] justify-center rounded-full bg-[var(--sand-100,#F3EBDD)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted,#6B645B)]${
        className ? ` ${className}` : ''
      }`}
    >
      {count}
    </span>
  )
}

export function Sidebar({
  dateTree,
  onOpenImport,
  onSelectDay,
  selectedDayKey,
  selectedDay,
  onClearDateFilter,
}: {
  dateTree: DateTreeYearNode[]
  onOpenImport: () => void
  onSelectDay: (day: DateTreeDayNode) => void
  selectedDayKey: string | null
  selectedDay: DateTreeDayNode | null
  onClearDateFilter: () => void
}) {
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const allowedYears = new Set(dateTree.map((year) => year.id))
    setExpandedYears((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowedYears.has(id)) next.add(id)
      })
      if (!next.size && dateTree[0]) next.add(dateTree[0].id)
      if (setsAreEqual(prev, next)) return prev
      return next
    })

    const allowedMonths = new Set<string>()
    dateTree.forEach((year) => year.months.forEach((month) => allowedMonths.add(month.id)))
    setExpandedMonths((prev) => {
      const next = new Set<string>()
      prev.forEach((id) => {
        if (allowedMonths.has(id)) next.add(id)
      })
      if (setsAreEqual(prev, next)) return prev
      return next
    })
  }, [dateTree])

  useEffect(() => {
    if (!selectedDay) return
    setExpandedYears((prev) => {
      if (prev.has(selectedDay.parentYearId)) return prev
      const next = new Set(prev)
      next.add(selectedDay.parentYearId)
      return next
    })
    setExpandedMonths((prev) => {
      if (prev.has(selectedDay.parentMonthId)) return prev
      const next = new Set(prev)
      next.add(selectedDay.parentMonthId)
      return next
    })
  }, [selectedDay])

  const toggleYear = useCallback((yearId: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(yearId)) next.delete(yearId)
      else next.add(yearId)
      return next
    })
  }, [])

  const toggleMonth = useCallback((monthId: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthId)) next.delete(monthId)
      else next.add(monthId)
      return next
    })
  }, [])

  const hasSelection = Boolean(selectedDayKey)

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 text-xs">
      <button onClick={onOpenImport} className="w-full mb-3 px-3 py-2 rounded-md text-xs font-medium" style={{ backgroundColor: TOKENS.clay500, color: '#fff' }}>
        Import photos…
      </button>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted,#6B645B)]">Date folders</div>
        {hasSelection ? (
          <button type="button" onClick={onClearDateFilter} className="text-[11px] text-[var(--river-500,#6B7C7A)] hover:underline">
            Clear
          </button>
        ) : null}
      </div>
      {selectedDay ? (
        <div className="mb-2 rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-2 py-1 text-[11px] text-[var(--text,#1F1E1B)]">
          Viewing {selectedDay.label}
        </div>
      ) : null}
      <div className="folder-tree flex-1 min-h-0 overflow-y-auto pr-1">
        {dateTree.length ? (
          <ul className="space-y-1">
            {dateTree.map((year) => {
              const expanded = expandedYears.has(year.id)
              const canExpand = year.months.length > 0
              return (
                <li key={year.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (canExpand) toggleYear(year.id)
                    }}
                    aria-expanded={canExpand ? expanded : undefined}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${canExpand ? 'hover:bg-[var(--sand-50,#FBF7EF)]' : ''}`}
                  >
                    <span className="inline-flex w-4 justify-center text-[11px] text-[var(--text-muted,#6B645B)]">
                      {canExpand ? (expanded ? '▾' : '▸') : ''}
                    </span>
                    <span className="flex-1 truncate font-medium text-[var(--text,#1F1E1B)]">{year.label}</span>
                    <CountBadge count={year.count} />
                  </button>
                  {expanded && canExpand ? (
                    <ul className="mt-1 space-y-1 pl-4">
                      {year.months.map((month) => {
                        const monthExpanded = expandedMonths.has(month.id)
                        const monthHasDays = month.days.length > 0
                        return (
                          <li key={month.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (monthHasDays) toggleMonth(month.id)
                              }}
                              aria-expanded={monthHasDays ? monthExpanded : undefined}
                              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${monthHasDays ? 'hover:bg-[var(--sand-50,#FBF7EF)]' : ''}`}
                            >
                              <span className="inline-flex w-4 justify-center text-[11px] text-[var(--text-muted,#6B645B)]">
                                {monthHasDays ? (monthExpanded ? '▾' : '▸') : ''}
                              </span>
                              <span className="flex-1 truncate text-[var(--text,#1F1E1B)]">{month.label}</span>
                              <CountBadge count={month.count} />
                            </button>
                            {monthExpanded && monthHasDays ? (
                              <ul className="mt-1 space-y-1 pl-4">
                                {month.days.map((day) => {
                                  const isSelected = day.id === selectedDayKey
                                  return (
                                    <li key={day.id}>
                                      <button
                                        type="button"
                                        onClick={() => onSelectDay(day)}
                                        aria-pressed={isSelected}
                                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                                          isSelected
                                            ? 'border border-[var(--charcoal-800,#1F1E1B)] bg-[var(--sand-100,#F3EBDD)] font-semibold text-[var(--text,#1F1E1B)]'
                                            : 'border border-transparent text-[var(--text,#1F1E1B)] hover:border-[var(--sand-300,#E1D3B9)] hover:bg-[var(--sand-50,#FBF7EF)]'
                                        }`}
                                      >
                                        <span className="truncate">{day.label}</span>
                                        <CountBadge count={day.count} />
                                      </button>
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-2 py-3 text-[11px] text-[var(--text-muted,#6B645B)]">
            No photos yet.
          </div>
        )}
      </div>
    </aside>
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
        <div key={p.id} className="group border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] flex flex-col">
          <div className="relative aspect-square w-full overflow-hidden bg-[var(--placeholder-bg-beige,#F3EBDD)] flex items-center justify-center">
            <button
              className="absolute inset-0 flex items-center justify-center focus:outline-none"
              type="button"
              onDoubleClick={() => onOpen(idx)}
              aria-label={`Open ${p.name || 'photo'}`}
            >
              {p.thumbSrc ? (
                <img src={p.thumbSrc} alt={p.name} className="h-full w-full object-contain" />
              ) : (
                <RawPlaceholder ratio={p.placeholderRatio} title={p.name || 'Placeholder image'} fit="contain" />
              )}
            </button>
            <ThumbContent p={p} />
          </div>
          <ThumbOverlay p={p} twoLine={twoLine} />
        </div>
      ))}
    </div>
  )
}

export function DetailView({ items, index, setIndex, className = '' }: { items: Photo[]; index: number; setIndex: (n: number) => void; className?: string }) {
  const cur = items[index]
  const canPrev = index > 0
  const canNext = index < items.length - 1
  const STRIP_H = 136
  const THUMB = 96

  const rootClass = ['grid', 'h-full', 'min-h-0', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} style={{ gridTemplateRows: `minmax(0,1fr) ${STRIP_H}px` }}>
      <div className="relative min-h-0 overflow-hidden">
        {cur ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--placeholder-bg-beige,#F3EBDD)] p-6">
              {cur.previewSrc ? (
                <img src={cur.previewSrc} alt={cur.name} className="max-h-full max-w-full object-contain" />
              ) : cur.thumbSrc ? (
                <img src={cur.thumbSrc} alt={cur.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <RawPlaceholder ratio={cur.placeholderRatio} title={cur.name || 'Placeholder image'} fit="contain" />
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 bg-[var(--charcoal-800,#1F1E1B)] text-white text-xs px-3 py-1.5 rounded shadow flex items-center gap-2">
              <button disabled={!canPrev} onClick={() => setIndex(Math.max(0, index - 1))} className="px-2 py-0.5 rounded border border-white/30 disabled:opacity-40">←</button>
              <span className="opacity-80">{index + 1}/{items.length}</span>
              <button disabled={!canNext} onClick={() => setIndex(Math.min(items.length - 1, index + 1))} className="px-2 py-0.5 rounded border border-white/30 disabled:opacity-40">→</button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <RawPlaceholderFrame ratio="16x9" className="w-[380px] h-[240px] rounded-xl border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
          </div>
        )}
      </div>

      <div className="thumb-strip border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] relative">
        {items.length === 0 ? (
          <div className="h-full grid place-items-center">
            <RawPlaceholderFrame ratio="3x2" className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
          </div>
        ) : (
          <div className="flex items-end gap-6 pr-6">
            {items.map((p, i) => (
              <div key={p.id} className="flex shrink-0 w-[96px] max-w-[96px] flex-col items-stretch text-[10px] leading-tight">
                <button
                  onClick={() => setIndex(i)}
                  className={`relative overflow-hidden rounded border focus:outline-none focus:ring-2 focus:ring-[var(--sand200,#E8DFC9)] ${i === index ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)]'}`}
                  style={{ width: THUMB, height: THUMB }}
                  aria-label={`View ${p.name}`}
                >
                  <span className="absolute top-1 left-1 rounded bg-white/90 px-1 py-[2px] text-[9px] font-medium border border-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)]">
                    {p.type}
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--placeholder-bg-beige,#F3EBDD)]">
                    {p.thumbSrc ? (
                      <img src={p.thumbSrc} alt={p.name} className="h-full w-full object-contain" />
                    ) : (
                      <RawPlaceholder ratio={p.placeholderRatio} title={p.name || 'Placeholder image'} fit="contain" />
                    )}
                  </div>
                </button>
                <div className="mt-1 truncate text-center font-medium text-[var(--text,#1F1E1B)]">{p.name}</div>
                <div className="mt-1 rounded border border-[var(--border,#E1D3B9)] bg-[var(--sand50,#F9F4EB)] px-1 py-0.5">
                  <div className="flex flex-col gap-0.5 text-[9px]">
                    <span className="flex items-center justify-between gap-1">
                      <span className="font-medium">Rating</span>
                      <span>{p.rating}★</span>
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span className="font-medium">Color</span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: COLOR_MAP[p.tag] }} aria-hidden />
                        <span className="truncate">{p.tag}</span>
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span className="font-medium">Status</span>
                      <span className={p.rejected ? 'text-[#B91C1C]' : p.picked ? 'text-[#166534]' : 'text-[var(--text-muted,#6B645B)]'}>
                        {p.rejected ? 'Rejected' : p.picked ? 'Picked' : '—'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ----- Overlays, Filters, etc. -----
export function ThumbContent({ p }: { p: Photo }) {
  return (
    <div className="pointer-events-none absolute top-1 left-1 flex items-center gap-1 text-[10px]">
      <span className="px-1 py-0.5 bg-white/85 border border-[var(--border,#E1D3B9)] rounded">{p.type}</span>
      <span className="w-2.5 h-2.5 rounded-full border border-[var(--border,#E1D3B9)]" style={{ backgroundColor: COLOR_MAP[p.tag] }} aria-hidden />
    </div>
  )
}

export function ThumbOverlay({ p, twoLine }: { p: Photo; twoLine?: boolean }) {
  // leben via DOM-Custom-Events (gleiche Mechanik wie im Monolith)
  const emit = (name: 'rate' | 'pick' | 'reject' | 'color', detail: any) => {
    const ev = new CustomEvent(name, { detail }); window.dispatchEvent(ev)
  }
  return (
    <div className="border-t border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-[11px]">
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
      <div className="inline-flex flex-col items-center gap-4 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <RawPlaceholderFrame ratio="3x2" className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]" title="Placeholder image" />
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
