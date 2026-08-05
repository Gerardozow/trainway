import type { ProgressionScheme } from '@/lib/progression'

export type Units = 'metric' | 'imperial'
export type Goal = 'fuerza' | 'hipertrofia' | 'perdida_grasa' | 'resistencia' | 'general'
export type Experience = 'principiante' | 'intermedio' | 'avanzado'
export type ProgramStatus = 'active' | 'completed' | 'archived'

export type Profile = {
  id: string
  display_name: string | null
  units: Units
  locale: string
  theme: 'light' | 'dark' | 'system'
  created_at: string
}

export type Intake = {
  id: string
  user_id: string
  goal: Goal
  days_per_week: number
  session_minutes: number
  experience: Experience
  equipment: string[]
  focus_muscles: string[]
  include_cardio: boolean
  limitations: string | null
  free_notes: string | null
  created_at: string
}

export type Program = {
  id: string
  user_id: string
  intake_id: string | null
  name: string
  block_number: number
  weeks: number
  starts_on: string
  status: ProgramStatus
  ai_model: string | null
  ai_rationale: string | null
  created_at: string
}

export type ProgramDay = {
  id: string
  program_id: string
  week: number
  day_index: number
  title: string
  focus: string[]
  is_deload: boolean
}

export type ProgramExercise = {
  id: string
  program_day_id: string
  exercise_id: string
  category: string
  position: number
  target_sets: number
  target_reps: string | null
  target_weight: number | null
  target_duration_seconds: number | null
  target_rpe: number | null
  rest_seconds: number
  progression_scheme: ProgressionScheme
  coach_note: string | null
}

export type WorkoutSession = {
  id: string
  user_id: string
  program_day_id: string
  performed_on: string
  started_at: string
  completed_at: string | null
  session_rpe: number | null
  notes: string | null
}

export type SetLog = {
  id: string
  session_id: string
  program_exercise_id: string
  set_index: number
  done: boolean
  weight: number | null
  reps: number | null
  duration_seconds: number | null
  distance_m: number | null
  intensity: string | null
  rpe: number | null
  note: string | null
  client_id: string
  logged_at: string
}

export type ExerciseTranslation = {
  exercise_id: string
  locale: string
  name: string
  instructions: string[]
}

/** Un día con todo lo que la pantalla de sesión necesita, ya resuelto. */
export type DayWithExercises = ProgramDay & { exercises: ProgramExercise[] }
