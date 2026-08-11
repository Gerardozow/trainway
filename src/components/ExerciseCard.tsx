import { useState } from 'react'
import { ArrowDownToLine, Check, ChevronDown, Info, Repeat2 } from 'lucide-react'
import { getExercise, muscleEs } from '@/lib/catalog'
import type { ExerciseTranslation, ProgramExercise, Units } from '@/lib/supabase/types'
import { CALIBRATION_NOTE, type Target } from '@/lib/progression'
import { formatDaysAgo, formatPreviousSets, type PreviousSession } from '@/lib/history'
import { plateSet } from '@/lib/plates'
import { barFor, warmupSets } from '@/lib/warmup'
import { ExerciseImage } from './ExerciseImage'
import { ExerciseLoad } from './ExerciseLoad'
import { MuscleMap } from './MuscleMap'
import { SetRow, type SetValues } from './SetRow'
import { cn, formatDuration, weightUnit } from '@/lib/utils'

/**
 * Un ejercicio de la sesión.
 *
 * Colapsado por defecto. Una sesión son seis u ocho ejercicios y con todos
 * abiertos hay que recorrer metros de pantalla para llegar al que toca; con
 * solo uno abierto, lo que estás haciendo siempre está a la vista. La cabecera
 * colapsada sigue diciendo lo esencial: qué es, cuánto toca y cuánto llevas.
 */
