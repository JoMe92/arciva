import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CropAspectRatioId, CropOrientation, CropSettings } from '../types'
import { CROP_RATIO_OPTIONS } from '../cropUtils'
import { QuickFixGroup } from './QuickFixGroup'
import {
  QuickFixGroupKey,
  QuickFixState,
  areQuickFixStatesEqual,
  cloneQuickFixState,
  createDefaultQuickFixState,
  hasQuickFixAdjustments,
} from '../quickFixState'
import { SliderControl } from './QuickFixSlider'
import { QuickFixHSL } from './QuickFixHSL'
import { QuickFixCurves } from './QuickFixCurves'
import { QuickFixSplitToning } from './QuickFixSplitToning'

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
  onLiveStateChange?: (state: QuickFixState | null) => void
  onAdjustingChange?: (isAdjusting: boolean) => void
  viewMode?: 'grid' | 'detail'
  applyToSelection?: boolean
  onApplyToSelectionChange?: (apply: boolean) => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
}

const formatSigned = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`

function QuickFixPanelComponent({
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
  onLiveStateChange,
  onAdjustingChange,
  viewMode = 'grid',
  applyToSelection = false,
  onApplyToSelectionChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: QuickFixPanelProps) {
  const quickFix = useMemo(() => quickFixState ?? createDefaultQuickFixState(), [quickFixState])
  const [liveState, setLiveState] = useState<QuickFixState | null>(null)
  const liveStateRef = useRef<QuickFixState | null>(null)
  const firstControlRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Focus the first control when the panel mounts
    if (firstControlRef.current) {
      firstControlRef.current.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    liveStateRef.current = liveState
  }, [liveState])
  const selectedRatio = cropSettings?.aspectRatioId ?? 'original'
  const angle = cropSettings?.angle ?? 0
  const orientation = cropSettings?.orientation ?? 'horizontal'
  const cropApplied = cropSettings?.applied ?? false
  const controlsDisabled = !hasSelection || !quickFixState
  const isGridMode = viewMode === 'grid'
  const cropControlsDisabled = controlsDisabled || !cropSettings || cropApplied || isGridMode
  const disableMessage = !hasSelection
    ? 'Select a photo to start adjusting it.'
    : null
  const hasAdjustments = quickFixState ? hasQuickFixAdjustments(quickFixState) : false
  const displayedState = liveState ?? quickFix
  const commitTimeoutRef = useRef<number | null>(null)
  const activePointerRef = useRef<number | null>(null)

  const handleQuickFixValueChange = (updater: (state: QuickFixState) => QuickFixState) => {
    if (controlsDisabled) return
    onQuickFixChange(updater)
  }

  const clearCommitTimeout = useCallback(() => {
    if (commitTimeoutRef.current !== null) {
      window.clearTimeout(commitTimeoutRef.current)
      commitTimeoutRef.current = null
    }
  }, [])

  const commitLiveState = useCallback(
    (resetDraft: boolean) => {
      if (controlsDisabled) return
      const draft = liveStateRef.current
      if (!draft || !quickFixState) {
        if (resetDraft) setLiveState(null)
        return
      }
      if (areQuickFixStatesEqual(draft, quickFixState)) {
        if (resetDraft) setLiveState(null)
        return
      }
      handleQuickFixValueChange(() => cloneQuickFixState(draft))
      if (resetDraft) setLiveState(null)
    },
    [controlsDisabled, handleQuickFixValueChange, quickFixState]
  )

  const scheduleLiveCommit = useCallback(() => {
    if (controlsDisabled) return
    clearCommitTimeout()
    commitTimeoutRef.current = window.setTimeout(() => {
      commitTimeoutRef.current = null
      commitLiveState(activePointerRef.current === null)
    }, 350)
  }, [clearCommitTimeout, commitLiveState, controlsDisabled])

  useEffect(
    () => () => {
      clearCommitTimeout()
    },
    [clearCommitTimeout]
  )

  const updateLiveState = useCallback(
    (updater: (draft: QuickFixState) => QuickFixState) => {
      if (controlsDisabled) return
      setLiveState((prev) => {
        const base = prev ? cloneQuickFixState(prev) : cloneQuickFixState(quickFix)
        return updater(base)
      })
      scheduleLiveCommit()
    },
    [controlsDisabled, quickFix, scheduleLiveCommit]
  )

  const handleSliderPointerDown = useCallback(
    (event: React.PointerEvent<HTMLInputElement>) => {
      if (controlsDisabled) return
      activePointerRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore if the browser does not support pointer capture on range inputs
      }
    },
    [controlsDisabled]
  )

  const releasePointer = useCallback(
    (event?: React.PointerEvent<HTMLInputElement>) => {
      const pointerId = event?.pointerId
      if (typeof pointerId === 'number' && activePointerRef.current !== pointerId) return
      const target = event?.currentTarget
      if (typeof pointerId === 'number' && target?.hasPointerCapture?.(pointerId)) {
        target.releasePointerCapture(pointerId)
      }
      activePointerRef.current = null
      clearCommitTimeout()
      commitLiveState(true)
    },
    [clearCommitTimeout, commitLiveState]
  )

  const handleSliderBlur = useCallback(() => {
    if (activePointerRef.current !== null) return
    clearCommitTimeout()
    commitLiveState(true)
  }, [clearCommitTimeout, commitLiveState])

  const adjusting = Boolean(liveState && quickFixState)

  useEffect(() => {
    onAdjustingChange?.(adjusting)
  }, [adjusting, onAdjustingChange])

  useEffect(() => {
    if (!onLiveStateChange) return
    if (!quickFixState || !liveState) {
      onLiveStateChange(null)
      return
    }
    if (areQuickFixStatesEqual(liveState, quickFixState)) {
      onLiveStateChange(null)
    } else {
      onLiveStateChange(liveState)
    }
  }, [liveState, onLiveStateChange, quickFixState])

  useEffect(() => {
    if (!quickFixState) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Drop any in-progress slider draft when the selection changes.
      setLiveState(null)
      return
    }
    const draft = liveStateRef.current
    if (draft && areQuickFixStatesEqual(draft, quickFixState)) {
      return
    }
    if (activePointerRef.current !== null) return
    setLiveState(null)
  }, [quickFixState])

  useEffect(() => {
    if (!controlsDisabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Controls are disabled, so discard any stale draft values.
    setLiveState(null)
    onLiveStateChange?.(null)
  }, [controlsDisabled, onLiveStateChange])

  const sliderEvents = {
    onPointerDown: handleSliderPointerDown,
    onPointerUp: (event: React.PointerEvent<HTMLInputElement>) => releasePointer(event),
    onPointerCancel: (event: React.PointerEvent<HTMLInputElement>) => releasePointer(event),
    onBlur: handleSliderBlur,
  }

  useEffect(
    () => () => {
      onLiveStateChange?.(null)
      onAdjustingChange?.(false)
    },
    [onAdjustingChange, onLiveStateChange]
  )

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden pr-4">
      {disableMessage ? (
        <div className="rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 py-2 text-xs text-[var(--text-muted,#6B645B)]">
          {disableMessage}
        </div>
      ) : null}

      {!disableMessage && (selectionCount > 1 || onUndo || onRedo) ? (
        <div className="rounded-lg border border-[var(--border,#EDE1C6)] bg-[var(--surface,#FFFFFF)] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            {selectionCount > 1 ? (
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[var(--text,#1F1E1B)]">
                    {selectionCount} images selected
                  </p>
                  {onApplyToSelectionChange ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={applyToSelection}
                        onChange={(e) => onApplyToSelectionChange(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border,#EDE1C6)] text-[var(--focus-ring,#1A73E8)] focus:ring-[var(--focus-ring,#1A73E8)]"
                      />
                      <span className="text-xs font-medium text-[var(--text,#1F1E1B)]">Batch</span>
                    </label>
                  ) : null}
                </div>
                <p className="text-[11px] text-[var(--text-muted,#6B645B)]">
                  Changes will be applied to {selectionCount} selected images.
                </p>
              </div>
            ) : null}

            {onUndo || onRedo ? (
              <div className={`flex items-center gap-1 ${selectionCount > 1 ? 'border-l border-[var(--border,#EDE1C6)] pl-2' : 'w-full justify-end'}`}>
                {onUndo ? (
                  <button
                    type="button"
                    ref={firstControlRef}
                    disabled={!canUndo}
                    onClick={onUndo}
                    title="Undo (Ctrl+Z)"
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--surface-muted,#F3EBDD)] disabled:opacity-40"
                  >
                    <span aria-hidden="true">↩</span>
                  </button>
                ) : null}
                {onRedo ? (
                  <button
                    type="button"
                    disabled={!canRedo}
                    onClick={onRedo}
                    title="Redo (Ctrl+Shift+Z)"
                    className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--surface-muted,#F3EBDD)] disabled:opacity-40"
                  >
                    <span aria-hidden="true">↪</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
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
                    className={`rounded border px-2 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#1A73E8)] ${selected
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
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition ${selected
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
            ) : isGridMode ? (
              <p className="text-xs text-[var(--text-muted,#6B645B)]">
                Switch to Detail view to use crop tools.
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

      <QuickFixGroup title="Exposure" data-testid="quickfix-group-exposure">
        <div className="space-y-4">
          <SliderControl
            label="Exposure"
            value={displayedState.exposure.exposure}
            min={-2}
            max={2}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, exposure: value },
              }))
            }
            format={(value) => `${formatSigned(value, 2)} EV`}
            {...sliderEvents}
            data-testid="quickfix-exposure-slider"
          />
          <SliderControl
            label="Contrast"
            value={displayedState.exposure.contrast}
            min={0.2}
            max={2.5}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, contrast: value },
              }))
            }
            format={(value) => value.toFixed(2)}
            {...sliderEvents}
            data-testid="quickfix-contrast-slider"
          />
          <SliderControl
            label="Highlights"
            value={displayedState.exposure.highlights}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, highlights: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
          />
          <SliderControl
            label="Shadows"
            value={displayedState.exposure.shadows}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                exposure: { ...prev.exposure, shadows: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
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

      <QuickFixCurves
        state={displayedState.curves}
        onChange={updateLiveState}
        disabled={controlsDisabled}
        onReset={() => onQuickFixGroupReset('curves')}
        sliderEvents={sliderEvents}
      />

      <QuickFixGroup title="Color">
        <div className="space-y-4">
          <SliderControl
            label="Temperature"
            value={displayedState.color.temperature}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                color: { ...prev.color, temperature: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
          />
          <SliderControl
            label="Tint"
            value={displayedState.color.tint}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                color: { ...prev.color, tint: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
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

      <QuickFixHSL
        state={displayedState.hsl}
        onChange={updateLiveState}
        disabled={controlsDisabled}
        onReset={() => onQuickFixGroupReset('hsl')}
        sliderEvents={sliderEvents}
      />

      <QuickFixSplitToning
        state={displayedState.splitToning}
        onChange={updateLiveState}
        disabled={controlsDisabled}
        onReset={() => onQuickFixGroupReset('splitToning')}
        sliderEvents={sliderEvents}
      />

      <QuickFixGroup title="Detail & Denoise">
        <div className="space-y-4">
          <SliderControl
            label="Sharpen Amount"
            value={displayedState.detail.sharpenAmount}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                detail: { ...prev.detail, sharpenAmount: value },
              }))
            }
            format={(value) => value.toFixed(2)}
            {...sliderEvents}
          />
          <SliderControl
            label="Sharpen Radius"
            value={displayedState.detail.sharpenRadius}
            min={0.1}
            max={3.0}
            step={0.1}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                detail: { ...prev.detail, sharpenRadius: value },
              }))
            }
            format={(value) => value.toFixed(1)}
            {...sliderEvents}
          />
          <SliderControl
            label="Clarity"
            value={displayedState.detail.clarity}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                detail: { ...prev.detail, clarity: value },
              }))
            }
            format={(value) => value.toFixed(2)}
            {...sliderEvents}
          />
          <SliderControl
            label="Dehaze"
            value={displayedState.detail.dehaze}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                detail: { ...prev.detail, dehaze: value },
              }))
            }
            format={(value) => value.toFixed(2)}
            {...sliderEvents}
          />
          <div className="border-t border-[var(--border,#EDE1C6)] pt-2" />
          <h4 className="text-xs font-medium text-[var(--text,#1F1E1B)]">Denoise</h4>
          <SliderControl
            label="Luminance"
            value={displayedState.detail.denoiseLuminance}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                detail: { ...prev.detail, denoiseLuminance: value },
              }))
            }
            format={(value) => value.toFixed(2)}
            {...sliderEvents}
          />
          <SliderControl
            label="Color"
            value={displayedState.detail.denoiseColor}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                detail: { ...prev.detail, denoiseColor: value },
              }))
            }
            format={(value) => value.toFixed(2)}
            {...sliderEvents}
          />

          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={() => onQuickFixGroupReset('detail' as QuickFixGroupKey)}
              disabled={controlsDisabled}
            >
              Reset detail
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <QuickFixGroup title="Grain">
        <div className="space-y-4">
          <SliderControl
            label="Amount"
            value={displayedState.grain.amount}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                grain: { ...prev.grain, amount: value },
              }))
            }
            format={(value) => `${Math.round(value * 100)}%`}
            {...sliderEvents}
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
                    className={`rounded border px-2 py-1.5 text-xs font-medium ${selected
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

      <QuickFixGroup title="Vignette">
        <div className="space-y-4">
          <SliderControl
            label="Amount"
            value={displayedState.vignette.amount}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                vignette: { ...prev.vignette, amount: value },
              }))
            }
            {...sliderEvents}
          />
          <SliderControl
            label="Midpoint"
            value={displayedState.vignette.midpoint}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                vignette: { ...prev.vignette, midpoint: value },
              }))
            }
            {...sliderEvents}
          />
          <SliderControl
            label="Roundness"
            value={displayedState.vignette.roundness}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                vignette: { ...prev.vignette, roundness: value },
              }))
            }
            {...sliderEvents}
          />
          <SliderControl
            label="Feather"
            value={displayedState.vignette.feather}
            min={0}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                vignette: { ...prev.vignette, feather: value },
              }))
            }
            {...sliderEvents}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
              onClick={() => onQuickFixGroupReset('vignette')}
              disabled={controlsDisabled}
            >
              Reset vignette
            </button>
          </div>
        </div>
      </QuickFixGroup>

      <QuickFixGroup title="Geometry">
        <div className="space-y-4">
          <SliderControl
            label="Vertical"
            value={displayedState.geometry.vertical}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                geometry: { ...prev.geometry, vertical: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
          />
          <SliderControl
            label="Horizontal"
            value={displayedState.geometry.horizontal}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                geometry: { ...prev.geometry, horizontal: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
          />
          <div className="border-t border-[var(--border,#EDE1C6)] pt-2" />
          <h4 className="text-xs font-medium text-[var(--text,#1F1E1B)]">Distortion</h4>
          <SliderControl
            label="K1 (Main)"
            value={displayedState.geometry.distortionK1}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                geometry: { ...prev.geometry, distortionK1: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
          />
          <SliderControl
            label="K2 (Fine)"
            value={displayedState.geometry.distortionK2}
            min={-1}
            max={1}
            step={0.05}
            disabled={controlsDisabled}
            onChange={(value) =>
              updateLiveState((prev) => ({
                ...prev,
                geometry: { ...prev.geometry, distortionK2: value },
              }))
            }
            format={(value) => formatSigned(value)}
            {...sliderEvents}
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

export const QuickFixPanel = memo(QuickFixPanelComponent)
