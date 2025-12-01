import React, { useState } from 'react'
import { ChevronRightIcon } from './icons'

type QuickFixGroupProps = {
    title: string
    subtitle?: string
    children: React.ReactNode
    onAuto?: () => void
    defaultOpen?: boolean
}

export function QuickFixGroup({
    title,
    subtitle,
    children,
    onAuto,
    defaultOpen = true,
}: QuickFixGroupProps) {
    const [open, setOpen] = useState(defaultOpen)

    return (
        <section className="flex shrink-0 flex-col rounded-[18px] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] shadow-[0_18px_40px_rgba(31,30,27,0.12)]">
            <div className="flex items-center gap-3 px-4 py-3">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="flex flex-1 items-center gap-2 text-left"
                >
                    <ChevronRightIcon
                        className={`h-4 w-4 text-[var(--text-muted,#6B645B)] transition-transform duration-200 ${open ? 'rotate-90' : ''
                            }`}
                    />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[var(--text,#1F1E1B)]">{title}</span>
                        {subtitle && (
                            <span className="text-[11px] text-[var(--text-muted,#6B645B)]">{subtitle}</span>
                        )}
                    </div>
                </button>
                {onAuto && (
                    <button
                        type="button"
                        onClick={onAuto}
                        className="rounded-md bg-[var(--surface-muted,#F3EBDD)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text,#1F1E1B)] hover:bg-[var(--border,#EDE1C6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                    >
                        Auto
                    </button>
                )}
            </div>
            {open && <div className="border-t border-[var(--border,#EDE1C6)] px-4 py-4">{children}</div>}
        </section>
    )
}
