import { platesFor, type PlateSet } from '@/lib/plates'
import { weightUnit } from '@/lib/utils'
import type { Units } from '@/lib/supabase/types'

/**
 * Los discos que van en cada lado de la barra.
 *
 * Se enseña justo donde se decide el peso. Cada disco es una ficha con el
 * número: es la misma lectura que se hace delante del rack, de fuera a dentro.
 */
export function PlateHint({
  weight,
  set,
  units,
}: {
  weight: number | null
  set: PlateSet
  units: Units
}) {
  const breakdown = weight === null ? null : platesFor(weight, set)
  if (!breakdown) return null

  const unit = weightUnit(units)

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 pt-2">
      <span className="eyebrow">Por lado</span>

      {breakdown.perSide.length === 0 ? (
        <span className="text-xs text-[var(--fg-muted)]">
          solo la barra ({set.bar} {unit})
        </span>
      ) : (
        breakdown.perSide.map((plate, i) => (
          <span
            key={i}
            className="num rounded-md bg-[var(--surface)] px-1.5 py-1 text-xs ring-1 ring-[var(--line)]"
          >
            {plate}
          </span>
        ))
      )}

      {breakdown.leftover > 0 && (
        <span className="text-xs text-[var(--fg-muted)]">
          + {breakdown.leftover} {unit} que no cuadran con discos
        </span>
      )}
    </div>
  )
}
