import React from 'react'
import StoneTrailIcon from './StoneTrailIcon'
import type { ThemeMode } from '../shared/theme'

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
  /**
   * Current theme mode, used for accessible labels when the logo toggles modes.
   */
  mode?: ThemeMode
  /**
   * Optional handler to turn the logo into a light/dark switch.
   */
  onToggleTheme?: () => void
}

/**
 * Displays the Archiver master logo (three pebbles inside a ring) paired
 * with the Archiver wordmark and a supporting slogan. This view is static
 * per the product specification—no hover or pointer affordances.
 */
export function StoneTrailLogo({
  className = '',
  title = 'Archiver',
  slogan = 'Archiver organize once, find forever.',
  showLabel = true,
  mode,
  onToggleTheme,
}: StoneTrailLogoProps) {
  const Wrapper: React.ElementType = onToggleTheme ? 'button' : 'div'
  const interactiveClasses = onToggleTheme
    ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#C78772)]'
    : 'cursor-default'
  const size = showLabel ? 38 : 34
  const label = onToggleTheme
    ? mode === 'dark'
      ? 'Switch to light mode'
      : 'Switch to dark mode'
    : `${title} logo`

  return (
    <Wrapper
      type={onToggleTheme ? 'button' : undefined}
      onClick={onToggleTheme}
      aria-pressed={onToggleTheme ? (mode === 'dark' ? true : false) : undefined}
      aria-label={label}
      className={`stone-trail-logo inline-flex items-center gap-2 select-none font-semibold text-[var(--stone-trail-mark-text,#1F1E1B)] ${interactiveClasses} ${className}`}
    >
      <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center">
        <StoneTrailIcon size={size} title={`${title} logo`} />
      </span>
      {showLabel ? (
        <span className="stone-trail-logo__label flex flex-col gap-0.5 text-[15px] tracking-tight leading-tight" aria-hidden>
          <span className="font-semibold">{title}</span>
          {slogan ? (
            <span className="stone-trail-logo__slogan text-[10px] font-normal uppercase tracking-[0.2em] leading-tight text-[var(--text-muted,#6B645B)]">
              {slogan}
            </span>
          ) : null}
        </span>
      ) : null}
    </Wrapper>
  )
}

export default StoneTrailLogo
