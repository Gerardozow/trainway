import { startSession } from '@/lib/supabase/queries'
import type { WorkoutSession } from '@/lib/supabase/types'
import { todayISO } from '@/lib/utils'
import { getLocalSession, patchLocalSession, saveLocalSession } from './queue'
import type { PendingSession } from './db'

/**
 * La sesión de hoy, con o sin red.
 *
 * El orden importa. Primero lo local: si ya se empezó a entrenar, ese id es el
 * que llevan las series que están en la cola y cambiarlo las dejaría huérfanas.
 * Después la red. Y si la red no está, se inventa un id aquí mismo y se sube
 * más tarde — que es lo que convierte "entrena sin conexión" en algo cierto en
 * el sótano de un gimnasio, y no solo mientras no se recargue la página.
 */
export async function resolveSession(
  userId: string,
  programDayId: string,
  options: { date?: string; allowNetwork?: boolean } = {},
): Promise<{ id: string; offline: boolean }> {
  const { date = todayISO(), allowNetwork = true } = options

  const local = await getLocalSession(programDayId, date)
  if (local) return { id: local.id, offline: local.synced === 0 }

  // Cuando ya se sabe que la red no responde, ni se intenta: pedirla otra vez
  // solo suma la espera de los reintentos antes de acabar aquí mismo.
  if (allowNetwork) {
    try {
      const remote: WorkoutSession = await startSession(userId, programDayId, date)
      await saveLocalSession(toPending(remote, 1))
      return { id: remote.id, offline: false }
    } catch {
      // Sigue abajo con un id local.
    }
  }

  const session: PendingSession = {
    id: crypto.randomUUID(),
    userId,
    programDayId,
    performedOn: date,
    startedAt: new Date().toISOString(),
    completedAt: null,
    sessionRpe: null,
    notes: null,
    synced: 0,
  }
  await saveLocalSession(session)
  return { id: session.id, offline: true }
}

function toPending(session: WorkoutSession, synced: 0 | 1): PendingSession {
  return {
    id: session.id,
    userId: session.user_id,
    programDayId: session.program_day_id,
    performedOn: session.performed_on,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    sessionRpe: session.session_rpe,
    notes: session.notes,
    synced,
  }
}

/**
 * Cierra la sesión en local. Se sube con el resto de la cola.
 *
 * Terminar el entrenamiento no puede depender de tener señal: es el momento en
 * que el usuario guarda el móvil y se va.
 */
export async function completeSessionLocal(
  id: string,
  patch: { sessionRpe: number | null; notes: string | null },
): Promise<void> {
  await patchLocalSession(id, {
    completedAt: new Date().toISOString(),
    sessionRpe: patch.sessionRpe,
    notes: patch.notes,
  })
}
