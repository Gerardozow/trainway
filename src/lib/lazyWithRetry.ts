import { lazy, type ComponentType } from 'react'

/**
 * Carga diferida que sobrevive a un despliegue.
 *
 * El HTML que tiene abierto el usuario nombra los chunks con el hash de la
 * versión que cargó. Tras publicar una nueva, esos archivos dejan de existir y
 * cualquier `import()` posterior falla; en el móvil pasa lo mismo cuando la red
 * del gimnasio se cae medio segundo. En los dos casos la pantalla se quedaba en
 * blanco sin explicación.
 *
 * Aquí se reintenta una vez —basta para un corte de red— y, si el archivo de
 * verdad ya no está, se recarga la página una sola vez para coger la versión
 * nueva. El candado en sessionStorage evita el bucle de recargas.
 */

const RELOAD_KEY = 'trainway.chunk-reload'
const RELOAD_COOLDOWN_MS = 60_000

/** Los navegadores describen esto de cuatro formas distintas; todas valen. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported module|Failed to fetch/i.test(
    message,
  )
}

/** Recarga como mucho una vez por minuto. Si ya se intentó, se rinde. */
export function reloadOnce(now: number = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (now - last < RELOAD_COOLDOWN_MS) return false

    sessionStorage.setItem(RELOAD_KEY, String(now))
    window.location.reload()
    return true
  } catch {
    return false
  }
}

/**
 * La firma es la de `React.lazy`, `any` incluido: acepta cualquier componente
 * sea cual sea su forma de props. Acotarlo aquí solo obligaría a cada llamada a
 * repetir el tipo del componente que ya está escrito en su propio archivo.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  { delayMs = 600 }: { delayMs?: number } = {},
) {
  return lazy(async () => {
    try {
      return await load()
    } catch (error) {
      if (!isChunkLoadError(error)) throw error

      await new Promise((resolve) => setTimeout(resolve, delayMs))

      try {
        return await load()
      } catch (again) {
        // El archivo no está: casi siempre porque se publicó una versión nueva.
        if (reloadOnce()) await new Promise(() => {}) // la recarga se lleva la página
        throw again
      }
    }
  })
}
