import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { getExercise, muscleEs } from '@/lib/catalog'
import type { ExerciseTranslation, ProgramExercise, Units } from '@/lib/supabase/types'
import type { Target } from '@/lib/progression'
import { ExerciseImage } from './ExerciseImage'
import { SetRow, type SetValues } from './SetRow'
import { cn, formatDuration, weightUnit } from '@/lib/utils'

export function ExerciseCard({
  exercise,
  translation,
  target,
  sets,
  units,
  onChangeSet,
  onToggleDone,
}: {
  exercise: ProgramExercise
  translation: ExerciseTranslation | undefined
  target: Target
  sets: SetValues[]
  units: Units
  onChangeSet: (index: number, patch: Partial<SetValues>) => void
  onToggleDone: (index: number) => void
}) {
  const [showHow, setShowHow] = useState(false)
  const catalog = getExercise(exercise.exercise_id)
  if (!catalog) return null

  const name = translation?.name ?? catalog.name
  const instructions = translation?.instructions ?? catalog.instructions
  const isCardio = exercise.category === 'cardio'
  const doneCount = sets.filter((s) => s.done).length

  const prescription = isCardio
    ? `${formatDuration(target.durationSeconds ?? 0)} min`
    : `${target.sets} × ${target.repRange ? target.repRange.join('-') : (exercise.target_reps ?? '')}`

  return (
    <article className="strip flex flex-col gap-3 p-3">
      <header className="flex items-start gap-3">
        <ExerciseImage images={catalog.images} alt={name} className="size-20" />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="display leading-tight text-[1.0625rem]">{name}</h2>
          <p className="text-xs text-[var(--fg-muted)]">
            {catalog.primaryMuscles.map(muscleEs).join(' · ')}
          </p>

          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="num text-lg">{prescription}</span>
            {target.weight !== null && !isCardio && (
              <span className="num text-lg text-volt-ink">
                {target.weight} {weightUnit(units)}
              </span>
            )}
            {exercise.target_rpe && (
              <span className="eyebrow">RPE {exercise.target_rpe}</span>
            )}
          </div>
        </div>

        <span
          className={cn(
            'num shrink-0 rounded-lg px-2 py-1 text-sm',
            doneCount === sets.length && sets.length > 0
              ? 'bg-volt text-volt-fg'
              : 'bg-[var(--surface-2)] text-[var(--fg-muted)]',
          )}
        >
          {doneCount}/{sets.length}
        </span>
      </header>

      {target.note && (
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

      <div className="flex flex-col gap-1.5">
        {sets.map((s, i) => (
          <SetRow
            key={i}
            index={i}
            values={s}
            isCardio={isCardio}
            units={units}
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
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-[var(--fg-muted)]">
          {instructions.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
    </article>
  )
}
