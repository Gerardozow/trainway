/**
 * Crea una cuenta de demostración con datos ya puestos.
 *
 * Sin entrenos previos no se puede ver lo que hace útil a la app: la
 * referencia en gris de "la última vez levantaste 60 kg × 8". Este script
 * siembra dos entrenos pasados para que esa referencia aparezca desde el
 * primer momento.
 *
 * Solo para desarrollo local. Usa la clave de servicio y crea el usuario ya
 * confirmado para saltarse el correo.
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.',
  )
}

if (!SUPABASE_URL.includes('127.0.0.1') && !SUPABASE_URL.includes('localhost')) {
  throw new Error(
    'Este script es solo para el stack local. VITE_SUPABASE_URL apunta a otro sitio.',
  )
}

const EMAIL = 'demo@trainway.test'
const PASSWORD = 'demo1234'
const USERNAME = 'demo'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Ejercicios reconocibles, buscados por nombre en el catálogo sembrado. */
const WANTED = ['Barbell Squat', 'Barbell Bench Press', 'Barbell Deadlift']

async function findExercises(): Promise<{ id: string; name: string }[]> {
  const found: { id: string; name: string }[] = []

  for (const name of WANTED) {
    const { data } = await admin
      .from('exercises')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)

    if (data && data.length > 0) found.push(data[0])
  }

  if (found.length === 0) {
    // Sin catálogo no hay demo que valga: mejor decirlo que sembrar vacío.
    throw new Error(
      'El catálogo está vacío. Corre `pnpm seed:exercises` antes que este script.',
    )
  }

  return found
}

async function resetDemoUser(): Promise<string> {
  const { data } = await admin.auth.admin.listUsers()
  const existing = data.users.find((user) => user.email === EMAIL)

  // Se borra y se recrea para que correrlo dos veces no acumule entrenos.
  if (existing) await admin.auth.admin.deleteUser(existing.id)

  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: USERNAME },
  })
  if (error) throw error

  return created.user!.id
}

async function main() {
  console.log('Buscando ejercicios en el catálogo…')
  const exercises = await findExercises()
  console.log(`  ${exercises.map((e) => e.name).join(', ')}`)

  console.log('Creando la cuenta de demostración…')
  const userId = await resetDemoUser()

  console.log('Creando una rutina…')
  const routineId = randomUUID()
  await admin
    .from('routines')
    .insert({ id: routineId, owner_id: userId, name: 'Fuerza básica' })

  await admin.from('routine_exercises').insert(
    exercises.map((exercise, index) => ({
      id: randomUUID(),
      routine_id: routineId,
      exercise_id: exercise.id,
      position: index,
      target_sets: 4,
      target_reps: index === 2 ? 5 : 8,
    })),
  )

  console.log('Creando dos entrenos pasados…')
  const day = 24 * 60 * 60 * 1000

  for (const [index, daysAgo] of [7, 3].entries()) {
    const startedAt = new Date(Date.now() - daysAgo * day)
    const workoutId = randomUUID()

    await admin.from('workouts').insert({
      id: workoutId,
      user_id: userId,
      routine_id: routineId,
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + 45 * 60 * 1000).toISOString(),
    })

    // El segundo entreno sube un poco el peso: así la referencia de "la última
    // vez" muestra progreso real en vez de números repetidos.
    const bump = index * 2.5

    for (const exercise of exercises) {
      for (let setIndex = 0; setIndex < 3; setIndex += 1) {
        await admin.from('workout_sets').insert({
          id: randomUUID(),
          workout_id: workoutId,
          exercise_id: exercise.id,
          set_index: setIndex,
          reps: 8 - setIndex,
          weight: 60 + bump + setIndex * 2.5,
          completed_at: new Date(
            startedAt.getTime() + setIndex * 3 * 60 * 1000,
          ).toISOString(),
        })
      }
    }
  }

  console.log('\nListo. Entra en la app con:')
  console.log(`  usuario o correo: ${USERNAME}   (o ${EMAIL})`)
  console.log(`  contraseña:       ${PASSWORD}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
