import type { ProgramDay, SetLog, Units, WorkoutSession } from './supabase/types'
import { formatDuration, roundToHalf, todayISO, weightUnit } from './utils'

/**
 * Lecturas derivadas del historial.
 *
 * Todo lo de aquí es función pura sobre las filas que ya trae `getHistoryFor`:
 * ni red ni base de datos. La progresión vive en `lib/progression` porque
 * decide qué hacer; esto solo cuenta qué pasó.
 */

export type PreviousSet = {
  weight: number | null
  reps: number | null
  durationSeconds: number | null
}

export type PreviousSession = {
  /** Fecha local en ISO corto (YYYY-MM-DD). */
  date: string
  /** Días transcurridos desde entonces. 1 = ayer. */
  daysAgo: number
  sets: PreviousSet[]
}

/** Diferencia en días entre dos fechas ISO cortas, sin sustos de horario de verano. */
export function daysBetween(from: string, to: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/**
 * El día —el del usuario— en que se registró una serie.
 *
 * `logged_at` llega en UTC. Cortar la cadena por el décimo carácter es rápido y
 * está mal: en México son seis horas de desfase, así que todo lo entrenado
 * después de las seis de la tarde cae en el día siguiente. Una sesión de martes
 * por la noche aparecía como miércoles, se partía en dos si cruzaba la
 * medianoche UTC, y "la vez pasada" no encontraba nada.
 */
export function localDay(loggedAt: string): string {
  return todayISO(new Date(loggedAt))
}

/** Series marcadas agrupadas por día, de la más reciente a la más antigua. */
export function groupDoneByDay(history: SetLog[] | undefined): [string, SetLog[]][] {
  const byDay = new Map<string, SetLog[]>()

  for (const log of history ?? []) {
    if (!log.done) continue
    const day = localDay(log.logged_at)
    const bucket = byDay.get(day)
    if (bucket) bucket.push(log)
    else byDay.set(day, [log])
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, logs]) => [day, [...logs].sort((a, b) => a.set_index - b.set_index)] as [string, SetLog[]])
}

/**
 * La última vez que se hizo este ejercicio, sin contar hoy.
 *
 * Excluir hoy no es un detalle: en cuanto marcas la primera serie, ese registro
 * es el más reciente y "la vez pasada" pasaría a enseñarte lo que acabas de
 * hacer hace diez segundos.
 */
export function previousSession(
  history: SetLog[] | undefined,
  today: string = todayISO(),
): PreviousSession | null {
  const days = groupDoneByDay(history).filter(([day]) => day < today)
  const latest = days[0]
  if (!latest) return null

  const [date, logs] = latest
  return {
    date,
    daysAgo: daysBetween(date, today),
    sets: logs.map((l) => ({
      weight: l.weight,
      reps: l.reps,
      durationSeconds: l.duration_seconds,
    })),
  }
}

// --- Cómo se lee ------------------------------------------------------------

/** "60 kg × 8", o "12:00 min" cuando la serie era de tiempo. */
export function formatPreviousSet(set: PreviousSet, units: Units): string {
  if (set.durationSeconds !== null) return `${formatDuration(set.durationSeconds)} min`
  const reps = set.reps ?? '—'
  return set.weight === null ? `${reps} reps` : `${set.weight} ${weightUnit(units)} × ${reps}`
}

/**
 * El resumen de la sesión anterior.
 *
 * Con el mismo peso en todas las series se saca el peso al frente —
 * "60 kg × 8 · 8 · 7" — porque lo que cambia entre series son las
 * repeticiones, y repetir "60 kg" tres veces solo ocupa sitio.
 */
export function formatPreviousSets(sets: PreviousSet[], units: Units): string {
  if (sets.length === 0) return ''

  const first = sets[0]!
  const sameWeight =
    first.weight !== null &&
    sets.every((s) => s.weight === first.weight && s.durationSeconds === null)

  if (sameWeight) {
    return `${first.weight} ${weightUnit(units)} × ${sets.map((s) => s.reps ?? '—').join(' · ')}`
  }

  return sets.map((s) => formatPreviousSet(s, units)).join(' · ')
}

