import { useCallback, useState } from 'react'

/**
 * Preferencias del entrenamiento que no viven en la base de datos.
 *
 * Sonido y vibración son del dispositivo, no de la cuenta: el móvil del
 * gimnasio y el ordenador de casa no tienen por qué comportarse igual. Por eso
 * van en localStorage y no en `profiles`.
 */

export type Settings = {
  /** Pitido al terminar el descanso. */
  sound: boolean
  /** Vibración al marcar una serie y al terminar el descanso. */
  vibrate: boolean
}

export const DEFAULT_SETTINGS: Settings = { sound: true, vibrate: true }

const KEY = 'trainway.settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS

    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
      vibrate: typeof parsed.vibrate === 'boolean' ? parsed.vibrate : DEFAULT_SETTINGS.vibrate,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Almacenamiento bloqueado: las preferencias duran lo que la pestaña.
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return [settings, update]
}
