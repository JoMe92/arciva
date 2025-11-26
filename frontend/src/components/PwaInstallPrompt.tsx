import { useCallback, useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const IOS_PROMPT_TEXT =
  'To install Arciva on iOS, open the Share menu in Safari and pick “Add to Home Screen”.'

function useIsIosStandalone(): [boolean, boolean] {
  const detectIos = () => {
    if (typeof window === 'undefined') return false
    const ua = window.navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod/.test(ua)
  }

  const detectStandalone = () => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ||
      false
    )
  }

  const [isIos] = useState(detectIos)
  const [isStandalone, setIsStandalone] = useState(detectStandalone)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const listener = (event: MediaQueryListEvent) => setIsStandalone(event.matches)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(listener)
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', listener)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(listener)
      }
    }
  }, [])

  return [isIos, isStandalone]
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [promptVisible, setPromptVisible] = useState(false)
  const [iosHintDismissed, setIosHintDismissed] = useState(false)
  const [hasInstalled, setHasInstalled] = useState(false)
  const [isIos, isStandalone] = useIsIosStandalone()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const beforeInstallHandler = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setPromptVisible(true)
    }

    const installedHandler = () => {
      setHasInstalled(true)
      setPromptVisible(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', beforeInstallHandler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const shouldShowIosHint = useMemo(
    () => isIos && !isStandalone && !iosHintDismissed && !hasInstalled,
    [isIos, isStandalone, iosHintDismissed, hasInstalled]
  )

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return
    }

    setPromptVisible(false)
    deferredPrompt.prompt()

    try {
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setHasInstalled(true)
      }
    } catch (error) {
      console.error('Failed to prompt install', error)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setPromptVisible(false)
  }, [])

  if (!promptVisible && !shouldShowIosHint) {
    return null
  }

  return (
    <div className="install-hint" role="status" aria-live="polite">
      {promptVisible && (
        <div className="install-hint__card">
          <div>
            <p className="install-hint__title">Install Arciva</p>
            <p className="install-hint__body">
              Add Arciva to your home screen for fullscreen access and offline caching.
            </p>
          </div>
          <div className="install-hint__actions">
            <button type="button" className="install-hint__dismiss" onClick={handleDismiss}>
              Not now
            </button>
            <button type="button" className="install-hint__cta" onClick={handleInstall}>
              Install
            </button>
          </div>
        </div>
      )}

      {shouldShowIosHint && (
        <div className="install-hint__card install-hint__card--info">
          <div>
            <p className="install-hint__title">Install on iOS</p>
            <p className="install-hint__body">{IOS_PROMPT_TEXT}</p>
          </div>
          <button
            type="button"
            className="install-hint__dismiss"
            onClick={() => setIosHintDismissed(true)}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
