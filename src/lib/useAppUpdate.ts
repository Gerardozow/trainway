import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Cada cuánto se pregunta si hay versión nueva.
 *
 * Una PWA instalada puede pasar semanas sin cerrarse: sin este sondeo el
 * navegador solo mira al arrancar y el aviso no llegaría nunca.
 */
export const UPDATE_CHECK_MS = 60 * 60 * 1000

/** Cuánto se le da al cambio de controlador antes de recargar a mano. */
export const RELOAD_FALLBACK_MS = 2500

export type AppUpdate = {
  /** Hay una versión descargada esperando a que se acepte. */
  ready: boolean
  /** Aceptarla: activa el service worker nuevo y recarga. */
  apply: () => void
  /** Ocultar el aviso hasta el siguiente arranque. */
  dismiss: () => void
  applying: boolean
}

/**
 * El aviso de "hay versión nueva".
 *
 * Se pregunta en vez de recargar solo porque recargar tira lo que hay en
 * pantalla, y en esta app eso puede ser el descanso corriendo con el móvil en
 * el banco. Las series ya están guardadas en el móvil, así que la recarga no
 * pierde datos — pero sí el sitio donde estabas.
 */
export function useAppUpdate(): AppUpdate {
  const [ready, setReady] = useState(false)
  const [applying, setApplying] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let stopChecking = () => {}

    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setReady(true)
        setDismissed(false)
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return

        // Sin señal, `update()` falla y deja un error en la consola cada hora.
        const check = () => {
          if (navigator.onLine) void registration.update()
        }
        const timer = setInterval(check, UPDATE_CHECK_MS)

        // Volver a la app es el momento natural para mirar: es cuando el
        // usuario está a punto de usarla y todavía no ha empezado nada.
        const onVisible = () => {
          if (document.visibilityState === 'visible') check()
        }
        document.addEventListener('visibilitychange', onVisible)

        stopChecking = () => {
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      },
    })

    return () => stopChecking()
  }, [])

  const apply = useCallback(() => {
    setApplying(true)
    void updateRef.current?.(true)

    /*
     * La recarga normal la dispara el cambio de controlador, pero solo cuenta
     * como actualización si YA había un service worker mandando cuando se
     * registró. En la primera visita no lo hay: el aviso salía, se aceptaba y
     * no pasaba nada. Esto lo cierra sin depender de ese detalle.
     *
     * Si la recarga buena llega antes, esta se va con la página.
     */
    setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS)
  }, [])

  const dismiss = useCallback(() => setDismissed(true), [])

  return { ready: ready && !dismissed, apply, dismiss, applying }
}
