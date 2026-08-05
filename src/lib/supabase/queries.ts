import { supabase } from './client'
import type {
  DayWithExercises,
  ExerciseTranslation,
  Intake,
  Profile,
  Program,
  ProgramDay,
  ProgramExercise,
  SetLog,
  WorkoutSession,
} from './types'
import { todayISO } from '@/lib/utils'

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error instanceof Error ? error : new Error(String(error))
  return data as T
}

// --- Perfil -----------------------------------------------------------------

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return data as Profile | null
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  unwrap(await supabase.from('profiles').update(patch).eq('id', userId).select().maybeSingle())
}

// --- Intake y programa ------------------------------------------------------

export async function createIntake(
  intake: Omit<Intake, 'id' | 'created_at'>,
): Promise<Intake> {
  return unwrap(await supabase.from('intakes').insert(intake).select().single()) as Intake
}

export async function getActiveProgram(userId: string): Promise<Program | null> {
  const { data } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data as Program | null
}

export async function getProgramDays(programId: string): Promise<ProgramDay[]> {
  return unwrap(
    await supabase
      .from('program_days')
      .select('*')
      .eq('program_id', programId)
      .order('week')
      .order('day_index'),
  ) as ProgramDay[]
}

export async function getDayWithExercises(programDayId: string): Promise<DayWithExercises | null> {
  const { data: day } = await supabase
    .from('program_days')
    .select('*')
    .eq('id', programDayId)
    .maybeSingle()
  if (!day) return null

  const exercises = unwrap(
    await supabase
      .from('program_exercises')
      .select('*')
      .eq('program_day_id', programDayId)
      .order('position'),
  ) as ProgramExercise[]

  return { ...(day as ProgramDay), exercises }
}

/**
 * En qué semana del bloque estamos. Se deriva de la fecha de inicio, no se
 * guarda: así no hay un contador que se desincronice si alguien se salta días.
 */
export function currentWeek(program: Program, on: Date = new Date()): number {
  const start = new Date(`${program.starts_on}T00:00:00`)
  const elapsedDays = Math.floor((on.getTime() - start.getTime()) / 86_400_000)
  return Math.min(program.weeks, Math.max(1, Math.floor(elapsedDays / 7) + 1))
}

// --- Sesiones ---------------------------------------------------------------

export async function getSessionFor(
  userId: string,
  programDayId: string,
  date = todayISO(),
): Promise<WorkoutSession | null> {
  const { data } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('program_day_id', programDayId)
    .eq('performed_on', date)
    .maybeSingle()
  return data as WorkoutSession | null
}

/** Idempotente: si ya existe la sesión de ese día, la devuelve en vez de fallar. */
export async function startSession(
  userId: string,
  programDayId: string,
  date = todayISO(),
): Promise<WorkoutSession> {
  const existing = await getSessionFor(userId, programDayId, date)
  if (existing) return existing

  return unwrap(
    await supabase
      .from('workout_sessions')
      .insert({ user_id: userId, program_day_id: programDayId, performed_on: date })
      .select()
      .single(),
  ) as WorkoutSession
}

export async function completeSession(
  sessionId: string,
  patch: { session_rpe?: number | null; notes?: string | null } = {},
): Promise<void> {
  unwrap(
    await supabase
      .from('workout_sessions')
      .update({ completed_at: new Date().toISOString(), ...patch })
      .eq('id', sessionId)
      .select()
      .maybeSingle(),
  )
}

export async function getSessionsForProgram(
  userId: string,
  programDayIds: string[],
): Promise<WorkoutSession[]> {
  if (programDayIds.length === 0) return []
  return unwrap(
    await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('program_day_id', programDayIds),
  ) as WorkoutSession[]
}

// --- Historial de series ----------------------------------------------------

export async function getSetLogs(sessionId: string): Promise<SetLog[]> {
  return unwrap(
    await supabase.from('set_logs').select('*').eq('session_id', sessionId).order('set_index'),
  ) as SetLog[]
}

/**
 * Últimas series de cada ejercicio prescrito, para calcular la progresión.
 *
 * Se pide por `program_exercise_id` de todo el bloque y no por el del día,
 * porque el mismo ejercicio aparece en las 4 semanas con filas distintas.
 */
export async function getHistoryFor(
  exerciseIds: string[],
  limitPerExercise = 40,
): Promise<Record<string, SetLog[]>> {
  if (exerciseIds.length === 0) return {}

  const { data } = await supabase
    .from('set_logs')
    .select('*, program_exercises!inner(exercise_id)')
    .in('program_exercises.exercise_id', exerciseIds)
    .eq('done', true)
    .order('logged_at', { ascending: false })
    .limit(limitPerExercise * exerciseIds.length)

  const rows = (data ?? []) as (SetLog & { program_exercises: { exercise_id: string } })[]
  const grouped: Record<string, SetLog[]> = {}

  for (const row of rows) {
    const key = row.program_exercises.exercise_id
    ;(grouped[key] ??= []).push(row)
  }
  return grouped
}

// --- Traducciones -----------------------------------------------------------

export async function getTranslations(
  exerciseIds: string[],
  locale = 'es',
): Promise<Record<string, ExerciseTranslation>> {
  if (exerciseIds.length === 0) return {}

  const { data } = await supabase
    .from('exercise_translations')
    .select('*')
    .eq('locale', locale)
    .in('exercise_id', exerciseIds)

  const map: Record<string, ExerciseTranslation> = {}
  for (const t of (data ?? []) as ExerciseTranslation[]) map[t.exercise_id] = t
  return map
}
