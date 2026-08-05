import { roundToHalf } from '@/lib/utils'
import type { LastPerformance, ProgressionScheme, Target } from './types'

/** Barra olímpica vacía. Por debajo, el deload deja de tener sentido. */
const MIN_WEIGHT_KG = 20
const DELOAD_FACTOR = 0.9

export const CALIBRATION_NOTE =
  'Semana de calibración: usa un peso donde las últimas 2 reps cuesten. Se anota y a partir de aquí Trainway ajusta solo.'

const INTENSITY_NOTE = 'Sube un nivel en la máquina manteniendo el mismo tiempo.'

/** "8-10" -> [8,10] · "12" -> [12,12] · "muchas" -> null */
export function parseRepRange(input: string): [number, number] | null {
  const text = input.trim()
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(text)
  if (range) {
    const lo = Number(range[1])
    const hi = Number(range[2])
    return lo <= hi ? [lo, hi] : null
  }
  const single = /^(\d+)$/.exec(text)
  return single ? [Number(single[1]), Number(single[1])] : null
}

/** Solo cuentan las series que el usuario marcó. Una serie sin marcar no ocurrió. */
function completedSets(last: LastPerformance) {
  return last.sets.filter((s) => s.done)
}

/** El peso real levantado manda sobre el prescrito: el usuario pudo calibrar distinto. */
function workingWeight(last: LastPerformance, fallback: number | null): number | null {
  const weights = completedSets(last)
    .map((s) => s.weight)
    .filter((w): w is number => w !== null)
  return weights.length > 0 ? Math.max(...weights) : fallback
}

function applyDeload(weight: number | null): number | null {
  if (weight === null) return null
  return Math.max(MIN_WEIGHT_KG, roundToHalf(weight * DELOAD_FACTOR))
}

/**
 * Calcula el objetivo de la próxima vez que toque este ejercicio.
 *
 * Función pura: sin red, sin base de datos, sin fechas. Se llama al abrir la
 * sesión leyendo el último registro real, no en un proceso por lotes. Por eso
 * saltarse un día no rompe el plan.
 */
export function nextTarget(
  current: Target,
  scheme: ProgressionScheme,
  last: LastPerformance | null,
): Target {
  // Primer contacto con el ejercicio: no hay base para prescribir carga.
  if (!last || last.sets.length === 0) {
    return {
      ...current,
      weight: scheme.type === 'time' || scheme.type === 'intensity' ? current.weight : null,
      note: scheme.type === 'time' || scheme.type === 'intensity' ? current.note : CALIBRATION_NOTE,
    }
  }

  if (scheme.type === 'time') {
    const done = completedSets(last).length > 0
    const at = current.durationSeconds ?? 0
    return {
      ...current,
      durationSeconds: done ? Math.min(at + scheme.incrementSeconds, scheme.maxSeconds) : at,
    }
  }

  if (scheme.type === 'intensity') {
    const done = completedSets(last).length > 0
    return { ...current, note: done ? INTENSITY_NOTE : current.note }
  }

  const base = workingWeight(last, current.weight)

  if (last.failedFloorStreak >= 2) {
    return { ...current, weight: applyDeload(base), note: 'Descarga: bajamos un 10% para volver a progresar.' }
  }

  const done = completedSets(last)
  const allSetsDone = done.length >= current.sets

  if (!allSetsDone || base === null) return { ...current, weight: base, note: null }

  if (scheme.type === 'linear') {
    return { ...current, weight: roundToHalf(base + scheme.incrementKg), note: null }
  }

  // Doble progresión: solo sube el peso cuando TODAS las series llegan al tope.
  const ceiling = current.repRange?.[1]
  const allAtCeiling =
    ceiling !== undefined && done.every((s) => s.reps !== null && s.reps >= ceiling)

  return {
    ...current,
    weight: allAtCeiling ? roundToHalf(base + scheme.incrementKg) : base,
    note: null,
  }
}

/**
 * Semana 4 de cada bloque. Volumen al 60%, intensidad al 90%.
 * Es lo que convierte un mesociclo en algo sostenible en vez de una escalada
 * hasta el agotamiento.
 */
export function deloadTarget(t: Target): Target {
  return {
    ...t,
    sets: Math.max(1, Math.round(t.sets * 0.6)),
    weight: t.weight === null ? null : roundToHalf(t.weight * DELOAD_FACTOR),
    durationSeconds: t.durationSeconds === null ? null : Math.round(t.durationSeconds * 0.6),
  }
}
