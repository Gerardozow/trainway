export type Routine = {
  id: string
  ownerId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export type RoutineExercise = {
  id: string
  routineId: string
  exerciseId: string
  position: number
  targetSets: number | null
  targetReps: number | null
  targetWeight: number | null
  notes: string | null
}
