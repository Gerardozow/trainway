import { useEffect } from 'react'

type WakeLockSentinel = { release: () => Promise<void> }
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
}

/**
 * Mantiene la pantalla encendida durante la sesión.
 *
 * Nadie quiere desbloquear el teléfono con las manos llenas de magnesio cada
 * vez que termina una serie. Falla en silencio donde no esté soportado: es una
 * mejora, no un requisito.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        const nav = navigator as WakeLockNavigator
        if (!nav.wakeLock) return
        const lock = await nav.wakeLock.request('screen')
        if (cancelled) void lock.release()
        else sentinel = lock
      } catch {
        // Sin permiso, batería baja o navegador sin soporte. No pasa nada.
      }
    }

    // El sistema suelta el bloqueo al cambiar de pestaña; se vuelve a pedir.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}
