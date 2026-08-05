import type { Exercise } from './exercise-types'

/**
 * El usuario escribe "biceps" tanto como "bíceps", y los nombres del catálogo
 * vienen del inglés pero la interfaz es española. Sin quitar los acentos, la
 * mitad de las búsquedas no encuentran nada y parece que el catálogo está roto.
 *
 * NFD separa la letra de su tilde y el rango U+0300–U+036F son justamente esas
 * marcas combinantes, así que borrarlas deja la letra base.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function searchExercises(
  all: Exercise[],
  query: string,
  muscle: string | null,
): Exercise[] {
  const needle = normalize(query)

  return all.filter((exercise) => {
    if (needle !== '' && !normalize(exercise.name).includes(needle)) {
      return false
    }

    if (muscle === null) return true

    return (
      exercise.primaryMuscles.includes(muscle) ||
      exercise.secondaryMuscles.includes(muscle)
    )
  })
}
