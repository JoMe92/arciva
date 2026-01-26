import { Button } from '../../../components/Button'
import React from 'react'
import {
  ImportIcon,
  LayoutListIcon,
  CalendarIcon,
  FolderIcon,
  FrameIcon,
  InspectorIcon,
  ExportIcon,
} from './icons'
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
  const buttons: Array<{
    label: string
    onClick: () => void
    icon: React.ReactNode
    active?: boolean
  }> = [
      {
        label: 'Import',
        onClick: onImport,
        icon: <ImportIcon className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Overview',
        onClick: onOverview,
        icon: <LayoutListIcon className="h-4 w-4" aria-hidden="true" />,
      },
      {
        label: 'Date',
        onClick: onDate,
        icon: <CalendarIcon className="h-4 w-4" aria-hidden="true" />,
        active: hasDateFilter,
      },
      {
        label: 'Folders',
        onClick: onFolder,
        icon: <FolderIcon className="h-4 w-4" aria-hidden="true" />,
      },
    ]
  return (
    <div className="mt-3 flex flex-wrap gap-2 px-1">
      {buttons.map((button) => (
        <Button
          key={button.label}
          variant={button.active ? 'solid' : 'outline'}
          size="sm"
          onClick={button.onClick}
          className="rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.06)] pl-2 pr-3"
        >
          <span className="text-[var(--text-muted,#6B645B)] -ml-0.5">{button.icon}</span>
          {button.label}
        </Button>
      ))}
    </div>
  )
}

export function MobilePhotosModeToggle({
  view,
  onChange,
}: {
  view: 'grid' | 'detail'
  onChange: (next: 'grid' | 'detail') => void
}) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="inline-flex w-full max-w-sm rounded-full border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] p-1 text-[12px] font-medium text-[var(--text-muted,#6B645B)] shadow-[0_4px_12px_rgba(31,30,27,0.08)] gap-1">
        {(['grid', 'detail'] as const).map((mode) => (
          <Button
            key={mode}
            variant={view === mode ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => onChange(mode)}
            aria-pressed={view === mode}
            className={`flex-1 rounded-full capitalize ${view !== mode ? 'hover:bg-transparent' : ''}`}
          >
            {mode}
          </Button>
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
        <Button
          variant="outline"
          onClick={onOpenExport}
          disabled={!canExport}
          className={`flex flex-col items-center justify-center rounded-2xl h-auto py-1 px-2 gap-0 ${canExport ? 'text-[var(--text,#1F1E1B)]' : 'text-[var(--text-muted,#6B645B)] opacity-60'}`}
        >
          <ExportIcon className="h-5 w-5 mb-0.5" aria-hidden="true" />
          <span>Export</span>
        </Button>
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

  return (
    <Button
      variant={highlight ? 'outline' : 'ghost'}
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center rounded-2xl h-auto py-1 px-2 gap-0 ${activeClasses} ${highlight ? 'border-[var(--text,#1F1E1B)]' : ''} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="mb-0.5">{icon}</span>
      <span>{label}</span>
    </Button>
  )
}