export function ExerciseCard({
  exercise,
  translation,
  target,
  sets,
  units,
  previous,
  expanded,
  onToggleExpand,
  onChangeSet,
  onChangeAll,
  onToggleDone,
  onSwap,
  onPostpone,
}: {
  exercise: ProgramExercise
  translation: ExerciseTranslation | undefined
  target: Target
  sets: SetValues[]
  units: Units
  /** La última vez que se hizo este ejercicio, sin contar hoy. */
  previous?: PreviousSession | null
  expanded: boolean
  onToggleExpand: () => void
  onChangeSet: (index: number, patch: Partial<SetValues>) => void
  /** Cambia la carga de todas las series aún sin marcar. */
  onChangeAll?: (patch: Partial<SetValues>) => void
  onToggleDone: (index: number) => void
  onSwap: () => void
  /** Sin esto no se ofrece posponer: con un solo ejercicio no hay a dónde ir. */
  onPostpone?: () => void
}) {
  const [showHow, setShowHow] = useState(false)
  const catalog = getExercise(exercise.exercise_id)
  if (!catalog) return null

  const name = translation?.name ?? catalog.name
  const instructions = translation?.instructions ?? catalog.instructions
  const isCardio = exercise.category === 'cardio'
  const doneCount = sets.filter((s) => s.done).length
  const complete = sets.length > 0 && doneCount === sets.length

  // La referencia del control de carga es la próxima serie a hacer. Con todo
  // marcado no hay nada que ajustar, así que el control desaparece.
  const pendingCount = sets.length - doneCount
  const reference = sets.find((s) => !s.done) ?? null

  // Los discos solo tienen sentido en lo que se carga en barra.
  const bar = isCardio ? 0 : barFor(catalog.equipment, units)
  const plates = bar > 0 ? plateSet(units) : null

  // Calentar es para lo pesado y multiarticular. Un curl de bíceps no necesita
  // rampa, y ponerla convertiría una guía útil en ruido en todas las tarjetas.
  const warmup =
    !isCardio && catalog.mechanic === 'compound' ? warmupSets(target.weight, { bar }) : []

  const prescription = isCardio
    ? `${formatDuration(target.durationSeconds ?? 0)} min`
    : `${target.sets} × ${target.repRange ? target.repRange.join('-') : (exercise.target_reps ?? '')}`

  return (
    <article
      id={`ejercicio-${exercise.id}`}
      className={cn('strip scroll-mt-20 overflow-hidden', complete && !expanded && 'opacity-60')}
    >
      {/* La miniatura NO va dentro del botón que despliega.
          Estaba dentro y tocarla cerraba la tarjeta, que es justo lo contrario
          de lo que pide el gesto: se toca una foto para verla más grande. Un
          <button> tampoco puede anidar otro, así que son hermanos. */}
      <div className="flex items-center gap-3 p-3">
        <ExerciseImage
          images={catalog.images}
          alt={name}
          className={cn('shrink-0 transition-all', expanded ? 'size-20' : 'size-14')}
        />

        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="-my-3 flex w-full items-center gap-3 py-3 text-left"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="display leading-tight text-[1.0625rem]">{name}</span>
              <span className="text-xs text-[var(--fg-muted)]">
                {catalog.primaryMuscles.map(muscleEs).join(' · ')}
              </span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="num text-base">{prescription}</span>
                {target.weight !== null && !isCardio && (
                  <span className="num text-base text-volt-ink">
                    {target.weight} {weightUnit(units)}
                  </span>
                )}
                {exercise.target_rpe && <span className="eyebrow">RPE {exercise.target_rpe}</span>}
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-center gap-1">
              <span
                className={cn(
                  'num rounded-lg px-2 py-1 text-sm',
                  complete
                    ? 'bg-volt text-volt-fg'
                    : 'bg-[var(--surface-2)] text-[var(--fg-muted)]',
                )}
              >
                {complete ? (
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                ) : (
                  `${doneCount}/${sets.length}`
                )}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 text-[var(--fg-muted)] transition-transform',
                  expanded && 'rotate-180',
                )}
                aria-hidden
              />
            </span>
          </button>
        </h2>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="flex items-start gap-3">
            <MuscleMap
              primary={catalog.primaryMuscles}
              secondary={catalog.secondaryMuscles}
              className="h-24 w-16 shrink-0"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {target.note && target.note !== CALIBRATION_NOTE && (
                <p className="rounded-lg border-l-2 border-volt bg-[var(--surface-2)] px-3 py-2 text-sm leading-snug">
                  {target.note}
                </p>
              )}

              {exercise.coach_note && (
                <p className="flex gap-2 text-sm leading-snug text-[var(--fg-muted)]">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {exercise.coach_note}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSwap}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold active:bg-[var(--surface-2)]"
                >
                  <Repeat2 className="size-4" aria-hidden />
                  Cambiar
                </button>

                {onPostpone && !complete && (
                  <button
                    type="button"
                    onClick={onPostpone}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-sm font-semibold active:bg-[var(--surface-2)]"
                  >
                    <ArrowDownToLine className="size-4" aria-hidden />
                    Dejarlo para el final
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lo que hiciste la última vez. Es el dato que de verdad se busca al
              abrir un ejercicio: sin él no hay contra qué medir la serie de hoy. */}
          {previous && previous.sets.length > 0 && (
            <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm leading-snug">
              <span className="eyebrow">La vez pasada · {formatDaysAgo(previous.daysAgo)}</span>
              <br />
              <span className="num text-base">{formatPreviousSets(previous.sets, units)}</span>
            </p>
          )}

          {warmup.length > 0 && (
            <p className="px-1 text-sm leading-snug text-[var(--fg-muted)]">
              <span className="eyebrow">Calentamiento</span>
              <br />
              <span className="num">
                {warmup.map((w) => `${w.weight} × ${w.reps}`).join('  ·  ')}
              </span>
              <span className="ml-1 text-xs">— no se registra</span>
            </p>
          )}

          {/* Un solo sitio donde poner el peso del ejercicio. Las filas de abajo
              siguen siendo editables una a una para el caso raro —fallaste la
              tercera y bajas solo esa—, pero ya no es el camino normal. */}
          {onChangeAll && reference && (
            <ExerciseLoad
              values={reference}
              pending={pendingCount}
              isCardio={isCardio}
              units={units}
              plates={plates}
              onChange={onChangeAll}
            />
          )}

          <div className="flex flex-col gap-1.5">
            {sets.map((s, i) => (
              <SetRow
                key={i}
                index={i}
                values={s}
                isCardio={isCardio}
                units={units}
                previous={previous?.sets[i] ?? null}
                plates={plates}
                onChange={(patch) => onChangeSet(i, patch)}
                onToggleDone={() => onToggleDone(i)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowHow((v) => !v)}
            aria-expanded={showHow}
            className="flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-semibold text-[var(--fg-muted)]"
          >
            Cómo se hace
            <ChevronDown
              className={cn('size-4 transition-transform', showHow && 'rotate-180')}
              aria-hidden
            />
          </button>

          {showHow && (
            <div className="flex flex-col gap-3">
              <ExerciseImage images={catalog.images} alt={name} className="h-40 w-full" />
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-[var(--fg-muted)]">
                {instructions.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
