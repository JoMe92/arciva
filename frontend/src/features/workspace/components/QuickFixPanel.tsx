import React from 'react'
import { InspectorPreviewData, InspectorViewportRect } from '../types'
import { QuickFixGroup } from './QuickFixGroup'
import { InspectorPreviewCard } from './InspectorPanel' // We will need to export this from InspectorPanel or move it

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
    previewAsset: InspectorPreviewData | null
    hasSelection: boolean
    selectionCount: number
    detailZoom: number
    detailMinZoom: number
    detailMaxZoom: number
    detailViewport: InspectorViewportRect | null
    onDetailZoomIn: () => void
    onDetailZoomOut: () => void
    onDetailZoomReset: () => void
    onPreviewPan?: (position: { x: number; y: number }) => void
    previewOpen: boolean
    setPreviewOpen: (open: boolean) => void
}

export function QuickFixPanel({
    previewAsset,
    hasSelection,
    selectionCount,
    detailZoom,
    detailMinZoom,
    detailMaxZoom,
    detailViewport,
    onDetailZoomIn,
    onDetailZoomOut,
    onDetailZoomReset,
    onPreviewPan,
    previewOpen,
    setPreviewOpen,
}: QuickFixPanelProps) {
    return (
        <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-4">
            <InspectorPreviewCard
                preview={previewAsset}
                hasSelection={hasSelection}
                zoomLevel={detailZoom}
                minZoom={detailMinZoom}
                maxZoom={detailMaxZoom}
                viewport={detailViewport}
                onZoomIn={onDetailZoomIn}
                onZoomOut={onDetailZoomOut}
                onZoomReset={onDetailZoomReset}
                onPanPreview={onPreviewPan}
                open={previewOpen}
                onToggle={() => setPreviewOpen(!previewOpen)}
            />

            {hasSelection && (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted,#F3EBDD)] px-3 py-2 text-xs text-[var(--text,#1F1E1B)]">
                    <span className="font-medium">
                        {selectionCount > 1
                            ? `Changes will apply to ${selectionCount} selected images.`
                            : 'Changes are shown live in the main image.'}
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
