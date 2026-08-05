/** Categorías tal cual vienen de free-exercise-db. */
export type Category =
  | 'strength'
  | 'stretching'
  | 'plyometrics'
  | 'strongman'
  | 'powerlifting'
  | 'cardio'
  | 'olympic weightlifting'

export type Level = 'beginner' | 'intermediate' | 'expert'
export type Force = 'push' | 'pull' | 'static' | null
export type Mechanic = 'compound' | 'isolation' | null

export type Exercise = {
  id: string
  name: string
  force: Force
  level: Level
  mechanic: Mechanic
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: Category
  /** Rutas relativas. Siempre exactamente 2: posición inicial y final. */
  images: [string, string]
}

/** Nivel declarado por el usuario en el wizard, en español. */
export type Experience = 'principiante' | 'intermedio' | 'avanzado'

export type Criteria = {
  /** Equipamiento disponible. `body only` siempre está permitido, se declare o no. */
  equipment: string[]
  level: Experience
  focusMuscles: string[]
  includeCardio: boolean
  limit?: number
}
