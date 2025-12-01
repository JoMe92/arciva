import React from 'react'
import { InspectorPreviewData, InspectorViewportRect } from '../types'
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
}

export function QuickFixPanel({
    hasSelection,
    selectionCount,
}: QuickFixPanelProps) {
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
                    {/* Aspect Ratio Grid */}
                    <div className="space-y-2">
                        <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Aspect Ratio</span>
                        <div className="grid grid-cols-3 gap-2">
                            {['Free', 'Original', '1:1', '4:3', '16:9', '2:1'].map((ratio) => (
                                <button
                                    key={ratio}
                                    type="button"
                                    className="rounded border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1.5 text-xs font-medium text-[var(--text,#1F1E1B)] transition hover:border-[var(--text-muted,#6B645B)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Orientation Toggle */}
                    <div className="flex rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface-muted,#F3EBDD)] p-1">
                        <button
                            type="button"
                            className="flex-1 rounded-md bg-[var(--surface,#FFFFFF)] py-1 text-xs font-medium text-[var(--text,#1F1E1B)] shadow-sm"
                        >
                            Horizontal
                        </button>
                        <button
                            type="button"
                            className="flex-1 rounded-md py-1 text-xs font-medium text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]"
                        >
                            Vertical
                        </button>
                    </div>

                    {/* Rotation Control */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Angle</span>
                            <span className="text-xs text-[var(--text-muted,#6B645B)]">0.00°</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="-45"
                                max="45"
                                step="0.1"
                                defaultValue="0"
                                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border,#EDE1C6)] accent-[var(--focus-ring,#1A73E8)]"
                            />
                            <button
                                type="button"
                                className="rounded border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-xs font-medium text-[var(--text,#1F1E1B)] hover:bg-[var(--surface-muted,#F3EBDD)]"
                            >
                                Auto
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

            <div className="mt-auto pt-4">
                <button
                    type="button"
                    className="w-full rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-2 text-sm font-semibold text-[var(--text,#1F1E1B)] shadow-sm transition hover:bg-[var(--surface-muted,#F3EBDD)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)]"
                >
                    Reset Quick Fix
                </button>
            </div>
        </div>
    )
}
