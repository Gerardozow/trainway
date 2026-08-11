import type { Units } from './supabase/types'

/**
 * Qué discos poner en la barra.
 *
 * "62.5 kg" está bien escrito pero no se carga: lo que se carga es 20 + 1.25
 * por lado. Traducir el objetivo a discos evita la aritmética mental con la
 * barra ya montada, que es cuando peor se piensa.
 */

export type PlateSet = {
  /** Peso de la barra vacía. */
  bar: number
  /** Discos disponibles, de mayor a menor. Se asume un par de cada uno. */
  plates: number[]
}

export const KG_SET: PlateSet = { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] }
export const LB_SET: PlateSet = { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] }

export function plateSet(units: Units): PlateSet {
  return units === 'imperial' ? LB_SET : KG_SET
}

export type PlateBreakdown = {
  bar: number
  /** Discos de un lado, de mayor a menor. Vacío = solo la barra. */
  perSide: number[]
  /**
   * Peso total que no se pudo cubrir con los discos disponibles. Se informa en
   * vez de redondearlo en silencio: quien lo lee decide si vale la pena.
   */
  leftover: number
}

/** Todo en céntimos: 1.25 + 2.5 en coma flotante deja restos que estropean el reparto. */
const cents = (n: number) => Math.round(n * 100)

/**
 * Reparto voraz, que con los discos de gimnasio de siempre es óptimo: cada
 * disco vale al menos el doble que la suma de los menores no lo supera nunca.
 * Devuelve null si el objetivo no llega ni a la barra vacía — ahí no hay nada
 * que calcular y una tarjeta vacía solo estorba.
 */
export function platesFor(total: number, set: PlateSet = KG_SET): PlateBreakdown | null {
  if (!Number.isFinite(total) || total < set.bar) return null

  let perSideCents = cents(total - set.bar) / 2
  if (perSideCents < 0) return null

  const perSide: number[] = []

  for (const plate of set.plates) {
    const p = cents(plate)
    while (perSideCents >= p) {
      perSide.push(plate)
      perSideCents -= p
    }
  }

  return { bar: set.bar, perSide, leftover: (perSideCents * 2) / 100 }
}

/** "20 · 10 · 2.5" — lo que va en un lado, para leerlo de un vistazo. */
export function formatPerSide(perSide: number[]): string {
  return perSide.length === 0 ? 'solo la barra' : perSide.join(' · ')
}
