import { exerciseImageUrl } from './exercise-repository'
import type { Exercise } from './exercise-types'

export function ExerciseList({ exercises }: { exercises: Exercise[] }) {
  if (exercises.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-content-muted">
        Ningún ejercicio coincide con tu búsqueda.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((exercise) => (
        <li
          key={exercise.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3"
        >
          {exercise.imagePaths[0] ? (
            <img
              src={exerciseImageUrl(exercise.imagePaths[0])}
              // El nombre está en el texto de al lado: repetirlo aquí haría que
              // un lector de pantalla lo leyera dos veces.
              alt=""
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-md bg-surface" />
          )}

          <div className="min-w-0">
            <p className="truncate font-medium text-content">{exercise.name}</p>
            <p className="truncate text-sm text-content-muted">
              {exercise.primaryMuscles.join(', ') || 'Sin músculo registrado'}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
