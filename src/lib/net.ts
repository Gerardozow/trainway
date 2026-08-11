/**
 * Cuánto se espera a la red antes de tirar de lo guardado.
 *
 * No es un capricho de rendimiento. postgrest-js reintenta los fallos de red
 * tres veces con espera creciente (1 s, 2 s, 4 s), así que una petición que no
 * va a salir tarda unos ocho segundos en rendirse. Ocho segundos de reloj de
 * arena, de pie en el gimnasio, para acabar leyendo algo que ya estaba en el
 * teléfono.
 *
 * Y `navigator.onLine` no sirve para decidirlo: en el wifi del gimnasio sin
 * salida a internet vale `true`, que es justo el caso que hay que cubrir.
 */
export const SLOW_NETWORK_MS = 3500

export function delay<T = null>(ms: number, value: T = null as T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * Lo primero que llegue: la red o el reloj.
 *
 * `fallback` se evalúa solo si la red pierde o falla, para no hacer trabajo de
 * más en el camino bueno. Los errores que se quieran propagar tal cual —"ese
 * día no existe" y parecidos— se declaran en `rethrow`.
 */
export async function raceWithFallback<T>(options: {
  network: Promise<T>
  fallback: () => Promise<T | null>
  timeoutMs?: number
  rethrow?: (error: unknown) => boolean
}): Promise<T> {
  const { network, fallback, timeoutMs = SLOW_NETWORK_MS, rethrow } = options

  const settled = network.then(
    (value) => ({ value }),
    (error: unknown) => {
      if (rethrow?.(error)) throw error
      return { value: null }
    },
  )

  const winner = await Promise.race([settled, delay(timeoutMs, { value: null })])
  if (winner.value !== null) return winner.value

  const cached = await fallback()
  if (cached !== null) return cached

  // Sin nada local no queda más que esperar a la red, con su error si lo hay.
  return await network
}
