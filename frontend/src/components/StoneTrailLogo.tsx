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
   * A concise slogan shown beneath the wordmark.
   */
  slogan?: string
  /**
   * Hide the wordmark when space constrained (icon-only presentation).
   */
  showLabel?: boolean
}

/**
 * Displays the Arciva master logo (three pebbles inside a ring) paired
 * with the Arciva wordmark and a supporting slogan. This view is static
 * per the product specification—no hover or pointer affordances.
 */
export function StoneTrailLogo({
  className = '',
  title = 'Arciva',
  slogan = 'Organize once. Find forever.',
  showLabel = true,
}: StoneTrailLogoProps) {
  return (
    <div className={`stone-trail-logo inline-flex items-center gap-3 cursor-default select-none font-semibold text-[var(--stone-trail-mark-text,#1F1E1B)] ${className}`}>
      <span className="sr-only">{title} logo</span>
      <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center">
        <StoneTrailIcon size={44} title={`${title} logo`} />
      </span>
      {showLabel ? (
        <span className="stone-trail-logo__label flex flex-col gap-1 text-base tracking-tight leading-tight" aria-hidden>
          <span className="font-semibold">{title}</span>
          {slogan ? (
            <span className="stone-trail-logo__slogan text-[11px] font-normal uppercase tracking-[0.2em] leading-tight text-[var(--text-muted,#6B645B)]">
              {slogan}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

export default StoneTrailLogo
