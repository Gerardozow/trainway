import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, HeartPulse } from 'lucide-react'
import { getExercise, muscleEs } from '@/lib/catalog'
import { formatDose } from '@/lib/dose'
import type { ExerciseTranslation, ProgramExercise } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import { ExerciseImage } from './ExerciseImage'

/**
 * Un ejercicio visto antes de entrenarlo.
 *
 * No es la tarjeta de la sesión. Aquí hay calma y sitio: las dos fotos lado a
 * lado, la dosis entera —descanso incluido— y el detalle técnico a la vista.
 * En la sesión eso estorbaría; aquí es lo que hace falta para llegar al
 * gimnasio sabiendo qué hacer.
 */
export function ExercisePreview({
  exercise,
  translation,
  href,
}: {
  exercise: ProgramExercise
  translation?: ExerciseTranslation
  /** Si llega, el nombre y la dosis entran al entreno. */
  href?: string
}) {
  const [showHow, setShowHow] = useState(false)
  const catalog = getExercise(exercise.exercise_id)
  if (!catalog) return null

  const name = translation?.name ?? catalog.name
  const instructions = translation?.instructions ?? catalog.instructions
  const isCardio = exercise.category === 'cardio'

  const title = (
    <>
      <p className={cn('eyebrow', !isCardio && 'text-volt-ink')}>
        {isCardio ? 'Cardio' : catalog.primaryMuscles.map(muscleEs).join(' · ')}
      </p>
      <h3 className="display mt-1 text-lg leading-tight">{name}</h3>
      <p className="num mt-2 w-fit rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-sm">
        {formatDose(exercise)}
      </p>
    </>
  )

  return (
    <article className="strip flex w-full flex-col overflow-hidden">
      {isCardio ? (
        // Una máquina de cardio no necesita dos fotos para entenderse.
        <div className="grid h-20 place-items-center bg-[var(--surface-2)]">
          <HeartPulse className="size-8 text-volt-ink" strokeWidth={1.75} aria-hidden />
        </div>
      ) : (
        <ExerciseImage images={catalog.images} alt={name} variant="pair" />
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        {href ? (
          <Link to={href} className="press -m-2 block rounded-xl p-2 active:bg-[var(--surface-2)]">
            {title}
          </Link>
        ) : (
          <div>{title}</div>
        )}

        {exercise.coach_note && (
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{exercise.coach_note}</p>
        )}

        {instructions.length > 0 && (
          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowHow((v) => !v)}
              aria-expanded={showHow}
              className="flex min-h-10 w-fit items-center gap-1.5 text-sm font-semibold"
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
          </div>
        )}
      </div>
    </article>
  )
}