/** "2026-08-09" -> "09/08". Día antes que mes, como se lee en español. */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}`
}

/** "ayer", "hace 3 días". Para poner la sesión anterior en el tiempo. */
export function formatDaysAgo(daysAgo: number): string {
  if (daysAgo <= 0) return 'hoy'
  if (daysAgo === 1) return 'ayer'
  return `hace ${daysAgo} días`
}

// --- Récords ----------------------------------------------------------------

export type PersonalRecord = {
  exerciseId: string
  weight: number
  reps: number
  /** 1RM estimada con Epley. Sirve para comparar series de distinto rango. */
  estimated1rm: number
  date: string
}

/**
 * Epley: 1RM = peso × (1 + reps/30).
 *
 * Por encima de 12 repeticiones la fórmula se dispara y deja de describir nada
 * real, así que ahí se corta: una serie de 20 cuenta como una de 12.
 */
export function estimate1rm(weight: number, reps: number): number {
  const r = Math.min(Math.max(reps, 1), 12)
  return roundToHalf(weight * (1 + r / 30))
}

/** La mejor serie de cada ejercicio, medida en 1RM estimada. */
export function personalRecords(history: Record<string, SetLog[]>): PersonalRecord[] {
  const records: PersonalRecord[] = []

  for (const [exerciseId, logs] of Object.entries(history)) {
    let best: PersonalRecord | null = null

    for (const log of logs) {
      if (!log.done || log.weight === null || log.reps === null) continue
      if (log.weight <= 0 || log.reps <= 0) continue

      const candidate: PersonalRecord = {
        exerciseId,
        weight: log.weight,
        reps: log.reps,
        estimated1rm: estimate1rm(log.weight, log.reps),
        date: localDay(log.logged_at),
      }

      // A igualdad de 1RM estimada gana la serie más pesada: es la que de
      // verdad demuestra fuerza, no la que suma repeticiones.
      const better =
        !best ||
        candidate.estimated1rm > best.estimated1rm ||
        (candidate.estimated1rm === best.estimated1rm && candidate.weight > best.weight)

      if (better) best = candidate
    }

    if (best) records.push(best)
  }

  return records.sort((a, b) => b.estimated1rm - a.estimated1rm)
}

// --- Racha ------------------------------------------------------------------

/**
 * Entrenamientos completados seguidos, contando hacia atrás desde hoy.
 *
 * Se recorre el plan en orden, no el calendario: así no hace falta saber en qué
 * día de la semana empezó el bloque. El día de hoy no rompe la racha aunque
 * esté sin terminar — todavía da tiempo.
 */
export type WeekMark = {
  /** 1..7 con lunes = 1, como se guarda en program_days. */
  dayIndex: number
  /** Inicial del día: L M X J V S D. */
  initial: string
  /** Hay entrenamiento prescrito ese día. */
  planned: boolean
  /** Se cerró la sesión de ese día. */
  done: boolean
  today: boolean
  /** Ya pasó sin entrenarse lo prescrito. */
  missed: boolean
  title: string | null
}

const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * La semana en siete marcas.
 *
 * En un plan de tres días, cuatro de cada siete veces que se abre la app no hay
 * nada que hacer. Esa pantalla estaba vacía, y vacía no dice lo único que
 * importa un día de descanso: que el descanso está dentro del plan y que la
 * semana va por donde tiene que ir.
 *
 * Los días son una secuencia de verdad —lunes va antes que martes—, así que
 * enumerarlos no es decoración: es la información.
 */
export function weekMarks(args: {
  days: ProgramDay[]
  sessions: WorkoutSession[]
  week: number
  dayIndex: number
}): WeekMark[] {
  const { days, sessions, week, dayIndex } = args

  const completed = new Set(
    sessions.filter((s) => s.completed_at).map((s) => s.program_day_id),
  )

  return INICIALES.map((initial, i) => {
    const index = i + 1
    const day = days.find((d) => d.week === week && d.day_index === index) ?? null
    const done = day ? completed.has(day.id) : false

    return {
      dayIndex: index,
      initial,
      planned: Boolean(day),
      done,
      today: index === dayIndex,
      missed: Boolean(day) && !done && index < dayIndex,
      title: day?.title ?? null,
    }
  })
}

export function sessionStreak(args: {
  days: ProgramDay[]
  sessions: WorkoutSession[]
  week: number
  dayIndex: number
}): number {
  const { days, sessions, week, dayIndex } = args

  const completed = new Set(
    sessions.filter((s) => s.completed_at).map((s) => s.program_day_id),
  )

  const elapsed = days
    .filter((d) => d.week < week || (d.week === week && d.day_index <= dayIndex))
    .sort((a, b) => a.week - b.week || a.day_index - b.day_index)

  let streak = 0

  for (let i = elapsed.length - 1; i >= 0; i--) {
    const day = elapsed[i]!
    const isToday = day.week === week && day.day_index === dayIndex

    if (completed.has(day.id)) {
      streak++
      continue
    }
    if (isToday) continue // aún puede entrenarse
    break
  }

  return streak
}
