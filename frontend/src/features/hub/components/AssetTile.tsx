
import React from 'react'
import type { HubTile, HubViewMode } from '../types'

const DATE_FULL_FORMAT = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
})

const JPEG_RAW_OVERLAY = 'JPEG + RAW'

type AssetTileProps = {
    tile: HubTile
    viewMode: HubViewMode
    selected?: boolean
    disabled?: boolean
    onToggle?: () => void
}

export default function AssetTile({
    tile,
    viewMode,
    selected,
    disabled,
    onToggle,
}: AssetTileProps) {
    const primary = tile.primary
    const secondary = tile.secondary
    const createdAt = primary.created_at
        ? DATE_FULL_FORMAT.format(new Date(primary.created_at))
        : 'Unknown date'

    const handleClick = () => {
        if (!disabled && onToggle) {
            onToggle()
        }
    }

    const wrapperClass = `relative w-full overflow-hidden rounded border transition-colors ${selected
            ? 'border-[var(--river-500,#6B7C7A)] bg-[var(--river-50,#F0F4F4)] ring-1 ring-[var(--river-500,#6B7C7A)]'
            : 'border-[var(--border,#E1D3B9)] bg-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--river-300,#A4C2C1)]'}`

    const content = (
        <div className={wrapperClass} onClick={handleClick}>
            <img
                src={primary.thumb_url ?? ''}
                alt=""
                className="h-40 w-full object-cover"
                loading="lazy"
            />
            <div className="p-3 text-left">
                <div className="truncate text-sm font-semibold">{primary.original_filename}</div>
                <div className="text-xs text-[var(--text-muted,#6B645B)]">{createdAt}</div>
            </div>
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {tile.isPaired && secondary ? JPEG_RAW_OVERLAY : primary.type}
            </div>
            {selected && (
                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--river-500,#6B7C7A)] text-white">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                    >
                        <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>
            )}
        </div>
    )

    const listContent = (
        <div
            className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${selected
                    ? 'border-[var(--river-500,#6B7C7A)] bg-[var(--river-50,#F0F4F4)]'
                    : 'border-[var(--border,#E1D3B9)] bg-white'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--river-300,#A4C2C1)]'}`}
            onClick={handleClick}
        >
            <img
                src={primary.thumb_url ?? ''}
                alt=""
                className="h-14 w-14 rounded object-cover"
                loading="lazy"
            />
            <div className="flex-1">
                <div className="truncate text-sm font-semibold">{primary.original_filename}</div>
                <div className="text-xs text-[var(--text-muted,#6B645B)]">{createdAt}</div>
            </div>
            <div className="text-xs font-medium text-[var(--text-muted,#6B645B)]">
                {tile.isPaired && secondary ? JPEG_RAW_OVERLAY : primary.type}
            </div>
            {selected && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--river-500,#6B7C7A)] text-white">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                    >
                        <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>
            )}
        </div>
    )

    return viewMode === 'grid' ? content : listContent
}
