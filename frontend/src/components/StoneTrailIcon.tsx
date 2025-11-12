import React from 'react'

/**
 * Colour tokens used by the Arciva \"Stone Trail\" pebble mark. Each token mirrors
 * a CSS custom property so the icon automatically adapts to the active theme.
 */
const TOKENS = {
  circleFill: 'var(--stone-trail-mark-surface, #F8F0E3)',
  circleStroke: 'var(--stone-trail-mark-stroke, #8C6A4A)',
  pebbleLarge: 'var(--stone-trail-mark-dot-large, #A56A4A)',
  pebbleMedium: 'var(--stone-trail-mark-dot-medium, #D7C5A6)',
  pebbleSmall: 'var(--stone-trail-mark-dot-small, #4A463F)',
}

export interface StoneTrailIconProps {
  size?: number
  className?: string
  title?: string
}

/**
 * Renders the Arciva master mark: three ascending pebbles inspired by Stone Trail.
 * The SVG is resolution independent and honours the current theme tokens.
 */
export const StoneTrailIcon: React.FC<StoneTrailIconProps> = ({
  size = 32,
  className = '',
  title = 'Arciva',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={`block ${className}`}
    >
      <circle cx="12" cy="12" r="11" fill={TOKENS.circleFill} stroke={TOKENS.circleStroke} strokeWidth="1.2" />
      <ellipse cx="7.5" cy="16.2" rx="4.5" ry="3.4" fill={TOKENS.pebbleLarge} />
      <ellipse cx="13" cy="11.4" rx="3.6" ry="2.8" fill={TOKENS.pebbleMedium} />
      <ellipse cx="17.8" cy="7.2" rx="3" ry="2.3" fill={TOKENS.pebbleSmall} />
    </svg>
  )
}

export default StoneTrailIcon
