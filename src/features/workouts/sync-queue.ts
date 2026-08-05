import { db } from '../../lib/db'
import { pushWorkout, pushSet, pushFinish, pushDeleteSet } from './workout-repository'
import type { PendingOperation, Workout, WorkoutSet } from './workout-types'

/**
 * Una fila que el servidor ya tiene no es un fallo: significa que un intento
 * anterior sí llegó y se perdió la respuesta. Tratarlo como error dejaría la
 * cola atorada para siempre en esa operación, y como la cola se detiene en el
 * primer fallo, nada volvería a subir nunca.
 */
function isAlreadyApplied(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('23505') ||
    lower.includes('duplicate key') ||
    lower.includes('already exists')
  )
}

async function apply(operation: PendingOperation): Promise<void> {
  switch (operation.kind) {
    case 'workout':
      return pushWorkout(operation.payload as Workout)
    case 'set':
      return pushSet(operation.payload as WorkoutSet)
    case 'finish':
      return pushFinish(operation.payload as { id: string; endedAt: string })
    case 'deleteSet':
      return pushDeleteSet(operation.payload as { id: string })
  }
}

/**
 * Sube lo pendiente en el orden en que se creó y se detiene en el primer fallo.
 *
 * El orden importa: una serie no puede subir antes que su entreno, porque la
 * llave foránea la rechazaría. Saltarse la operación fallida y seguir con las
 * siguientes rompería esa dependencia.
 *
 * Nada se borra de local hasta que el servidor confirma. Si algo va a fallar,
 * falla dejando los datos en el dispositivo.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const pending = (await db.syncQueue.toArray()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )

  let sent = 0

  for (const operation of pending) {
    try {
      await apply(operation)
      await db.syncQueue.delete(operation.id)
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isAlreadyApplied(message)) {
        await db.syncQueue.delete(operation.id)
        sent += 1
        continue
      }

      await db.syncQueue.update(operation.id, {
        attempts: operation.attempts + 1,
        lastError: message,
      })

      return { sent, failed: pending.length - sent }
    }
  }

  return { sent, failed: 0 }
}
