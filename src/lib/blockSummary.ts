import { getExercise } from '@/lib/catalog'
import type { ProgramExercise, SetLog, WorkoutSession } from '@/lib/supabase/types'

export type BlockSummary = {
  adherence_pct: number
  sessions_completed: number
  sessions_planned: number
  volume_by_muscle: Record<string, number>
  avg_rpe: number | null
  progressed: string[]
  stalled: string[]
  user_notes: string[]
}

/**
 * Comprime un bloque entero en lo que un entrenador miraría de un vistazo.
 *
 * Mandarle a la IA cientos de series crudas cuesta tokens y no mejora la
 * decisión: lo que importa es la tendencia.
 */
export function buildBlockSummary(args: {
  sessions: WorkoutSession[]
  sessionsPlanned: number
  exercises: ProgramExercise[]
  logsByExercise: Record<string, SetLog[]>
}): BlockSummary {
  const { sessions, sessionsPlanned, exercises, logsByExercise } = args

  const completed = sessions.filter((s) => s.completed_at !== null)

  const volume: Record<string, number> = {}
  const progressed: string[] = []
  const stalled: string[] = []

  const seen = new Set<string>()
  for (const pe of exercises) {
    if (seen.has(pe.exercise_id)) continue
    seen.add(pe.exercise_id)

    const logs = (logsByExercise[pe.exercise_id] ?? []).filter((l) => l.done)
    if (logs.length === 0) continue

    // Series efectivas por músculo primario: la métrica que usa un entrenador.
    const catalog = getExercise(pe.exercise_id)
    for (const muscle of catalog?.primaryMuscles ?? []) {
      volume[muscle] = (volume[muscle] ?? 0) + logs.length
    }

    // ¿Subió la carga entre la primera y la última sesión del bloque?
    const ordered = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    const first = ordered[0]?.weight ?? null
    const last = ordered[ordered.length - 1]?.weight ?? null
    const name = catalog?.name ?? pe.exercise_id

    if (first !== null && last !== null) {
      if (last > first) progressed.push(name)
      else if (logs.length >= 6) stalled.push(name)
    }
  }

  const rpes = completed.map((s) => s.session_rpe).filter((r): r is number => r !== null)

  return {
    adherence_pct: sessionsPlanned > 0 ? Math.round((completed.length / sessionsPlanned) * 100) : 0,
    sessions_completed: completed.length,
    sessions_planned: sessionsPlanned,
    volume_by_muscle: volume,
    avg_rpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    progressed,
    stalled,
    user_notes: completed.map((s) => s.notes).filter((n): n is string => Boolean(n?.trim())),
  }
}
