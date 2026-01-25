import React from 'react'
import { QuickFixCurvesState } from '../quickFixState'
import { QuickFixGroup } from './QuickFixGroup'
import { SliderControl, SliderControlProps } from './QuickFixSlider'

type QuickFixCurvesProps = {
    state: QuickFixCurvesState
    onChange: (updater: (prev: QuickFixCurvesState) => QuickFixCurvesState) => void
    disabled: boolean
    onReset: () => void
    sliderEvents: Pick<SliderControlProps, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onBlur'>
}

export function QuickFixCurves({ state, onChange, disabled, onReset, sliderEvents }: QuickFixCurvesProps) {
    return (
        <QuickFixGroup title="Curves">
            <div className="space-y-4">
                <p className="text-xs text-[var(--text-muted,#6B645B)]">
                    Full curve editor coming soon. Adjust global intensity of loaded curves here.
                </p>
                <SliderControl
                    label="Intensity"
                    value={state.intensity}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={disabled}
                    onChange={(value) =>
                        onChange((prev) => ({ ...prev, intensity: value }))
                    }
                    {...sliderEvents}
                />
                <div className="flex justify-end">
                    <button
                        type="button"
                        className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
                        onClick={onReset}
                        disabled={disabled}
                    >
                        Reset curves
                    </button>
                </div>
            </div>
        </QuickFixGroup>
    )
}
