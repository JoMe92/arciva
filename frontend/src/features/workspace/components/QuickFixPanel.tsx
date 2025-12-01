import React, { useMemo } from 'react'
import { CropAspectRatioId, CropOrientation, CropSettings } from '../types'
import { CROP_RATIO_OPTIONS } from '../cropUtils'
import { QuickFixGroup } from './QuickFixGroup'
import {
  QuickFixGroupKey,
  QuickFixState,
  createDefaultQuickFixState,
  hasQuickFixAdjustments,
} from '../quickFixState'

type SliderControlProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled: boolean
  onChange: (value: number) => void
  format?: (value: number) => string
}

function SliderControl({ label, value, min, max, step, disabled, onChange, format }: SliderControlProps) {
  const displayValue = format ? format(value) : value.toFixed(2)
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-[var(--text,#1F1E1B)]">{label}</span>
        <span className="text-[var(--text-muted,#6B645B)]">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
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
  onOrientationChange: (orientation: CropOrientation) => void
  onCropApplyChange: (applied: boolean) => void
  quickFixState: QuickFixState | null
  onQuickFixChange: (updater: (prev: QuickFixState) => QuickFixState) => void
  onQuickFixGroupReset: (group: QuickFixGroupKey) => void
  onQuickFixGlobalReset: () => void
  previewBusy: boolean
  saving: boolean
  errorMessage: string | null
}

const formatSigned = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`

export function QuickFixPanel({
  hasSelection,
  selectionCount,
  cropSettings,
  onAspectRatioChange,
  onAngleChange,
  onReset,
  onOrientationChange,
  onCropApplyChange,
  quickFixState,
  onQuickFixChange,
  onQuickFixGroupReset,
  onQuickFixGlobalReset,
  previewBusy,
  saving,
  errorMessage,
}: QuickFixPanelProps) {
  const quickFix = useMemo(() => quickFixState ?? createDefaultQuickFixState(), [quickFixState])
  const selectedRatio = cropSettings?.aspectRatioId ?? 'original'
  const angle = cropSettings?.angle ?? 0
  const orientation = cropSettings?.orientation ?? 'horizontal'
  const cropApplied = cropSettings?.applied ?? false
  const controlsDisabled = !hasSelection || selectionCount !== 1 || !quickFixState
  const cropControlsDisabled = controlsDisabled || !cropSettings || cropApplied
  const disableMessage = !hasSelection
    ? 'Select a photo to start adjusting it.'
    : selectionCount > 1
      ? 'Quick Fix adjusts one image at a time.'
      : null
  const hasAdjustments = quickFixState ? hasQuickFixAdjustments(quickFixState) : false

  const handleQuickFixValueChange = (updater: (state: QuickFixState) => QuickFixState) => {
    if (controlsDisabled) return
    onQuickFixChange(updater)
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4">
      {disableMessage ? (
        <div className="rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-xs text-[var(--text-muted,#6B645B)]">
          {disableMessage}
        </div>
      ) : null}
      {disableMessage
        ? null
        : (previewBusy || saving || errorMessage) && (
            <div className="rounded-lg bg-[var(--surface-muted,#F3EBDD)] px-3 py-2 text-xs text-[var(--text-muted,#6B645B)]">
              {errorMessage
                ? errorMessage
                : previewBusy
                  ? 'Updating live preview…'
                  : saving
                    ? 'Saving adjustments…'
                    : null}
            </div>
          )}

      <QuickFixGroup title="Crop & Align">
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted,#6B645B)]">
            Adjust the frame directly on the preview canvas. Drag handles to resize or drag inside to pan.
          </p>
          <div className="space-y-2">
            <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Aspect Ratio</span>
            <div className="grid grid-cols-3 gap-2">
              {CROP_RATIO_OPTIONS.map(({ id, label }) => {
                const selected = selectedRatio === id
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={cropControlsDisabled}
                    aria-pressed={selected}
                    onClick={() => onAspectRatioChange(id)}
                    className={`rounded border px-2 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${
                      selected
                        ? 'border-[var(--text,#1F1E1B)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)]'
                        : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] hover:border-[var(--text-muted,#6B645B)]'
                    } ${cropControlsDisabled ? 'opacity-60' : ''}`}
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
                    disabled={cropControlsDisabled}
                    aria-pressed={selected}
                    onClick={() => onOrientationChange(opt)}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition ${
                      selected
                        ? 'bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] shadow-sm'
                        : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)]'
                    } ${cropControlsDisabled ? 'opacity-60' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Angle</span>
              <span className="text-xs text-[var(--text-muted,#6B645B)]">{angle.toFixed(2)}°</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-45"
                max="45"
                step="0.1"
                value={angle}
                disabled={cropControlsDisabled}
                onChange={(event) => onAngleChange(Number(event.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border,#EDE1C6)] accent-[var(--focus-ring,#1A73E8)]"
              />
              <button
                type="button"
                disabled={cropControlsDisabled}
                onClick={onReset}
                className="rounded border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1 text-xs font-medium text-[var(--text,#1F1E1B)] transition hover:bg-[var(--surface-muted,#F3EBDD)] disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {cropApplied ? (
              <p className="text-xs text-[var(--text-muted,#6B645B)]">
                Crop applied. Choose Re-Crop to adjust the original frame again.
              </p>
            ) : null}
            <button
              type="button"
              disabled={controlsDisabled || !cropSettings}
              onClick={() => onCropApplyChange(!cropApplied)}
              className="w-full rounded border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-xs font-semibold text-[var(--text,#1F1E1B)] transition hover:bg-[var(--surface-muted,#F3EBDD)] disabled:opacity-60"
            >
              {cropApplied ? 'Re-Crop' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <QuickFixGroup title="Exposure">
        <div className="space-y-4">
          <SliderControl
            label="Exposure"
            value={quickFix.exposure.exposure}
            min={-2}
            max={2}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, exposure: value },
              }))
            }
            format={(value) => `${formatSigned(value, 2)} EV`}
          />
          <SliderControl
            label="Contrast"
            value={quickFix.exposure.contrast}
            min={0.2}
            max={2.5}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, contrast: value },
              }))
            }
            format={(value) => value.toFixed(2)}
          />
          <SliderControl
            label="Highlights"
            value={quickFix.exposure.highlights}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, highlights: value },
              }))
            }
            format={(value) => formatSigned(value)}
          />
          <SliderControl
            label="Shadows"
            value={quickFix.exposure.shadows}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, shadows: value },
              }))
            }
            format={(value) => formatSigned(value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={() => onQuickFixGroupReset('exposure')}
              disabled={controlsDisabled}
            >
              Reset exposure
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <QuickFixGroup title="Color">
        <div className="space-y-4">
          <SliderControl
            label="Temperature"
            value={quickFix.color.temperature}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                color: { ...prev.color, temperature: value },
              }))
            }
            format={(value) => formatSigned(value)}
          />
          <SliderControl
            label="Tint"
            value={quickFix.color.tint}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                color: { ...prev.color, tint: value },
              }))
            }
            format={(value) => formatSigned(value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={() => onQuickFixGroupReset('color')}
              disabled={controlsDisabled}
            >
              Reset color
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <QuickFixGroup title="Grain">
        <div className="space-y-4">
          <SliderControl
            label="Amount"
            value={quickFix.grain.amount}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                grain: { ...prev.grain, amount: value },
              }))
            }
            format={(value) => `${Math.round(value * 100)}%`}
          />
          <div className="space-y-2">
            <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Size</span>
            <div className="grid grid-cols-3 gap-2">
              {(['fine', 'medium', 'coarse'] as const).map((size) => {
                const selected = quickFix.grain.size === size
                const label = size[0].toUpperCase() + size.slice(1)
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={controlsDisabled}
                    aria-pressed={selected}
                    onClick={() =>
                      handleQuickFixValueChange((prev) => ({
                        ...prev,
                        grain: { ...prev.grain, size },
                      }))
                    }
                    className={`rounded border px-2 py-1.5 text-xs font-medium ${
                      selected
                        ? 'border-[var(--text,#1F1E1B)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)]'
                        : 'border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] text-[var(--text,#1F1E1B)] hover:border-[var(--text-muted,#6B645B)]'
                    } ${controlsDisabled ? 'opacity-60' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={() => onQuickFixGroupReset('grain')}
              disabled={controlsDisabled}
            >
              Reset grain
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <QuickFixGroup title="Geometry">
        <div className="space-y-4">
          <SliderControl
            label="Vertical"
            value={quickFix.geometry.vertical}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                geometry: { ...prev.geometry, vertical: value },
              }))
            }
            format={(value) => formatSigned(value)}
          />
          <SliderControl
            label="Horizontal"
            value={quickFix.geometry.horizontal}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              handleQuickFixValueChange((prev) => ({
                ...prev,
                geometry: { ...prev.geometry, horizontal: value },
              }))
            }
            format={(value) => formatSigned(value)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={() => onQuickFixGroupReset('geometry')}
              disabled={controlsDisabled}
            >
              Reset geometry
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <div className="rounded-[18px] border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-4 py-3 text-xs text-[var(--text-muted,#6B645B)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {hasAdjustments
              ? 'Reset clears all Quick Fix changes for this image.'
              : 'No Quick Fix adjustments applied yet.'}
          </span>
          <button
            type="button"
            onClick={onQuickFixGlobalReset}
            disabled={controlsDisabled || !hasAdjustments}
            className="rounded border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-2 py-1 font-medium text-[var(--text,#1F1E1B)] transition hover:bg-[var(--surface-muted,#F3EBDD)] disabled:opacity-60"
          >
            Reset Quick Fix
          </button>
        </div>
      </div>
    </div>
  )
}
