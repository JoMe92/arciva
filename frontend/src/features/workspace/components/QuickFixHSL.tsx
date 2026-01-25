import React, { useState } from 'react'
import { QuickFixHslState } from '../quickFixState'
import { QuickFixGroup } from './QuickFixGroup'
import { SliderControl, SliderControlProps } from './QuickFixSlider'

type HSLChannel = keyof QuickFixHslState

const CHANNELS: { key: HSLChannel; label: string; color: string }[] = [
    { key: 'red', label: 'Red', color: '#EF4444' },
    { key: 'orange', label: 'Orange', color: '#F97316' },
    { key: 'yellow', label: 'Yellow', color: '#EAB308' },
    { key: 'green', label: 'Green', color: '#22C55E' },
    { key: 'aqua', label: 'Aqua', color: '#06B6D4' },
    { key: 'blue', label: 'Blue', color: '#3B82F6' },
    { key: 'purple', label: 'Purple', color: '#A855F7' },
    { key: 'magenta', label: 'Magenta', color: '#EC4899' },
]

type QuickFixHSLProps = {
    state: QuickFixHslState
    onChange: (updater: (prev: QuickFixHslState) => QuickFixHslState) => void
    disabled: boolean
    onReset: () => void
    sliderEvents: Pick<SliderControlProps, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onBlur'>
}

export function QuickFixHSL({ state, onChange, disabled, onReset, sliderEvents }: QuickFixHSLProps) {
    const [activeChannel, setActiveChannel] = useState<HSLChannel>('red')

    const current = state[activeChannel]

    const updateChannel = (key: keyof typeof current, value: number) => {
        onChange((prev) => ({
            ...prev,
            [activeChannel]: { ...prev[activeChannel], [key]: value },
        }))
    }

    return (
        <QuickFixGroup title="HSL">
            <div className="space-y-4">
                {/* Channel Selector */}
                <div className="flex flex-wrap gap-2">
                    {CHANNELS.map(({ key, label, color }) => {
                        const isActive = activeChannel === key
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveChannel(key)}
                                disabled={disabled}
                                title={label}
                                className={`h-6 w-6 rounded-full border border-gray-300 transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${isActive ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                style={{ backgroundColor: color }}
                                aria-label={label}
                                aria-pressed={isActive}
                            />
                        )
                    })}
                </div>

                {/* Sliders for active channel */}
                <div className="space-y-4 rounded bg-[var(--surface-muted,#F3EBDD)] p-3">
                    <h4 className="text-xs font-semibold capitalize text-[var(--text,#1F1E1B)]">{activeChannel}</h4>
                    <SliderControl
                        label="Hue"
                        value={current.hue}
                        min={-30}
                        max={30} // Assuming standard shift range, user can verify
                        step={1}
                        disabled={disabled}
                        onChange={(v) => updateChannel('hue', v)}
                        {...sliderEvents}
                    />
                    <SliderControl
                        label="Saturation"
                        value={current.saturation}
                        min={-1}
                        max={1}
                        step={0.05}
                        disabled={disabled}
                        onChange={(v) => updateChannel('saturation', v)}
                        {...sliderEvents}
                    />
                    <SliderControl
                        label="Luminance"
                        value={current.luminance}
                        min={-1}
                        max={1}
                        step={0.05}
                        disabled={disabled}
                        onChange={(v) => updateChannel('luminance', v)}
                        {...sliderEvents}
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
                        onClick={onReset}
                        disabled={disabled}
                    >
                        Reset HSL
                    </button>
                </div>
            </div>
        </QuickFixGroup>
    )
}
