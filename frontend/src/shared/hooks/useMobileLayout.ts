import React from 'react'

const MOBILE_BREAKPOINT = 768

const computeIsMobileLayout = () => {
  if (typeof window === 'undefined') return false
  const width = window.innerWidth
  const prefersPortrait =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: portrait)').matches
      : window.innerHeight >= window.innerWidth
  return width < MOBILE_BREAKPOINT && prefersPortrait
}

/**
 * Returns true when the viewport is in the "mobile portrait" mode described by the
 * product spec (width below the breakpoint and portrait orientation when available).
 */
export function useMobileLayout(): boolean {
  const [isMobile, setIsMobile] = React.useState(() => computeIsMobileLayout())

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handleChange = () => {
      setIsMobile(computeIsMobileLayout())
    }
    window.addEventListener('resize', handleChange)
    window.addEventListener('orientationchange', handleChange)
    // Sync initial value in case SSR or hydration mismatch occurs
    handleChange()
    return () => {
      window.removeEventListener('resize', handleChange)
      window.removeEventListener('orientationchange', handleChange)
    }
  }, [])

  return isMobile
}

export default useMobileLayout
