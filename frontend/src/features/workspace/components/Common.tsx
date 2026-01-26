import { Button } from '../../../components/Button'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ColorTag } from '../types'
import { RawPlaceholderFrame } from '../../../components/RawPlaceholder'
import DialogHeader from '../../../components/DialogHeader'

export function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[var(--sand-100,#F3EBDD)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted,#6B645B)]${className ? ` ${className}` : ''
        }`}
    >
      {count}
    </span>
  )
}

type OverlayDialogProps = {
  id?: string
  title: string
  onClose: () => void
  headerAction?: React.ReactNode
  children: React.ReactNode
  maxWidthClass?: string
  anchorRect?: DOMRect | null
}

export function OverlayDialog({
  id,
  title,
  onClose,
  headerAction,
  children,
  maxWidthClass = 'max-w-md',
  anchorRect,
}: OverlayDialogProps) {
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
        <DialogHeader
          title={title}
          onClose={onClose}
          actions={headerAction}
          closeLabel={`Close ${title}`}
        />
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function StarRow({
  value,
  onChange,
}: {
  value: number
  onChange: (v: 0 | 1 | 2 | 3 | 4 | 5) => void
}) {
  const stars = [1, 2, 3, 4, 5] as const
  return (
    <div className="inline-flex items-center gap-1">
      {stars.map((s) => (
        <button
          key={s}
          className={`px-1 py-0.5 border rounded ${value >= s ? 'border-[var(--text,#1F1E1B)]' : 'border-[var(--border,#E1D3B9)] text-[var(--text-muted,#6B645B)]'}`}
          onClick={() => onChange(s)}
          aria-label={`Rate ${s} stars`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export function ColorSwatch({ value, onPick }: { value: ColorTag; onPick: (t: ColorTag) => void }) {
  const map: Record<ColorTag, string> = {
    None: '#E5E7EB',
    Red: '#F87171',
    Green: '#34D399',
    Blue: '#60A5FA',
    Yellow: '#FBBF24',
    Purple: '#C084FC',
  }
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        aria-label={`Color ${value}`}
        title={`Color ${value}`}
        className="w-5 h-5 rounded-full border border-[var(--border,#E1D3B9)]"
        style={{ backgroundColor: map[value] }}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute right-0 z-10 mt-1 min-w-[140px] rounded border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)] p-3 shadow">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(map) as ColorTag[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-label={k}
                title={k}
                className="w-6 h-6 rounded-full border border-[var(--border,#E1D3B9)]"
                style={{ backgroundColor: map[k] }}
                onClick={() => {
                  onPick(k)
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'muted' | 'accent'
export type BadgeConfig = { label: string; tone: BadgeTone; icon?: string; ariaLabel: string }

const BADGE_TONE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-[var(--success,#34B37A)] text-white',
  warning: 'bg-[var(--warning,#E4AD07)] text-[var(--text,#1F1E1B)]',
  danger: 'bg-[var(--danger,#C73A37)] text-white',
  muted: 'bg-[var(--border,#E1D3B9)] text-[var(--text,#1F1E1B)]',
  accent: 'bg-[var(--accent,#D7C5A6)] text-[var(--on-accent,#3A2F23)]',
}

export function Badge({
  label,
  tone = 'muted',
  icon,
  ariaLabel,
}: {
  label: string
  tone?: BadgeTone
  icon?: string
  ariaLabel?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] font-semibold tracking-wide ${BADGE_TONE_STYLES[tone]}`}
      aria-label={ariaLabel ?? label}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span className="leading-none">{label}</span>
    </span>
  )
}

export function EmptyState() {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-4 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <RawPlaceholderFrame
          ratio="3x2"
          className="w-[220px] h-[132px] rounded-lg border border-[var(--border,#E1D3B9)]"
          title="Placeholder image"
        />
        <div className="text-base font-semibold">Start your project</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">
          Use the Import side panel to add your first photos. That is now the single entry point for
          importing, and it will auto-organize files by date (YYYY/MM/DD) unless you switch to a
          custom folder name inside the Import flow.
        </div>
      </div>
    </div>
  )
}

export function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="grid place-items-center h-[60vh] text-center">
      <div className="inline-flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--border,#E1D3B9)] bg-[var(--surface,#FFFFFF)]">
        <div className="text-base font-semibold">No matches</div>
        <div className="text-xs text-[var(--text-muted,#6B645B)] max-w-[420px]">
          Your filters hide all photos. Try lowering the minimum rating or clearing the color/type
          filters.
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="mt-1"
        >
          Reset filters
        </Button>
      </div>
    </div>
  )
}
