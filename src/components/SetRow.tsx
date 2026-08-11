import { useState } from 'react'
import { Check } from 'lucide-react'
import { Stepper } from '@/components/ui'
import { PlateHint } from '@/components/PlateHint'
import { cn, formatDuration, weightUnit } from '@/lib/utils'
import { formatPreviousSet, type PreviousSet } from '@/lib/history'
import type { PlateSet } from '@/lib/plates'
import type { Units } from '@/lib/supabase/types'

export type SetValues = {
  weight: number | null
  reps: number | null
  durationSeconds: number | null
  intensity: string | null
  done: boolean
}

type Field = 'weight' | 'reps' | 'duration' | null

/**
 * Elemento firma de Trainway.
 *
 * Al marcar la serie, la fila se llena de amarillo de izquierda a derecha —
 * como cargar un disco. La fila ES la barra de progreso: de un vistazo, y desde
 * el otro lado del gimnasio, se ve cuánto llevas.
 *
 * Los valores ya vienen prescritos, así que el gesto normal es tocar el check y
 * nada más. Editar es la excepción: se toca el número y aparece el stepper
 * debajo, sin robarle sitio al resto de series.
 */
export function SetRow({
  index,
  values,
  isCardio,
  units,
  previous,
  plates,
  onChange,
  onToggleDone,
}: {
  index: number
  values: SetValues
  isCardio: boolean
  units: Units
  /** La misma serie de la última sesión, si la hubo. */
  previous?: PreviousSet | null
  /** Discos disponibles, solo para lo que se carga en barra. */
  plates?: PlateSet | null
  onChange: (patch: Partial<SetValues>) => void
  onToggleDone: () => void
}) {
  const [editing, setEditing] = useState<Field>(null)
  const toggle = (f: Field) => setEditing((cur) => (cur === f ? null : f))

  const ink = values.done ? 'text-volt-fg' : ''

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border',
        values.done ? 'border-volt' : 'border-[var(--line)]',
      )}
    >
      <div className="relative flex items-center gap-1 px-1.5 py-1.5">
        <div
          aria-hidden
          className="carga absolute inset-0 bg-volt"
          style={{ transform: `scaleX(${values.done ? 1 : 0})` }}
        />

        <span
          className={cn(
            'num relative w-6 shrink-0 text-center text-sm',
            values.done ? 'text-volt-fg' : 'text-[var(--fg-muted)]',
          )}
        >
          {index + 1}
        </span>

        <div className={cn('relative flex min-w-0 flex-1 items-baseline justify-center gap-2', ink)}>
          {isCardio ? (
            <>
              <ValueButton
                label="duración"
                active={editing === 'duration'}
                onClick={() => toggle('duration')}
                value={formatDuration(values.durationSeconds ?? 0)}
                unit="min"
              />
              <input
                value={values.intensity ?? ''}
                onChange={(e) => onChange({ intensity: e.target.value })}
                placeholder="Nivel"
                aria-label="Nivel o velocidad"
                className={cn(
                  'min-h-12 w-24 min-w-0 rounded-lg bg-transparent text-center text-sm font-semibold',
                  'placeholder:font-normal placeholder:text-[var(--fg-muted)]',
                  values.done && 'placeholder:text-volt-fg/60',
                )}
              />
            </>
          ) : (
            <>
              <ValueButton
                label="peso"
                active={editing === 'weight'}
                onClick={() => toggle('weight')}
                value={values.weight ?? '—'}
                unit={weightUnit(units)}
              />
              <span className={cn('num text-lg opacity-40', ink)}>×</span>
              <ValueButton
                label="repeticiones"
                active={editing === 'reps'}
                onClick={() => toggle('reps')}
                value={values.reps ?? '—'}
                unit="reps"
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={values.done}
          aria-label={`${values.done ? 'Desmarcar' : 'Marcar'} serie ${index + 1}`}
          className={cn(
            'press relative grid size-12 shrink-0 place-items-center rounded-xl border',
            values.done
              ? 'border-volt-fg/25 bg-volt-fg/10 text-volt-fg'
              : 'border-[var(--line)] text-[var(--fg-muted)]',
          )}
        >
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </button>
      </div>

      {editing && (
        <div className="border-t border-[var(--line)] bg-[var(--surface-2)] px-2 py-2">
          {/* Lo que se hizo la última vez, justo donde se decide el número.
              Es la referencia que uno busca antes de subir o bajar la carga. */}
          {previous && (
            <p className="px-1 pb-1.5 text-xs text-[var(--fg-muted)]">
              La vez pasada:{' '}
              <span className="num text-[var(--fg)]">{formatPreviousSet(previous, units)}</span>
            </p>
          )}

          {editing === 'weight' && (
            <>
              <Stepper
                label="peso"
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
              label="repeticiones"
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
              label="minutos"
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

/** Número grande que hace de botón. 48 px de alto, se toca sin apuntar. */
export function ValueButton({
  label,
  value,
  unit,
  active,
  onClick,
}: {
  label: string
  value: string | number
  unit: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      aria-label={`Editar ${label}`}
      className={cn(
        'press flex min-h-12 items-baseline gap-1 rounded-lg px-2',
        active && 'bg-current/10',
      )}
    >
      <span className="num text-2xl">{value}</span>
      <span className="text-[0.6875rem] font-bold opacity-60">{unit}</span>
    </button>
  )
}
