import React from 'react'

export type SliderControlProps = {
    label: string
    value: number
    min: number
    max: number
    step: number
    disabled: boolean
    onChange: (value: number) => void
    format?: (value: number) => string
    onPointerDown?: (event: React.PointerEvent<HTMLInputElement>) => void
    onPointerUp?: (event: React.PointerEvent<HTMLInputElement>) => void
    onPointerCancel?: (event: React.PointerEvent<HTMLInputElement>) => void
    onBlur?: () => void
    ['data-testid']?: string
}

const isZeroCenteredRange = (min: number, max: number) => min < 0 && max > 0

const getSliderTrackBackground = (value: number, min: number, max: number) => {
    if (!isZeroCenteredRange(min, max)) return undefined
    const zeroPercent = ((0 - min) / (max - min)) * 100
    const currentPercent = ((value - min) / (max - min)) * 100
    const neutral = 'var(--border,#EDE1C6)'
    const emphasis = 'var(--focus-ring,#1A73E8)'
    if (value >= 0) {
        return `linear-gradient(90deg, ${neutral} 0%, ${neutral} ${zeroPercent}%, ${emphasis} ${zeroPercent}%, ${emphasis} ${currentPercent}%, ${neutral} ${currentPercent}%, ${neutral} 100%)`
    }
    return `linear-gradient(90deg, ${neutral} 0%, ${neutral} ${currentPercent}%, ${emphasis} ${currentPercent}%, ${emphasis} ${zeroPercent}%, ${neutral} ${zeroPercent}%, ${neutral} 100%)`
}

export function SliderControl({
    label,
    value,
    min,
    max,
    step,
    disabled,
    onChange,
    format,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onBlur,
    'data-testid': testId,
}: SliderControlProps) {
    const displayValue = format ? format(value) : value.toFixed(2)
    const zeroCentered = isZeroCenteredRange(min, max)
    const trackBackground = getSliderTrackBackground(value, min, max)
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs">
                <span className="font-medium text-[var(--text,#1F1E1B)]">{label}</span>
                <span className="text-[var(--text-muted,#6B645B)]">{displayValue}</span>
            </div>
            <div className="relative">
                {zeroCentered ? (
                    <span className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-[var(--border,#EDE1C6)]" aria-hidden="true" />
                ) : null}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    disabled={disabled}
                    onChange={(event) => onChange(Number(event.target.value))}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onBlur={onBlur}
                    data-testid={testId}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border,#EDE1C6)] accent-[var(--focus-ring,#1A73E8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#1A73E8)] focus-visible:ring-offset-2"
                    style={trackBackground ? { backgroundImage: trackBackground } : undefined}
                />
            </div>
        </div>
    )
}
