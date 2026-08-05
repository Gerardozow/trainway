/**
 * Traducción entre los músculos de free-exercise-db (17) y los que dibuja
 * body-highlighter.
 *
 * No es uno a uno: el catálogo distingue dorsales de espalda media y la
 * librería solo tiene "upper-back"; el catálogo dice "shoulders" y la librería
 * separa deltoides anterior y posterior. Donde hay que elegir, se elige lo que
 * se ve en el dibujo, no lo que sería exacto en anatomía.
 */
export type BodyMuscle =
  | 'trapezius'
  | 'upper-back'
  | 'lower-back'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'back-deltoids'
  | 'front-deltoids'
  | 'abs'
  | 'obliques'
  | 'adductor'
  | 'abductors'
  | 'hamstring'
  | 'quadriceps'
  | 'calves'
  | 'gluteal'
  | 'neck'

const MAP: Record<string, BodyMuscle[]> = {
  abdominals: ['abs'],
  abductors: ['abductors'],
  adductors: ['adductor'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  // El catálogo no distingue deltoides anterior de posterior, así que se
  // marcan los dos: para quien mira el dibujo, "hombro" es el hombro.
  shoulders: ['front-deltoids', 'back-deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
}

/** Músculos del dibujo, sin repetidos, para una lista del catálogo. */
export function toBodyMuscles(muscles: string[]): BodyMuscle[] {
  return [...new Set(muscles.flatMap((m) => MAP[m] ?? []))]
}

/** Qué vista del cuerpo enseña mejor estos músculos. */
export function bestView(muscles: string[]): 'anterior' | 'posterior' {
  const body = toBodyMuscles(muscles)
  const detras: BodyMuscle[] = [
    'trapezius',
    'upper-back',
    'lower-back',
    'back-deltoids',
    'hamstring',
    'gluteal',
    'triceps',
  ]
  const puntos = body.reduce((n, m) => n + (detras.includes(m) ? 1 : -1), 0)
  return puntos > 0 ? 'posterior' : 'anterior'
}
