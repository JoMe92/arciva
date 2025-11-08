import React from 'react'
import StoneTrailIcon from './StoneTrailIcon'

type StoneTrailLogoProps = {
  /**
   * Additional classes for layout contexts (e.g., flex ordering).
   */
  className?: string
  /**
   * Custom text label. The icon is always described as “logo” for SRs.
   */
  title?: string
  /**
   * Hide the wordmark when space constrained (icon-only presentation).
   */
  showLabel?: boolean
}

/**
 * Displays the Stone Trail master logo (three pebbles inside a ring) paired
 * with the “Stone Trail” wordmark. The element is intentionally static—no
 * hover, focus, or pointer affordances—per the product specification.
 */
export function StoneTrailLogo({ className = '', title = 'Stone Trail', showLabel = true }: StoneTrailLogoProps) {
  return (
    <div className={`stone-trail-logo inline-flex items-center gap-3 cursor-default select-none font-semibold text-[var(--stone-trail-mark-text,#1F1E1B)] ${className}`}>
      <span className="sr-only">{title} logo</span>
      <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center">
        <StoneTrailIcon size={44} title={`${title} logo`} />
      </span>
      {showLabel ? (
        <span className="stone-trail-logo__label text-base tracking-tight leading-tight" aria-hidden>
          {title}
        </span>
      ) : null}
    </div>
  )
}

export default StoneTrailLogo
