import Dexie, { type EntityTable } from 'dexie'
import type { Exercise } from '../features/exercises/exercise-types'
import type {
  PendingOperation,
  Workout,
  WorkoutSet,
} from '../features/workouts/workout-types'

/**
 * Base local del navegador.
 *
 * Guarda dos cosas distintas por razones distintas:
 *
 *   - El catálogo de ejercicios, entero, porque es estático y cabe. Así buscar
 *     un ejercicio funciona sin señal.
 *   - El entreno en curso y sus series, porque en un gimnasio una petición
 *     puede tardar treinta segundos o morir. Se escriben aquí primero y suben
 *     después, desde `syncQueue`.
 *
 * Este archivo importa tipos de dos features a propósito: es la declaración del
 * esquema, y un esquema tipado tiene que conocer lo que guarda. Mover los tipos
 * fuera de su dominio para evitar el import rompería la organización por
 * features sin ganar nada.
 */
const db = new Dexie('trainway') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  meta: EntityTable<{ key: string; value: string }, 'key'>
  workouts: EntityTable<Workout, 'id'>
  workoutSets: EntityTable<WorkoutSet, 'id'>
  syncQueue: EntityTable<PendingOperation, 'id'>
}

db.version(1).stores({
  exercises: 'id, name',
  meta: 'key',
})

// La versión 1 se conserva tal cual: Dexie aplica las migraciones en orden y
// borrarla rompería a quien ya tenga el catálogo cacheado.
db.version(2).stores({
  exercises: 'id, name',
  meta: 'key',
  workouts: 'id, userId, startedAt, endedAt',
  workoutSets: 'id, workoutId, exerciseId, completedAt',
  syncQueue: 'id, createdAt',
})

export { db }
