import React from 'react'
import { S } from '../features/projects/utils'

/**
 * Colour tokens used exclusively by the StoneTrailIcon. These mirror
 * the custom CSS variables but provide fallback values. Should you
 * theme the application with different variables, adjust these
 * defaults accordingly.
 */
const TOKENS = {
  circleFill: 'var(--stone-trail-mark-surface, #FBF7EF)',
  circleStroke: 'var(--stone-trail-mark-stroke, #4A463F)',
  dotLargest: 'var(--stone-trail-mark-dot-large, #A56A4A)',
  dotMedium: 'var(--stone-trail-mark-dot-medium, #D7C5A6)',
  dotSmallest: 'var(--stone-trail-mark-dot-small, #4A463F)',
}

export interface StoneTrailIconProps {
  size?: number
  className?: string
  title?: string
}

/**
 * Renders the Stone Trail master mark: three ascending pebbles placed
 * within a circular container. The SVG scales to any requested size
 * and exposes a title for assistive technologies.
 */
export const StoneTrailIcon: React.FC<StoneTrailIconProps> = ({
  size = 32,
  className = '',
  title = 'Stone Trail',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={`block ${className}`}
    >
      <circle cx={S(32)} cy={S(32)} r={S(29)} fill={TOKENS.circleFill} stroke={TOKENS.circleStroke} strokeWidth={S(2)} />
      <circle cx={S(27)} cy={S(40)} r={S(5)} fill={TOKENS.dotLargest} />
      <circle cx={S(34.5)} cy={S(31)} r={S(4)} fill={TOKENS.dotMedium} />
      <circle cx={S(41)} cy={S(22.5)} r={S(3)} fill={TOKENS.dotSmallest} />
    </svg>
  )
}

export default StoneTrailIcon
