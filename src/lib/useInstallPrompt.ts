import { useCallback, useEffect, useState } from 'react'

/**
 * Instalar la app en la pantalla de inicio.
 *
 * El service worker ya estaba; lo que faltaba era pedirlo. Chrome y Edge
 * disparan `beforeinstallprompt` y dejan lanzar el diálogo nativo cuando
 * queramos. Safari en iPhone no dispara nada y no hay API: ahí lo único que se
 * puede hacer es explicar el gesto — Compartir, Añadir a pantalla de inicio.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = {
  /** Ya se está ejecutando como app instalada. */
  installed: boolean
  /** Hay diálogo nativo disponible. */
  canPrompt: boolean
  /** Safari en iPhone o iPad: instrucciones en vez de botón. */
  isIOS: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  // Safari en iOS no implementa display-mode y usa esta propiedad suya.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  return displayMode || iosStandalone
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  // El iPad moderno se anuncia como Mac; lo delata la pantalla táctil.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(detectStandalone)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Sin esto el navegador enseña su propia barra cuando le apetece. Nos
      // quedamos el evento para ofrecerlo donde tiene sentido.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const

    await deferred.prompt()
    const { outcome } = await deferred.userChoice

    // El evento se consume: solo sirve una vez.
    setDeferred(null)
    return outcome
  }, [deferred])

  return {
    installed,
    canPrompt: deferred !== null,
    isIOS: detectIOS(),
    promptInstall,
  }
}
