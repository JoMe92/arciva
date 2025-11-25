import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import DialogHeader from '../../../components/DialogHeader'
import type { WorkspaceFilterControls, ColorTag } from '../types'
import { CountBadge } from './Badges'

export const FILTERS_DIALOG_ID = 'workspace-filters-dialog'
export const SHORTCUTS_LEGEND_ID = 'shortcuts-legend'

type OverlayDialogProps = {
    id?: string
    title: string
    onClose: () => void
    headerAction?: React.ReactNode
    children: React.ReactNode
    maxWidthClass?: string
    anchorRect?: DOMRect | null
}

export function OverlayDialog({ id, title, onClose, headerAction, children, maxWidthClass = 'max-w-md', anchorRect }: OverlayDialogProps) {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [onClose])

    const anchored = Boolean(anchorRect)
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
    const anchorStyle = anchorRect
        ? {
            position: 'absolute' as const,
            top: Math.min(anchorRect.bottom + 12, viewportHeight - 24),
            right: Math.max(16, viewportWidth - anchorRect.right),
            maxHeight: 'calc(100vh - 48px)',
        }
        : undefined

    return createPortal(
        <div
            className={`fixed inset-0 z-[70] bg-black/20 px-4 py-8 ${anchored ? '' : 'flex items-center justify-center'}`}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <div
                id={id}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`w-full ${maxWidthClass} rounded-2xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] text-[12px] shadow-xl`}
                style={anchorStyle}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <DialogHeader title={title} onClose={onClose} actions={headerAction} closeLabel={`Close ${title}`} />
                <div className="px-6 py-4">{children}</div>
            </div>
        </div>,
        document.body,
    )
}

export function FiltersDialog({ controls, onReset, onClose, anchorRect }: { controls: WorkspaceFilterControls; onReset: () => void; onClose: () => void; anchorRect?: DOMRect | null }) {
    return (
        <OverlayDialog
            id={FILTERS_DIALOG_ID}
            title="Filters"
            onClose={onClose}
            headerAction={
                <button type="button" onClick={onReset} className="text-[11px] font-medium text-[var(--river-500,#6B7C7A)] hover:underline">
                    Reset
                </button>
            }
            anchorRect={anchorRect}
        >
            {controls.dateFilterActive ? (
                <div className="mb-3 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--sand-50,#FBF7EF)] px-3 py-2">
                    <div className="text-[11px] font-semibold text-[var(--text,#1F1E1B)]">Date</div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-muted,#6B645B)]">
                        <span className="truncate">{controls.selectedDayLabel ?? 'Custom date range'}</span>
                        <button type="button" onClick={() => { controls.clearDateFilter(); onClose() }} className="font-medium text-[var(--river-500,#6B7C7A)] hover:underline">
                            Clear
                        </button>
                    </div>
                </div>
            ) : null}
            <div className="space-y-3">
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Rating</div>
                    <MinStarRow value={controls.minStars} onChange={controls.setMinStars} />
                </div>
                <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted,#6B645B)]">Color</div>
                    <ColorFilter value={controls.filterColor} onChange={controls.setFilterColor} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
                        <input type="checkbox" checked={controls.showJPEG} onChange={(event) => controls.setShowJPEG(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
                        JPEG
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
                        <input type="checkbox" checked={controls.showRAW} onChange={(event) => controls.setShowRAW(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
                        RAW
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
                        <input type="checkbox" checked={controls.onlyPicked} onChange={(event) => controls.setOnlyPicked(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
                        Picks only
                    </label>
                    <label className="inline-flex items-center gap-2 rounded-full border border-[var(--border,#E1D3B9)] px-3 py-1">
                        <input type="checkbox" checked={controls.hideRejected} onChange={(event) => controls.setHideRejected(event.target.checked)} className="accent-[var(--text,#1F1E1B)]" />
                        Hide rejects
                    </label>
                </div>
            </div>
        </OverlayDialog>
    )
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
    { keys: 'G', description: 'Switch to the grid view' },
    { keys: 'D', description: 'Open detail view' },
    { keys: 'P', description: 'Toggle pick for the selection' },
    { keys: 'X', description: 'Reject the selected assets' },
    { keys: '1-5', description: 'Apply a star rating' },
    { keys: '6 / 7 / 8 / 9 / 0', description: 'Apply color labels (Red, Yellow, Green, Blue, Purple)' },
    { keys: 'Left / Right arrows', description: 'Move between photos' },
    { keys: 'Alt + [ / ]', description: 'Collapse or expand the date rail' },
]

export function ShortcutsDialog({ onClose, anchorRect }: { onClose: () => void; anchorRect?: DOMRect | null }) {
    return (
        <OverlayDialog id={SHORTCUTS_LEGEND_ID} title="Keyboard shortcuts" onClose={onClose} maxWidthClass="max-w-2xl" anchorRect={anchorRect}>
            <ul className="grid gap-2 text-[11px] sm:grid-cols-2">
                {SHORTCUTS.map((shortcut) => (
                    <li
                        key={shortcut.keys}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border,#E1D3B9)] bg-[var(--surface-subtle,#FBF7EF)] px-3 py-2"
                    >
                        <span className="font-mono text-[11px] text-[var(--text-muted,#6B645B)]">{shortcut.keys}</span>
                        <span className="text-right text-[var(--text,#1F1E1B)]">{shortcut.description}</span>
                    </li>
                ))}
            </ul>
        </OverlayDialog>
    )
}

function MinStarRow({ value, onChange }: { value: 0 | 1 | 2 | 3 | 4 | 5; onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void }) {
    const stars = [0, 1, 2, 3, 4, 5] as const
    return (
        <div className="inline-flex items-center gap-1">
            {stars.map((s) => (
                <button
                    key={s}
                    type="button"
                    className={`rounded-full px-2 py-0.5 text-[11px] ${value >= s ? 'border border-[var(--text,#1F1E1B)] text-[var(--text,#1F1E1B)]' : 'border border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'}`}
                    onClick={() => onChange(s)}
                    aria-label={`Minimum ${s} star${s === 1 ? '' : 's'}`}
                >
                    {s === 0 ? 'All' : '★'.repeat(s)}
                </button>
            ))}
        </div>
    )
}

function ColorFilter({ value, onChange }: { value: 'Any' | ColorTag; onChange: (v: 'Any' | ColorTag) => void }) {
    const options: Array<{ label: string; value: 'Any' | ColorTag }> = [
        { label: 'Any', value: 'Any' },
        { label: 'Red', value: 'Red' },
        { label: 'Green', value: 'Green' },
        { label: 'Blue', value: 'Blue' },
        { label: 'Yellow', value: 'Yellow' },
        { label: 'Purple', value: 'Purple' },
        { label: 'None', value: 'None' },
    ]
    return (
        <div className="relative w-full">
            <select
                className="w-full appearance-none rounded-full border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] px-3 py-1 text-[12px] focus:outline-none"
                value={value}
                onChange={(event) => onChange(event.target.value as 'Any' | ColorTag)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-[var(--text-muted,#6B645B)]">▾</span>
        </div>
    )
}
