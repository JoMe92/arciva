import React from 'react'
import { CropAspectRatioId, CropSettings } from '../types'
import { CROP_RATIO_OPTIONS } from '../cropUtils'
import { QuickFixGroup } from './QuickFixGroup'

// Temporary placeholder for controls
function SliderControl({ label }: { label: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs">
                <span className="font-medium text-[var(--text,#1F1E1B)]">{label}</span>
                <span className="text-[var(--text-muted,#6B645B)]">0</span>
            </div>
            <input
                type="range"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border,#EDE1C6)] accent-[var(--focus-ring,#1A73E8)]"
            />
        </div>
    )
}

type QuickFixPanelProps = {
    hasSelection: boolean
    selectionCount: number
    cropSettings: CropSettings | null
    onAspectRatioChange: (ratio: CropAspectRatioId) => void
    onAngleChange: (angle: number) => void
    onReset: () => void
    onOrientationChange: (orientation: 'horizontal' | 'vertical') => void
}

export function QuickFixPanel({
    hasSelection,
    selectionCount,
    cropSettings,
    onAspectRatioChange,
    onAngleChange,
    onReset,
    onOrientationChange,
}: QuickFixPanelProps) {
    const selectedRatio = cropSettings?.aspectRatioId ?? 'original'
    const angle = cropSettings?.angle ?? 0
    const orientation = cropSettings?.orientation ?? 'horizontal'
    const formattedAngle = angle.toFixed(2)
    const controlsDisabled = !hasSelection

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4">
            {hasSelection && selectionCount > 1 && (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted,#F3EBDD)] px-3 py-2 text-xs text-[var(--text,#1F1E1B)]">
                    <span className="font-medium">
                        {`Changes will apply to ${selectionCount} selected images.`}
                    </span>
                </div>
            )}

            <QuickFixGroup title="Crop & Align" onAuto={() => { }}>
                <div className="space-y-4">
                    <p className="text-xs text-[var(--text-muted,#6B645B)]">
                        Adjust the frame directly on the preview canvas. Drag handles to resize or drag inside to pan.
                    </p>

                    {/* Aspect Ratio Grid */}
                    <div className="space-y-2">
                        <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Aspect Ratio</span>
                        <div className="grid grid-cols-3 gap-2">
                            {CROP_RATIO_OPTIONS.map(({ id, label }) => {
                                const selected = selectedRatio === id
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        disabled={controlsDisabled}
                                        aria-pressed={selected}
                                        onClick={() => onAspectRatioChange(id)}
                                        className={`rounded border px-2 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${selected
                                            ? 'border-[var(--text,#1F1E1B)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)]'
                                            : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] hover:border-[var(--text-muted,#6B645B)]'} ${controlsDisabled ? 'opacity-60' : ''}`}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Orientation</span>
                        <div className="flex rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface-muted,#F3EBDD)] p-1">
                            {(['horizontal', 'vertical'] as const).map((opt) => {
                                const selected = orientation === opt
                                const label = opt === 'horizontal' ? 'Horizontal' : 'Vertical'
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        disabled={controlsDisabled}
                                        aria-pressed={selected}
                                        onClick={() => onOrientationChange(opt)}
                                        className={`flex-1 rounded-md py-1 text-xs font-medium transition ${selected
                                            ? 'bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] shadow-sm'
                                            : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]'} ${controlsDisabled ? 'opacity-60' : ''}`}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Rotation Control */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Angle</span>
                            <span className="text-xs text-[var(--text-muted,#6B645B)]">{formattedAngle}°</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="-45"
                                max="45"
                                step="0.1"
                                value={angle}
                                disabled={controlsDisabled}
                                onChange={(event) => onAngleChange(Number(event.target.value))}
                                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border,#EDE1C6)] accent-[var(--focus-ring,#1A73E8)]"
                            />
                            <button
                                type="button"
                                disabled={controlsDisabled}
                                onClick={onReset}
                                className="rounded border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-xs font-medium text-[var(--text,#1F1E1B)] transition hover:bg-[var(--surface-muted,#F3EBDD)] disabled:opacity-60"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            </QuickFixGroup>

            <QuickFixGroup title="Exposure" onAuto={() => { }}>
                <div className="space-y-4">
                    <SliderControl label="Exposure" />
                    <SliderControl label="Contrast" />
                    <SliderControl label="Highlights" />
                    <SliderControl label="Shadows" />
                </div>
            </QuickFixGroup>

            <QuickFixGroup title="Color" onAuto={() => { }}>
                <div className="space-y-4">
                    <SliderControl label="Temperature" />
                    <SliderControl label="Tint" />
                    <SliderControl label="Vibrance" />
                    <SliderControl label="Saturation" />
                </div>
            </QuickFixGroup>

            <QuickFixGroup title="Grain">
                <div className="space-y-4">
                    <SliderControl label="Amount" />
                    <SliderControl label="Size" />
                    <SliderControl label="Roughness" />
                </div>
            </QuickFixGroup>

            <QuickFixGroup title="Geometry">
                <div className="space-y-4">
                    <SliderControl label="Distortion" />
                    <SliderControl label="Vertical" />
                    <SliderControl label="Horizontal" />
                </div>
            </QuickFixGroup>

            <div className="mt-auto pt-4" />
        </div>
    )
}
