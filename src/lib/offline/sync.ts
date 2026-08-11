import { supabase } from '@/lib/supabase/client'
import {
  flushQueue,
  pendingCount,
  type SessionRow,
  type SetLogRow,
  type SyncTarget,
} from './queue'

const POLL_MS = 30_000
const MAX_BACKOFF_MS = 5 * 60_000

/** Adapta el cliente de Supabase a lo que la cola necesita. */
export const supabaseTarget: SyncTarget = {
  async upsertSetLogs(rows: SetLogRow[]) {
    const { error } = await supabase.from('set_logs').upsert(rows, { onConflict: 'client_id' })
    return { error }
  },

  async upsertSessions(rows: SessionRow[]) {
    // Por id: el móvil lo eligió, así que reintentar es idempotente. Un choque
    // con la restricción (usuario, día, fecha) sale como error y lo resuelve la
    // cola reapuntando las series.
    const { error } = await supabase.from('workout_sessions').upsert(rows, { onConflict: 'id' })
    return { error }
  },

  async findSessionId(userId, programDayId, performedOn) {
    const { data } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('program_day_id', programDayId)
      .eq('performed_on', performedOn)
      .maybeSingle()
    return (data as { id: string } | null)?.id ?? null
  },
}

type Listener = (pending: number) => void

let listeners: Listener[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let backoff = POLL_MS
let running = false

async function notify(): Promise<void> {
  const n = await pendingCount()
  for (const fn of listeners) fn(n)
}

async function tick(): Promise<void> {
  if (running) return
  running = true

  try {
    const pending = await pendingCount()
    if (pending > 0 && navigator.onLine !== false) {
      const { failed } = await flushQueue(supabaseTarget)
      // Con fallos se espacia el reintento; en cuanto va bien, vuelve al ritmo normal.
      backoff = failed > 0 ? Math.min(backoff * 2, MAX_BACKOFF_MS) : POLL_MS
    }
    await notify()
  } catch {
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  } finally {
    running = false
    schedule()
  }
}

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void tick(), backoff)
}

let debounce: ReturnType<typeof setTimeout> | null = null

/**
 * Sube lo pendiente en cuanto se deja de escribir.
 *
 * El sondeo cada 30 s existe como red de seguridad, no como mecanismo
 * principal: en el gimnasio la gente marca una serie y bloquea el teléfono. Los
 * 2 s de espera agrupan la ráfaga de ediciones de una misma serie (peso, reps,
 * check) en una sola subida.
 */
export function scheduleFlush(delayMs = 2000): void {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    debounce = null
    backoff = POLL_MS
    void tick()
  }, delayMs)
}

/** Arranca el sincronizador. Devuelve la función para detenerlo. */
export function startSync(onChange?: Listener): () => void {
  if (onChange) listeners.push(onChange)

  const onOnline = () => {
    backoff = POLL_MS
    void tick()
  }

  window.addEventListener('online', onOnline)
  void tick()

  return () => {
    window.removeEventListener('online', onOnline)
    if (onChange) listeners = listeners.filter((l) => l !== onChange)
    if (listeners.length === 0 && timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}

/** Vaciado inmediato, para el botón de reintentar y antes de cerrar sesión. */
export async function syncNow(): Promise<{ synced: number; failed: number }> {
  const result = await flushQueue(supabaseTarget)
  await notify()
  return result
}
