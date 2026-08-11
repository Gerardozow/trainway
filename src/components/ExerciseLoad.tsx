import { useState } from 'react'
import { Stepper } from '@/components/ui'
import { PlateHint } from '@/components/PlateHint'
import { ValueButton, type SetValues } from './SetRow'
import type { PlateSet } from '@/lib/plates'
import type { Units } from '@/lib/supabase/types'
import { formatDuration, weightUnit } from '@/lib/utils'

type Field = 'weight' | 'reps' | 'duration' | null

/**
 * La carga del ejercicio, no la de una serie.
 *
 * Un ejercicio son tres o cuatro series con el mismo peso, así que ajustarlo
 * serie por serie era escribir cuatro veces la misma decisión. Aquí se toca una
 * vez y baja a todas las que faltan.
 *
 * "Las que faltan" es la parte importante: lo ya marcado es historial —el peso
 * con el que de verdad se levantó— y reescribirlo desde aquí lo falsearía. Para
 * bajar de 60 a 50 a mitad del ejercicio no hace falta nada más: se cambia aquí
 * y solo se mueven las series que quedan.
 */
export function ExerciseLoad({
  values,
  pending,
  isCardio,
  units,
  plates,
  onChange,
}: {
  /** La primera serie sin marcar: es la que se va a hacer ahora. */
  values: SetValues
  /** Cuántas series toca el cambio. Solo para decirlo claro. */
  pending: number
  isCardio: boolean
  units: Units
  plates?: PlateSet | null
  onChange: (patch: Partial<SetValues>) => void
}) {
  const [editing, setEditing] = useState<Field>(null)
  const toggle = (f: Field) => setEditing((cur) => (cur === f ? null : f))

  const alcance =
    pending === 1 ? 'Se aplica a la serie que falta' : `Se aplica a las ${pending} series que faltan`

  return (
    <div className="rounded-xl border border-dashed border-[var(--line)]">
      <div className="flex items-center gap-2 px-2.5 py-1">
        <span className="eyebrow shrink-0">Carga</span>

        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-2">
          {isCardio ? (
            <>
              <ValueButton
                label="duración de todas las series"
                active={editing === 'duration'}
                onClick={() => toggle('duration')}
                value={formatDuration(values.durationSeconds ?? 0)}
                unit="min"
              />
              <input
                value={values.intensity ?? ''}
                onChange={(e) => onChange({ intensity: e.target.value })}
                placeholder="Nivel"
                aria-label="Nivel o velocidad de todas las series"
                className="min-h-12 w-24 min-w-0 rounded-lg bg-transparent text-center text-sm font-semibold placeholder:font-normal placeholder:text-[var(--fg-muted)]"
              />
            </>
          ) : (
            <>
              <ValueButton
                label="peso de todas las series"
                active={editing === 'weight'}
                onClick={() => toggle('weight')}
                value={values.weight ?? '—'}
                unit={weightUnit(units)}
              />
              <span className="num text-lg opacity-40">×</span>
              <ValueButton
                label="repeticiones de todas las series"
                active={editing === 'reps'}
                onClick={() => toggle('reps')}
                value={values.reps ?? '—'}
                unit="reps"
              />
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="border-t border-[var(--line)] bg-[var(--surface-2)] px-2 py-2">
          <p className="px-1 pb-1.5 text-xs text-[var(--fg-muted)]">{alcance}</p>

          {editing === 'weight' && (
            <>
              <Stepper
                label="peso de todas las series"
                value={values.weight}
                step={2.5}
                min={0}
                max={500}
                suffix={weightUnit(units)}
                onChange={(v) => onChange({ weight: v })}
              />
              {plates && <PlateHint weight={values.weight} set={plates} units={units} />}
            </>
          )}

          {editing === 'reps' && (
            <Stepper
              label="repeticiones de todas las series"
              value={values.reps}
              step={1}
              min={0}
              max={100}
              suffix="reps"
              onChange={(v) => onChange({ reps: v })}
            />
          )}

          {editing === 'duration' && (
            <Stepper
              label="minutos de todas las series"
              value={values.durationSeconds !== null ? Math.round(values.durationSeconds / 60) : null}
              step={1}
              min={1}
              max={180}
              suffix="min"
              onChange={(v) => onChange({ durationSeconds: v * 60 })}
            />
          )}
        </div>
      )}
    </div>
  )
}
