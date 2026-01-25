import React, { useState } from 'react'
import { QuickFixCurvesState, CurvePoint } from '../quickFixState'
import { QuickFixGroup } from './QuickFixGroup'
import { SliderControl, SliderControlProps } from './QuickFixSlider'
import { CurveEditor } from './CurveEditor'

type QuickFixCurvesProps = {
    state: QuickFixCurvesState
    onChange: (updater: (prev: QuickFixCurvesState) => QuickFixCurvesState) => void
    disabled: boolean
    onReset: () => void
    sliderEvents: Pick<SliderControlProps, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onBlur'>
}

type Channel = 'master' | 'red' | 'green' | 'blue'

const CHANNELS: { id: Channel; label: string; color: string }[] = [
    { id: 'master', label: 'RGB', color: 'var(--text,#1F1E1B)' },
    { id: 'red', label: 'Red', color: '#EF4444' }, // red-500
    { id: 'green', label: 'Green', color: '#22C55E' }, // green-500
    { id: 'blue', label: 'Blue', color: '#3B82F6' }, // blue-500
]

export function QuickFixCurves({ state, onChange, disabled, onReset, sliderEvents }: QuickFixCurvesProps) {
    const [activeChannel, setActiveChannel] = useState<Channel>('master')

    const points = state[activeChannel]
    const activeColor = CHANNELS.find(c => c.id === activeChannel)?.color || 'currentColor'

    const handlePointsChange = (newPoints: CurvePoint[]) => {
        onChange((prev) => ({
            ...prev,
            [activeChannel]: newPoints,
        }))
    }

    const resetChannel = () => {
        // Default curve is 0,0 to 1,1
        const defaultCurve = [{ x: 0, y: 0 }, { x: 1, y: 1 }]
        handlePointsChange(defaultCurve)
    }

    return (
        <QuickFixGroup title="Curves">
            <div className="space-y-4">
                {/* Channel Select */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--surface-muted,#F3EBDD)] rounded-lg border border-[var(--border,#EDE1C6)]">
                    {CHANNELS.map((channel) => {
                        const isActive = activeChannel === channel.id
                        return (
                            <button
                                key={channel.id}
                                type="button"
                                onClick={() => setActiveChannel(channel.id)}
                                disabled={disabled}
                                className={`
                                    rounded-md py-1 text-[10px] font-bold uppercase tracking-wider transition-all
                                    ${isActive
                                        ? 'bg-[var(--surface,#FFFFFF)] shadow-sm scale-100'
                                        : 'text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)] hover:bg-black/5 scale-95'
                                    }
                                `}
                                style={{
                                    color: isActive ? channel.color : undefined
                                }}
                            >
                                {channel.label}
                            </button>
                        )
                    })}
                </div>

                {/* Editor */}
                <CurveEditor
                    points={points}
                    onChange={handlePointsChange}
                    color={activeColor}
                    disabled={disabled}
                />

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

                <div className="flex justify-between">
                    <button
                        type="button"
                        className="text-xs font-medium text-[var(--text-muted,#6B645B)] hover:text-[var(--text,#1F1E1B)] disabled:opacity-60"
                        onClick={resetChannel}
                        disabled={disabled}
                    >
                        Reset channel
                    </button>

                    <button
                        type="button"
                        className="text-xs font-medium text-[var(--text,#1F1E1B)] underline-offset-2 hover:underline disabled:opacity-60"
                        onClick={onReset}
                        disabled={disabled}
                    >
                        Reset all curves
                    </button>
                </div>
            </div>
        </QuickFixGroup>
    )
}
