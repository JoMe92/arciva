import React from 'react'
import { ImportIcon, LayoutListIcon, CalendarIcon, FolderIcon, FrameIcon, InspectorIcon, ExportIcon } from './icons'
import { MobileWorkspacePanel } from '../types'

export function MobileProjectNav({
    onImport,
    onOverview,
    onDate,
    onFolder,
    hasDateFilter,
}: {
    onImport: () => void
    onOverview: () => void
    onDate: () => void
    onFolder: () => void
    hasDateFilter: boolean
}) {
    const buttons: Array<{ label: string; onClick: () => void; icon: React.ReactNode; active?: boolean }> = [
        { label: 'Import', onClick: onImport, icon: <ImportIcon className="h-4 w-4" aria-hidden="true" /> },
        { label: 'Overview', onClick: onOverview, icon: <LayoutListIcon className="h-4 w-4" aria-hidden="true" /> },
        { label: 'Date', onClick: onDate, icon: <CalendarIcon className="h-4 w-4" aria-hidden="true" />, active: hasDateFilter },
        { label: 'Folders', onClick: onFolder, icon: <FolderIcon className="h-4 w-4" aria-hidden="true" /> },
    ]
    return (
        <div className="mt-3 flex flex-wrap gap-2 px-1">
            {buttons.map((button) => (
                <button
                    key={button.label}
                    type="button"
                    onClick={button.onClick}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-[var(--text,#1F1E1B)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition ${button.active ? 'border-[var(--text,#1F1E1B)] bg-[var(--sand-100,#F3EBDD)]' : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)]'
                        }`}
                >
                    <span className="text-[var(--text-muted,#6B645B)]">{button.icon}</span>
                    {button.label}
                </button>
            ))}
        </div>
    )
}

export function MobilePhotosModeToggle({ view, onChange }: { view: 'grid' | 'detail'; onChange: (next: 'grid' | 'detail') => void }) {
    return (
        <div className="px-4 pt-3 pb-2">
            <div className="inline-flex w-full max-w-sm rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] p-1 text-[12px] font-medium text-[var(--text-muted,#6B645B)] shadow-[0_4px_12px_rgba(31,30,27,0.08)]">
                {(['grid', 'detail'] as const).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onChange(mode)}
                        className={`flex-1 rounded-full px-3 py-1 capitalize transition ${view === mode ? 'bg-[var(--sand-100,#F3EBDD)] text-[var(--text,#1F1E1B)] shadow-[0_2px_8px_rgba(31,30,27,0.18)]' : ''
                            }`}
                        aria-pressed={view === mode}
                    >
                        {mode}
                    </button>
                ))}
            </div>
        </div>
    )
}

export function MobileBottomBar({
    activePanel,
    onSelectPanel,
    onOpenExport,
    canExport,
    detailsDisabled,
}: {
    activePanel: MobileWorkspacePanel
    onSelectPanel: (panel: MobileWorkspacePanel) => void
    onOpenExport: () => void
    canExport: boolean
    detailsDisabled: boolean
}) {
    return (
        <nav className="border-t border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)]/95 px-3 pb-3 pt-2 text-[11px] text-[var(--text-muted,#6B645B)] shadow-[0_-6px_30px_rgba(31,30,27,0.08)]">
            <div className="grid grid-cols-4 gap-1">
                <MobileNavButton
                    label="Project"
                    icon={<LayoutListIcon className="h-5 w-5" aria-hidden="true" />}
                    active={activePanel === 'project'}
                    onClick={() => onSelectPanel('project')}
                />
                <MobileNavButton
                    label="Photos"
                    icon={<FrameIcon className="h-5 w-5" aria-hidden="true" />}
                    active={activePanel === 'photos'}
                    highlight
                    onClick={() => onSelectPanel('photos')}
                />
                <MobileNavButton
                    label="Details"
                    icon={<InspectorIcon className="h-5 w-5" aria-hidden="true" />}
                    active={activePanel === 'details'}
                    onClick={() => onSelectPanel('details')}
                    disabled={detailsDisabled}
                />
                <button
                    type="button"
                    onClick={onOpenExport}
                    disabled={!canExport}
                    className={`flex flex-col items-center justify-center rounded-2xl border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-center text-[11px] font-semibold transition ${canExport ? 'text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)] opacity-60'
                        }`}
                >
                    <ExportIcon className="h-5 w-5" aria-hidden="true" />
                    <span>Export</span>
                </button>
            </div>
        </nav>
    )
}

function MobileNavButton({
    label,
    icon,
    onClick,
    active,
    highlight = false,
    disabled = false,
}: {
    label: string
    icon: React.ReactNode
    onClick: () => void
    active?: boolean
    highlight?: boolean
    disabled?: boolean
}) {
    const activeClasses = active ? 'text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)]'
    const highlightClasses = highlight ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#EDE1C6)]'
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex flex-col items-center justify-center rounded-2xl border bg-[var(--surface,#FFFFFF)] px-2 py-1 text-center text-[11px] font-semibold transition ${activeClasses} ${highlightClasses} ${disabled ? 'opacity-50' : ''
                }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}
