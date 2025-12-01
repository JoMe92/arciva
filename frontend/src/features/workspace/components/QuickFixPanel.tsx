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
                    <SliderControl label="Angle" />
                    <SliderControl label="Aspect Ratio" />
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
