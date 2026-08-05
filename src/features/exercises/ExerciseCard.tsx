import { exerciseImageUrl } from './exercise-repository'
import { Card, Eyebrow, Tag } from '../../shared/ui'
import type { Exercise } from './exercise-types'

/** El catálogo marca así los ejercicios que no son de fuerza. */
const CARDIO_CATEGORIES = new Set(['cardio', 'plyometrics', 'stretching'])

export function isCardio(exercise: Exercise): boolean {
  return exercise.category !== null && CARDIO_CATEGORIES.has(exercise.category)
}

/**
 * Un ejercicio con las dos fotos del movimiento.
 *
 * El dataset trae dos imágenes por ejercicio: la posición de inicio y la de
 * final. Mostrar solo una obliga a adivinar hacia dónde va el movimiento —
 * verlas juntas es la diferencia entre reconocer el ejercicio y tener que
 * leerse las instrucciones en medio del gimnasio.
 */
export function ExerciseCard({
  exercise,
  onClick,
  footer,
}: {
  exercise: Exercise
  onClick?: () => void
  footer?: React.ReactNode
}) {
  const cardio = isCardio(exercise)
  const tone = cardio ? 'cardio' : 'strength'
  const [start, end] = exercise.imagePaths

  const body = (
    <>
      {start ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-2xl bg-border">
          <Frame path={start} step="Inicio" tone={tone} />
          {end ? (
            <Frame path={end} step="Final" tone={tone} />
          ) : (
            <div className="aspect-[4/3] bg-surface-sunken" />
          )}
        </div>
      ) : (
        <div className="aspect-[8/3] rounded-t-2xl bg-surface-sunken" />
      )}

      <div className="p-4">
        <Eyebrow tone={tone}>{cardio ? 'Cardio' : 'Fuerza'}</Eyebrow>
        <h3 className="mt-1 text-lg font-bold text-content">{exercise.name}</h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercise.primaryMuscles.slice(0, 3).map((muscle) => (
            <Tag key={muscle} tone={tone}>
              {muscle}
            </Tag>
          ))}
          {exercise.equipment && <Tag>{exercise.equipment}</Tag>}
        </div>

        {footer}
      </div>
    </>
  )

  if (!onClick) {
    return (
      <Card tone={tone} className="overflow-hidden">
        {body}
      </Card>
    )
  }

  return (
    <Card tone={tone} className="overflow-hidden">
      <button type="button" onClick={onClick} className="w-full text-left">
        {body}
      </button>
    </Card>
  )
}

function Frame({
  path,
  step,
  tone,
}: {
  path: string
  step: string
  tone: 'strength' | 'cardio'
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
      <img
        src={exerciseImageUrl(path)}
        // El nombre del ejercicio ya está en el texto de al lado; el valor de
        // estas fotos es el contraste entre las dos, y eso lo dice la etiqueta.
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <span
        className={`absolute left-2 top-2 rounded-full border border-border bg-surface/80 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] backdrop-blur-sm ${
          tone === 'cardio' ? 'text-cardio' : 'text-strength'
        }`}
      >
        {step}
      </span>
    </div>
  )
}
