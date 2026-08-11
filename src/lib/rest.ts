/**
 * El descanso en curso, guardado fuera de React.
 *
 * Entre serie y serie es normal salir de la app, bloquear el móvil o recargar
 * sin querer. Si el temporizador vive solo en memoria, cualquiera de esas cosas
 * lo mata y hay que contar de cabeza. Guardar el instante de arranque —no el
 * tiempo restante— hace que siga siendo correcto aunque la pestaña estuviera
 * congelada.
 */

export type RestState = {
  seconds: number
  startedAt: number
}

const KEY = 'trainway.rest'

/** Un descanso de hace media hora no es un descanso: es una app que se quedó abierta. */
const MAX_AGE_MS = 15 * 60 * 1000

export function loadRest(now: number = Date.now()): RestState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<RestState>
    if (typeof parsed.seconds !== 'number' || typeof parsed.startedAt !== 'number') return null
    if (now - parsed.startedAt > MAX_AGE_MS) {
      saveRest(null)
      return null
    }

    return { seconds: parsed.seconds, startedAt: parsed.startedAt }
  } catch {
    // Almacenamiento bloqueado o JSON corrupto: sin temporizador, pero sin caerse.
    return null
  }
}

export function saveRest(state: RestState | null): void {
  try {
    if (state === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Modo privado de Safari. El temporizador sigue funcionando en memoria.
  }
}
