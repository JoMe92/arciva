import { useCallback, useState } from 'react'

export type GeneralSettings = {
  language: 'en' | 'de' | 'fr' | 'es'
}

const GENERAL_SETTINGS_KEY = 'stoneTrail:generalSettings'
const DEFAULT_SETTINGS: GeneralSettings = {
  language: 'en',
}

const LANGUAGE_OPTIONS: Array<{ value: GeneralSettings['language']; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
]

function readSettings(): GeneralSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(GENERAL_SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<GeneralSettings>
    if (!parsed || typeof parsed.language !== 'string') return DEFAULT_SETTINGS
    const valid = LANGUAGE_OPTIONS.some((option) => option.value === parsed.language)
    return {
      language: valid
        ? (parsed.language as GeneralSettings['language'])
        : DEFAULT_SETTINGS.language,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persistSettings(settings: GeneralSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GENERAL_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore storage failures
  }
}

export function useGeneralSettings() {
  const [settings, setSettingsState] = useState<GeneralSettings>(() => readSettings())

  const setSettings = useCallback((next: GeneralSettings) => {
    setSettingsState(next)
    persistSettings(next)
  }, [])

  const updateSettings = useCallback((patch: Partial<GeneralSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch }
      persistSettings(next)
      return next
    })
  }, [])

  return { settings, setSettings, updateSettings }
}

export { LANGUAGE_OPTIONS }
