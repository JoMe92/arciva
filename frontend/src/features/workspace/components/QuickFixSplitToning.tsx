import React from 'react'
import { QuickFixSplitToningState } from '../quickFixState'
import { QuickFixGroup } from './QuickFixGroup'
import { SliderControl, SliderControlProps } from './QuickFixSlider'

type QuickFixSplitToningProps = {
    state: QuickFixSplitToningState
    onChange: (updater: (prev: QuickFixSplitToningState) => QuickFixSplitToningState) => void
    disabled: boolean
    onReset: () => void
    sliderEvents: Pick<SliderControlProps, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onBlur'>
}

export function QuickFixSplitToning({ state, onChange, disabled, onReset, sliderEvents }: QuickFixSplitToningProps) {
    return (
        <QuickFixGroup title="Split Toning">
            <div className="space-y-4">
                {/* Highlights */}
                <div className="space-y-2 rounded bg-[var(--surface-muted,#F3EBDD)] p-3">
                    <h4 className="text-xs font-semibold text-[var(--text,#1F1E1B)]">Highlights</h4>
                    <SliderControl
                        label="Hue"
                        value={state.highlightHue}
                        min={0}
                        max={360}
                        step={1}
                        disabled={disabled}
                        onChange={(v) => onChange((prev) => ({ ...prev, highlightHue: v }))}
                        format={(v) => Math.round(v).toString()}
                        {...sliderEvents}
                    />
                    <SliderControl
                        label="Saturation"
                        value={state.highlightSat}
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={disabled}
                        onChange={(v) => onChange((prev) => ({ ...prev, highlightSat: v }))}
                        {...sliderEvents}
                    />
                </div>

                {/* Shadows */}
                <div className="space-y-2 rounded bg-[var(--surface-muted,#F3EBDD)] p-3">
                    <h4 className="text-xs font-semibold text-[var(--text,#1F1E1B)]">Shadows</h4>
                    <SliderControl
                        label="Hue"
                        value={state.shadowHue}
                        min={0}
                        max={360}
                        step={1}
                        disabled={disabled}
                        onChange={(v) => onChange((prev) => ({ ...prev, shadowHue: v }))}
                        format={(v) => Math.round(v).toString()}
                        {...sliderEvents}
                    />
                    <SliderControl
                        label="Saturation"
                        value={state.shadowSat}
                        min={0}
                        max={1}
                        step={0.05}
                        disabled={disabled}
                        onChange={(v) => onChange((prev) => ({ ...prev, shadowSat: v }))}
                        {...sliderEvents}
                    />
                </div>

                <SliderControl
                    label="Balance"
                    value={state.balance}
                    min={-1}
                    max={1}
                    step={0.05}
                    disabled={disabled}
                    onChange={(v) => onChange((prev) => ({ ...prev, balance: v }))}
                    {...sliderEvents}
                />

                <div className="flex justify-end">
                    <button
                        type="button"
                        className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
                        onClick={onReset}
                        disabled={disabled}
                    >
                        Reset split toning
                    </button>
                </div>
            </div>
        </QuickFixGroup>
    )
}
