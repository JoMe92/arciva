import { Button } from '../../../components/Button'
import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type QuickFixAction = 'auto_exposure' | 'auto_white_balance' | 'auto_crop' | 'all'

export function QuickFixMenu({
    selectedCount,
    onAction,
    disabled,
}: {
    selectedCount: number
    onAction: (action: QuickFixAction) => void
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

    useEffect(() => {
        if (open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setMenuStyle({
                position: 'absolute',
                top: rect.bottom + 8,
                left: rect.left,
                zIndex: 100,
            })
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        const close = () => setOpen(false)
        window.addEventListener('click', close)
        return () => window.removeEventListener('click', close)
    }, [open])

    return (
        <>
            <Button
                ref={buttonRef}
                variant={open ? 'solid' : 'outline'}
                size="sm"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen(!open)
                }}
                disabled={disabled}
                className="max-w-[140px] gap-2 px-3 shadow-sm text-xs"
            >
                <span>Quick Fix</span>
                <span className="text-[10px] opacity-60">▼</span>
            </Button>
            {open &&
                createPortal(
                    <div
                        className="fixed min-w-[200px] rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] py-1 shadow-xl"
                        style={menuStyle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]">
                            {selectedCount} Selected
                        </div>
                        <div className="h-px bg-[var(--border,#E1D3B9)]" />
                        <MenuItem onClick={() => { onAction('auto_exposure'); setOpen(false) }}>
                            Auto Exposure
                        </MenuItem>
                        <MenuItem onClick={() => { onAction('auto_white_balance'); setOpen(false) }}>
                            Auto White Balance
                        </MenuItem>
                        <MenuItem onClick={() => { onAction('auto_crop'); setOpen(false) }}>
                            Auto Crop & Align
                        </MenuItem>
                        <div className="my-1 h-px bg-[var(--border,#E1D3B9)]" />
                        <MenuItem onClick={() => { onAction('all'); setOpen(false) }}>
                            Run All Auto Fixes
                        </MenuItem>
                    </div>,
                    document.body
                )}
        </>
    )
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center px-4 py-2 text-left text-[12px] text-[var(--text,#1F1E1B)] hover:bg-[var(--sand-50,#FBF7EF)] focus:bg-[var(--sand-50,#FBF7EF)] focus:outline-none"
        >
            {children}
        </button>
    )
}
