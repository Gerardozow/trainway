/**
 * Cómo evoluciona un ejercicio de una sesión a la siguiente.
 * Lo asigna la IA al generar el bloque; lo aplica el código, no el modelo.
 */
export type ProgressionScheme =
  /** Doble progresión: primero suben las reps dentro del rango, luego el peso. */
  | { type: 'double'; incrementKg: number }
  /** Lineal: si completaste todas las series, sube el peso. */
  | { type: 'linear'; incrementKg: number }
  /** Cardio por tiempo: suma minutos hasta el objetivo. */
  | { type: 'time'; incrementSeconds: number; maxSeconds: number }
  /** Cardio por intensidad: misma duración, sube el nivel de la máquina. */
  | { type: 'intensity' }

export type SetResult = {
  reps: number | null
  weight: number | null
  durationSeconds: number | null
  done: boolean
}

export type LastPerformance = {
  sets: SetResult[]
  /** Sesiones seguidas sin alcanzar el piso del rango. A las 2, deload. */
  failedFloorStreak: number
}

export type Target = {
  sets: number
  repRange: [number, number] | null
  /** `null` significa calibración: el usuario decide la carga y se registra. */
  weight: number | null
  durationSeconds: number | null
  note: string | null
}
