import { plateSet } from './plates'
import type { Units } from './supabase/types'

/**
 * La rampa de calentamiento.
 *
 * El plan prescribe series efectivas: nadie hace 4×6 de sentadilla entrando en
 * frío. Estas series no se registran ni cuentan para la progresión — son una
 * guía, y por eso se calculan aquí en vez de guardarse en la base de datos.
 */

export type WarmupSet = {
  weight: number
  reps: number
}

/** Redondea al múltiplo de `step` más cercano. Con la barra cargada, 47.3 kg no existe. */
function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

/**
 * Barra que lleva el movimiento, o 0 si no hay barra que cargar.
 *
 * Con mancuernas o máquina el peso mínimo no es una barra olímpica, así que la
 * rampa puede empezar mucho más abajo.
 */
export function barFor(equipment: string | null, units: Units): number {
  if (equipment === 'barbell') return plateSet(units).bar
  if (equipment === 'e-z curl bar') return units === 'imperial' ? 25 : 10
  return 0
}

const RAMP = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
]

/**
 * Series de aproximación hasta el peso de trabajo.
 *
 * Devuelve lista vacía cuando no hay nada que aproximar: sin peso conocido, o
 * con una carga tan cerca de la barra vacía que la rampa sobra.
 */
export function warmupSets(
  working: number | null,
  options: { bar?: number; step?: number } = {},
): WarmupSet[] {
  const bar = options.bar ?? 0
  const step = options.step ?? 2.5

  if (working === null || !Number.isFinite(working) || working <= bar) return []

  const ramp: WarmupSet[] = []

  for (const { pct, reps } of RAMP) {
    const weight = Math.max(bar, roundTo(working * pct, step))

    // Ni por debajo de la barra ni por encima del peso de trabajo: una serie de
    // aproximación que pesa lo mismo que la efectiva ya no aproxima nada.
    if (weight <= bar || weight >= working) continue
    if (ramp.some((s) => s.weight === weight)) continue

    ramp.push({ weight, reps })
  }

  if (ramp.length === 0) return []

  // La barra vacía abre la rampa, pero solo si hay barra y algo que subir después.
  return bar > 0 ? [{ weight: bar, reps: 10 }, ...ramp] : ramp
}
