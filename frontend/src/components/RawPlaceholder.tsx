import React, { useId } from 'react'
import type { PlaceholderRatio } from '../shared/placeholder'
import { RATIO_DIMENSIONS, toPlaceholderRatio as ratioFromString } from '../shared/placeholder'

type RawPlaceholderProps = {
  ratio?: PlaceholderRatio
  className?: string
  title?: string
  preserveAspectRatio?: 'xMidYMid meet' | 'xMidYMid slice'
  fit?: 'fill' | 'contain'
}

/**
 * Canonical "Raw Model" placeholder artwork. Renders as an SVG that scales
 * with its container while preserving the requested aspect ratio. The
 * background and motif colors derive from CSS variables with baked-in
 * fallbacks for environments that have not defined the tokens yet.
 */
export function RawPlaceholder({
  ratio = '1x1',
  className = '',
  title = 'Placeholder image',
  preserveAspectRatio = 'xMidYMid meet',
  fit = 'fill',
}: RawPlaceholderProps) {
  const gradientId = useId()
  const specs = RATIO_DIMENSIONS[ratio] ?? RATIO_DIMENSIONS['1x1']
  const { width, height } = specs
  const viewBox = `0 0 ${width} ${height}`

  const minSide = Math.min(width, height)
  const pad = minSide * 0.1

  const circleRadius = minSide * 0.12
  const circleCx = width - pad - circleRadius
  const circleCy = pad + circleRadius

  const barHeight = minSide * 0.16
  const barWidth = Math.min(width * 0.56, width - pad * 2)
  const barX = pad
  const barY = height - pad - barHeight
  const barRadius = barHeight / 2.1

  const sizeStyle: React.CSSProperties =
    fit === 'contain'
      ? { width: '100%', height: 'auto', maxHeight: '100%', maxWidth: '100%' }
      : { width: '100%', height: '100%' }

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={{
        display: 'block',
        background: 'var(--placeholder-bg-beige,#F3EBDD)',
        ...sizeStyle,
      }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--placeholder-bg-start,#FBF7EF)" />
          <stop offset="100%" stopColor="var(--placeholder-bg-stop,#EADFCB)" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill={`url(#${gradientId})`} />
      <rect
        x={barX}
        y={barY}
        width={barWidth}
        height={barHeight}
        rx={barRadius}
        fill="var(--placeholder-motif-bar,#4A463F)"
        opacity={0.9}
      />
      <circle
        cx={circleCx}
        cy={circleCy}
        r={circleRadius}
        fill="var(--placeholder-motif-circle,#A56A4A)"
        opacity={0.9}
      />
    </svg>
  )
}

type FrameProps = {
  ratio?: PlaceholderRatio
  className?: string
  title?: string
}

/**
 * Wrapper that centres the Raw Model artwork inside a container and applies
 * the canonical beige background colour. Use `mode="contain"` for square
 * thumbnail slots so non-matching ratios letterbox within the frame.
 */
export function RawPlaceholderFrame({ ratio = '1x1', className = '', title }: FrameProps) {
  return (
    <div
      className={`relative flex items-center justify-center bg-[var(--placeholder-bg-beige,#F3EBDD)] ${className}`}
    >
      <RawPlaceholder
        ratio={ratio}
        title={title ?? 'Placeholder image'}
        preserveAspectRatio="xMidYMid meet"
        fit="contain"
      />
    </div>
  )
}

export const toPlaceholderRatio = ratioFromString
export type { PlaceholderRatio } from '../shared/placeholder'
