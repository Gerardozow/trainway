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
  /**
   * Descanso fijo para todas las series, en segundos.
   *
   * `null` es lo normal: cada ejercicio trae el suyo, y no es el mismo para una
   * sentadilla pesada que para un curl. Esto lo pisa entero, para quien entrena
   * a reloj o tiene el gimnasio lleno y no puede permitirse tres minutos.
   */
  restSeconds: number | null
}

export const DEFAULT_SETTINGS: Settings = { sound: true, vibrate: true, restSeconds: null }

/** Los mismos límites que valida el plan: ni 10 s ni media hora. */
export const REST_MIN = 30
export const REST_MAX = 300
export const REST_STEP = 15

const KEY = 'trainway.settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS

    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_SETTINGS.sound,
      vibrate: typeof parsed.vibrate === 'boolean' ? parsed.vibrate : DEFAULT_SETTINGS.vibrate,
      restSeconds: clampRest(parsed.restSeconds),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Un valor guardado a mano en localStorage no puede sacar el descanso de rango. */
function clampRest(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(REST_MAX, Math.max(REST_MIN, Math.round(value)))
}

/**
 * El descanso que toca: el fijo si se configuró, y si no el del ejercicio.
 *
 * Vive aquí y no en la pantalla de sesión porque es la regla, no la pantalla:
 * un segundo sitio que decidiera lo mismo acabaría decidiéndolo distinto.
 *
 * Cero gana siempre. El plan pone cero en el último ejercicio —los quince
 * minutos de cinta con los que se cierra la sesión— y ahí no hay nada que
 * cronometrar: se acabó, te vas a casa. Un descanso fijo no puede inventarse
 * una espera después del final.
 */
export function restFor(prescribed: number, settings: Settings): number {
  if (prescribed === 0) return 0
  return settings.restSeconds ?? prescribed
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
