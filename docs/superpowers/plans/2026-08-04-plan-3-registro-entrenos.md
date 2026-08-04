# Trainway — Plan 3: Registro de entrenos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder registrar un entreno completo desde el teléfono, de pie y sudando, con el peso y las repeticiones de cada serie — y que funcione sin señal, sin perder nada.

**Architecture:** La sesión en curso vive **primero en IndexedDB**, no en el servidor. Cada serie se escribe local al instante y entra en una cola de sincronización que sube cuando hay red. Los datos locales no se borran hasta que el servidor confirma la escritura. Los conflictos son imposibles por diseño: cada serie pertenece a un solo usuario y solo se crea, nunca se edita desde dos dispositivos.

**Tech Stack:** Postgres + RLS, Dexie (IndexedDB), React + TypeScript, Tailwind 4, Vitest, fake-indexeddb para las pruebas.

## Contexto: qué existe ya

Planes 1, 1b y 2 completos:

- PWA instalable, tema claro/oscuro por tokens `--color-*` (marca `#FFC603`, `--color-danger` en ambos temas), navegación inferior con cuatro destinos bajo `RequireAuth`.
- Autenticación: magic link con PKCE y contraseña con identificador dual.
- `public.profiles` y `public.exercises` con RLS probado. Catálogo de ~800 ejercicios sembrado, imágenes en Supabase Storage.
- `src/lib/db.ts` define la base de Dexie llamada `trainway`, versión 1, con las tablas `exercises` y `meta`. **Este plan añade la versión 2** — Dexie migra solo si se declara una versión nueva sin tocar la anterior.
- `src/features/exercises/` expone `loadExercises()`, `searchExercises()`, `exerciseImageUrl()` y el tipo `Exercise`.
- Organización por dominio en `src/features/`. **La interfaz nunca llama a Supabase directamente.**
- Vitest en tres proyectos: `unit` (jsdom, `pnpm test`, sin Docker ni variables de entorno), `rls` (node), `edge` (node).

## Global Constraints

- Gestor de paquetes: **pnpm**. `npm`, `npx` y `yarn` están bloqueados; el equivalente de `npx foo` es `pnpm exec foo`.
- **Ningún secreto en el cliente.** Bajo `src/` solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; nunca `process.env`.
- **`pnpm test` debe seguir pasando con `.env.local` ausente.**
- **Los tres proyectos de Vitest se conservan.**
- Toda tabla nueva lleva RLS en la migración que la crea, con grants explícitos por rol.
- Todo color viene de un token `--color-*`. Cada pantalla se verifica en tema claro y oscuro.
- Interfaz en español, identificadores en inglés. Producto: **Trainway**.
- TDD: la prueba que falla se escribe y se ejecuta antes de la implementación.
- **Ningún entreno se pierde.** Una escritura local nunca se descarta antes de que el servidor confirme. Si algo va a fallar, que falle dejando los datos en el dispositivo.

## Decisiones de diseño

**Por qué local primero y no optimista sobre el servidor.** En un gimnasio con mala señal, una petición puede tardar treinta segundos o morir. Esperar la respuesta para pintar la serie hace la app inservible justo donde se usa. Escribir local y sincronizar después es la única forma de que registrar una serie sea instantáneo siempre.

**Por qué los identificadores los genera el cliente.** Cada `workout` y cada `workout_set` recibe un UUID en el dispositivo antes de existir en el servidor. Así la fila local y la remota son la misma desde el principio, la cola es idempotente — reintentar una subida ya aplicada no duplica nada — y la interfaz nunca tiene que reconciliar un identificador temporal con uno definitivo.

**Por qué las series solo se crean.** Corregir una serie mal capturada se hace borrándola y volviéndola a registrar, no editándola. Eso elimina toda la clase de conflictos de escritura concurrente sin ninguna maquinaria de resolución.

---

## Estructura de archivos

```
supabase/
  migrations/
    0004_workouts.sql              # workouts, workout_sets, RLS, grants
src/
  lib/
    db.ts                          # + versión 2: workouts, workoutSets, syncQueue
  features/
    workouts/
      workout-types.ts             # tipos, sin dependencias
      workout-local.ts             # escritura y lectura en IndexedDB
      workout-repository.ts        # única puerta a Supabase para entrenos
      sync-queue.ts                # cola de subida con reintento
      lastPerformance.ts           # cálculo puro: qué levantó la última vez
      useOnlineStatus.ts           # hook de estado de red
      SetLogger.tsx                # los dos campos grandes y el botón
      ExercisePicker.tsx           # elegir ejercicio del catálogo
      ActiveWorkout.tsx            # la sesión en curso
      WorkoutPage.tsx              # pantalla Entrenar
      SyncBanner.tsx               # aviso de offline y pendientes
tests/
  rls/
    workouts.test.ts               # aislamiento de entrenos entre usuarios
```

Regla de decomposición: `lastPerformance.ts` y `workout-types.ts` no importan React ni Supabase ni Dexie. `workout-local.ts` no importa React ni Supabase. Cada capa se prueba sin montar la de arriba.

---

### Task 1: Tablas de entrenos con RLS

**Files:**
- Create: `supabase/migrations/0004_workouts.sql`, `tests/rls/workouts.test.ts`

**Interfaces:**
- Consumes: `public.exercises` y `auth.users`.
- Produces: tablas `public.workouts` y `public.workout_sets`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0004_workouts.sql`:

```sql
create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid,
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index workouts_user_started_idx
  on public.workouts (user_id, started_at desc);

create table public.workout_sets (
  id uuid primary key,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  set_index integer not null,
  reps integer not null,
  weight numeric(6, 2) not null,
  rpe numeric(3, 1),
  is_warmup boolean not null default false,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint reps_positive check (reps > 0 and reps <= 1000),
  constraint weight_sane check (weight >= 0 and weight <= 1000),
  constraint rpe_range check (rpe is null or (rpe >= 1 and rpe <= 10)),
  constraint set_index_positive check (set_index >= 0)
);

create index workout_sets_workout_idx on public.workout_sets (workout_id);
-- Para "¿qué levanté la última vez en este ejercicio?", que se consulta en
-- cada pantalla de registro.
create index workout_sets_exercise_completed_idx
  on public.workout_sets (exercise_id, completed_at desc);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;

-- Los entrenos son estrictamente privados. No hay lectura pública, ni siquiera
-- entre amigos: compartir rutinas no es compartir el historial.
create policy workouts_select_own
  on public.workouts for select
  using (auth.uid() = user_id);

create policy workouts_insert_own
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy workouts_update_own
  on public.workouts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy workouts_delete_own
  on public.workouts for delete
  using (auth.uid() = user_id);

-- Las series heredan la privacidad de su entreno.
create policy workout_sets_select_own
  on public.workout_sets for select
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create policy workout_sets_insert_own
  on public.workout_sets for insert
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create policy workout_sets_delete_own
  on public.workout_sets for delete
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

-- Sin UPDATE a propósito: una serie se corrige borrándola y volviéndola a
-- registrar. Eso elimina la clase entera de conflictos de escritura.

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, delete on public.workout_sets to authenticated;
grant all on public.workouts to service_role;
grant all on public.workout_sets to service_role;
-- anon no recibe nada: un visitante sin sesión no tiene entrenos.
```

- [ ] **Step 2: Aplicar la migración**

```bash
pnpm db:reset
```
Esperado: aplica de `0001` a `0004` sin errores.

- [ ] **Step 3: Escribir las pruebas que fallan**

Crear `tests/rls/workouts.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de workouts y workout_sets', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>
  let aliceWorkoutId: string
  let aliceSetId: string
  let exerciseId: string

  beforeAll(async () => {
    const stamp = Date.now().toString().slice(-6)
    alice = await createTestUser(`w-alice-${stamp}@trainway.test`)
    bob = await createTestUser(`w-bob-${stamp}@trainway.test`)

    exerciseId = `w_ex_${stamp}`
    aliceWorkoutId = randomUUID()
    aliceSetId = randomUUID()

    const admin = adminClient()

    const { error: exerciseError } = await admin
      .from('exercises')
      .insert({ id: exerciseId, name: 'Sentadilla de prueba', owner_id: null })
    if (exerciseError) throw exerciseError

    const { error: workoutError } = await alice.client.from('workouts').insert({
      id: aliceWorkoutId,
      user_id: alice.id,
      started_at: new Date().toISOString(),
    })
    if (workoutError) throw workoutError

    const { error: setError } = await alice.client.from('workout_sets').insert({
      id: aliceSetId,
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 0,
      reps: 8,
      weight: 60,
      completed_at: new Date().toISOString(),
    })
    if (setError) throw setError
  }, 30_000)

  it('deja al dueño leer su entreno', async () => {
    const { data, error } = await alice.client
      .from('workouts')
      .select('id')
      .eq('id', aliceWorkoutId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(aliceWorkoutId)
  })

  it('esconde el entreno de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('workouts')
      .select('id')
      .eq('id', aliceWorkoutId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('esconde las series de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('workout_sets')
      .select('id')
      .eq('id', aliceSetId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('niega todo acceso a un visitante sin sesión', async () => {
    const { error } = await anonClient().from('workouts').select('id').limit(1)
    expect(error?.code).toBe('42501')
  })

  it('impide a Bob crear un entreno a nombre de Alice', async () => {
    const { error } = await bob.client.from('workouts').insert({
      id: randomUUID(),
      user_id: alice.id,
      started_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('42501')
  })

  it('impide a Bob meter una serie en el entreno de Alice', async () => {
    const { error } = await bob.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 1,
      reps: 5,
      weight: 100,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('42501')
  })

  it('impide a Bob borrar el entreno de Alice', async () => {
    const { data, error } = await bob.client
      .from('workouts')
      .delete()
      .eq('id', aliceWorkoutId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('rechaza repeticiones fuera de rango', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 2,
      reps: 0,
      weight: 60,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('23514')
  })

  it('rechaza un peso absurdo', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 3,
      reps: 5,
      weight: 5000,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('23514')
  })

  it('acepta el peso corporal como cero', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 4,
      reps: 12,
      weight: 0,
      completed_at: new Date().toISOString(),
    })

    expect(error).toBeNull()
  })

  it('no permite actualizar una serie ya registrada', async () => {
    const { data, error } = await alice.client
      .from('workout_sets')
      .update({ reps: 99 })
      .eq('id', aliceSetId)
      .select()

    // Sin grant de UPDATE, PostgREST responde permiso denegado.
    expect(error?.code ?? (data?.length === 0 ? 'sin-filas' : 'inesperado')).not.toBe(
      'inesperado',
    )
  })

  it('borra en cascada las series al borrar el entreno', async () => {
    const workoutId = randomUUID()
    const setId = randomUUID()

    await alice.client.from('workouts').insert({
      id: workoutId,
      user_id: alice.id,
      started_at: new Date().toISOString(),
    })
    await alice.client.from('workout_sets').insert({
      id: setId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_index: 0,
      reps: 5,
      weight: 50,
      completed_at: new Date().toISOString(),
    })

    await alice.client.from('workouts').delete().eq('id', workoutId)

    const { data } = await alice.client
      .from('workout_sets')
      .select('id')
      .eq('id', setId)
      .maybeSingle()

    expect(data).toBeNull()
  })
})
```

- [ ] **Step 4: Ejecutar las pruebas**

```bash
pnpm test:rls
```
Esperado: PASAN las 12 nuevas más las 23 existentes. Total 35.

- [ ] **Step 5: Comprobar que el aislamiento no pasa por accidente**

Sustituir temporalmente `workouts_select_own` por `using (true)`:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: FALLA `esconde el entreno de Alice a Bob`. Restaurar y repetir:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: PASAN las 35.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_workouts.sql tests/rls/workouts.test.ts
git commit -m "feat: add workouts and workout_sets tables with private RLS"
```

---

### Task 2: Capa local en IndexedDB

**Files:**
- Create: `src/features/workouts/workout-types.ts`, `src/features/workouts/workout-local.ts`
- Modify: `src/lib/db.ts`
- Test: `src/features/workouts/workout-local.test.ts`

**Interfaces:**
- Consumes: la base Dexie `trainway` versión 1 de `src/lib/db.ts`.
- Produces:
  - Tipos `Workout`, `WorkoutSet`, `PendingOperation`
  - `startWorkout(userId: string): Promise<Workout>`
  - `getActiveWorkout(): Promise<Workout | null>`
  - `addSet(input): Promise<WorkoutSet>`
  - `removeSet(setId: string): Promise<void>`
  - `getSetsFor(workoutId: string): Promise<WorkoutSet[]>`
  - `finishWorkout(workoutId: string): Promise<void>`
  - `pendingCount(): Promise<number>`

- [ ] **Step 1: Instalar el sustituto de IndexedDB para pruebas**

```bash
pnpm add -D fake-indexeddb
```

jsdom no implementa IndexedDB. Sin este paquete la capa local no se puede probar sin navegador.

- [ ] **Step 2: Definir los tipos**

Crear `src/features/workouts/workout-types.ts`:

```typescript
export type Workout = {
  id: string
  userId: string
  routineId: string | null
  startedAt: string
  endedAt: string | null
  notes: string | null
}

export type WorkoutSet = {
  id: string
  workoutId: string
  exerciseId: string
  setIndex: number
  reps: number
  weight: number
  rpe: number | null
  isWarmup: boolean
  completedAt: string
}

/**
 * Una operación que aún no llegó al servidor. `attempts` sirve para el
 * backoff; `lastError` para poder decirle al usuario qué pasa si algo se
 * atora muchas veces.
 */
export type PendingOperation = {
  id: string
  kind: 'workout' | 'set' | 'finish' | 'deleteSet'
  payload: unknown
  createdAt: string
  attempts: number
  lastError: string | null
}
```

- [ ] **Step 3: Ampliar el esquema de Dexie**

En `src/lib/db.ts`, **conservar la declaración de la versión 1 tal cual** y añadir la versión 2 debajo. Dexie aplica las migraciones en orden y borrar la versión 1 rompería a quien ya tenga datos:

```typescript
db.version(2).stores({
  exercises: 'id, name',
  meta: 'key',
  workouts: 'id, userId, startedAt, endedAt',
  workoutSets: 'id, workoutId, exerciseId, completedAt',
  syncQueue: 'id, createdAt',
})
```

Ampliar también el tipo de `db` para incluir `workouts`, `workoutSets` y `syncQueue`.

- [ ] **Step 4: Escribir la prueba que falla**

Crear `src/features/workouts/workout-local.test.ts`:

```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../lib/db'
import {
  startWorkout,
  getActiveWorkout,
  addSet,
  removeSet,
  getSetsFor,
  finishWorkout,
  pendingCount,
} from './workout-local'

const USER = '11111111-1111-1111-1111-111111111111'
const EXERCISE = 'squat'

describe('workout-local', () => {
  beforeEach(async () => {
    await db.workouts.clear()
    await db.workoutSets.clear()
    await db.syncQueue.clear()
  })

  it('no hay entreno activo al empezar', async () => {
    expect(await getActiveWorkout()).toBeNull()
  })

  it('crea un entreno activo con identificador propio', async () => {
    const workout = await startWorkout(USER)

    expect(workout.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(workout.endedAt).toBeNull()
    expect(await getActiveWorkout()).toMatchObject({ id: workout.id })
  })

  it('encola el entreno para subirlo', async () => {
    await startWorkout(USER)
    expect(await pendingCount()).toBe(1)
  })

  it('registra una serie y la devuelve en el listado', async () => {
    const workout = await startWorkout(USER)
    await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 8,
      weight: 60,
    })

    const sets = await getSetsFor(workout.id)
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ reps: 8, weight: 60, setIndex: 0 })
  })

  it('numera las series por ejercicio dentro del entreno', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 6, weight: 65 })
    await addSet({ workoutId: workout.id, exerciseId: 'bench', reps: 10, weight: 40 })

    const sets = await getSetsFor(workout.id)
    const squats = sets.filter((set) => set.exerciseId === EXERCISE)
    const bench = sets.filter((set) => set.exerciseId === 'bench')

    expect(squats.map((set) => set.setIndex)).toEqual([0, 1])
    expect(bench.map((set) => set.setIndex)).toEqual([0])
  })

  it('acepta el peso corporal como cero', async () => {
    const workout = await startWorkout(USER)
    const set = await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 12,
      weight: 0,
    })

    expect(set.weight).toBe(0)
  })

  it('rechaza repeticiones no positivas', async () => {
    const workout = await startWorkout(USER)
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 0, weight: 60 }),
    ).rejects.toThrow()
  })

  it('rechaza un peso negativo', async () => {
    const workout = await startWorkout(USER)
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 5, weight: -1 }),
    ).rejects.toThrow()
  })

  it('encola cada serie además del entreno', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 6, weight: 65 })

    expect(await pendingCount()).toBe(3)
  })

  it('borra una serie y la saca del listado', async () => {
    const workout = await startWorkout(USER)
    const set = await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 8,
      weight: 60,
    })

    await removeSet(set.id)

    expect(await getSetsFor(workout.id)).toHaveLength(0)
  })

  it('cierra el entreno y deja de estar activo', async () => {
    const workout = await startWorkout(USER)
    await finishWorkout(workout.id)

    expect(await getActiveWorkout()).toBeNull()
    const stored = await db.workouts.get(workout.id)
    expect(stored?.endedAt).not.toBeNull()
  })

  it('sobrevive a un reinicio de la aplicación', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })

    // Simula que la app se cerró: se vuelve a leer desde cero, sin estado en memoria.
    const active = await getActiveWorkout()
    expect(active?.id).toBe(workout.id)
    expect(await getSetsFor(workout.id)).toHaveLength(1)
  })
})
```

- [ ] **Step 5: Ejecutar para ver fallar**

```bash
pnpm test workout-local
```
Esperado: FALLA, `Failed to resolve import "./workout-local"`.

- [ ] **Step 6: Implementar la capa local**

Crear `src/features/workouts/workout-local.ts`. No importa React ni Supabase a propósito:

```typescript
import { db } from '../../lib/db'
import type { Workout, WorkoutSet } from './workout-types'

function newId(): string {
  return crypto.randomUUID()
}

async function enqueue(kind: 'workout' | 'set' | 'finish' | 'deleteSet', payload: unknown) {
  await db.syncQueue.add({
    id: newId(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  })
}

export async function startWorkout(userId: string): Promise<Workout> {
  const workout: Workout = {
    id: newId(),
    userId,
    routineId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    notes: null,
  }

  await db.transaction('rw', db.workouts, db.syncQueue, async () => {
    await db.workouts.add(workout)
    await enqueue('workout', workout)
  })

  return workout
}

export async function getActiveWorkout(): Promise<Workout | null> {
  const open = await db.workouts.filter((workout) => workout.endedAt === null).toArray()
  if (open.length === 0) return null
  // Si por lo que sea hubiera más de uno abierto, el más reciente manda.
  return open.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

export async function addSet(input: {
  workoutId: string
  exerciseId: string
  reps: number
  weight: number
  rpe?: number | null
  isWarmup?: boolean
}): Promise<WorkoutSet> {
  if (!Number.isFinite(input.reps) || input.reps <= 0) {
    throw new Error('Las repeticiones tienen que ser mayores que cero')
  }
  if (!Number.isFinite(input.weight) || input.weight < 0) {
    throw new Error('El peso no puede ser negativo')
  }

  const existing = await db.workoutSets
    .where('workoutId')
    .equals(input.workoutId)
    .toArray()

  const sameExercise = existing.filter((set) => set.exerciseId === input.exerciseId)

  const set: WorkoutSet = {
    id: newId(),
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    setIndex: sameExercise.length,
    reps: input.reps,
    weight: input.weight,
    rpe: input.rpe ?? null,
    isWarmup: input.isWarmup ?? false,
    completedAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.workoutSets, db.syncQueue, async () => {
    await db.workoutSets.add(set)
    await enqueue('set', set)
  })

  return set
}

export async function removeSet(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, db.syncQueue, async () => {
    await db.workoutSets.delete(setId)
    await enqueue('deleteSet', { id: setId })
  })
}

export async function getSetsFor(workoutId: string): Promise<WorkoutSet[]> {
  const sets = await db.workoutSets.where('workoutId').equals(workoutId).toArray()
  return sets.sort((a, b) => a.completedAt.localeCompare(b.completedAt))
}

export async function finishWorkout(workoutId: string): Promise<void> {
  const endedAt = new Date().toISOString()

  await db.transaction('rw', db.workouts, db.syncQueue, async () => {
    await db.workouts.update(workoutId, { endedAt })
    await enqueue('finish', { id: workoutId, endedAt })
  })
}

export async function pendingCount(): Promise<number> {
  return db.syncQueue.count()
}
```

- [ ] **Step 7: Ejecutar y verificar que pasa**

```bash
pnpm test workout-local
```
Esperado: PASAN las 13.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts src/features/workouts package.json pnpm-lock.yaml
git commit -m "feat: add local-first workout storage in IndexedDB"
```

---

### Task 3: Cola de sincronización

**Files:**
- Create: `src/features/workouts/workout-repository.ts`, `src/features/workouts/sync-queue.ts`, `src/features/workouts/useOnlineStatus.ts`
- Test: `src/features/workouts/sync-queue.test.ts`

**Interfaces:**
- Consumes: la cola `db.syncQueue` de la Task 2 y las tablas de la Task 1.
- Produces:
  - `pushWorkout`, `pushSet`, `pushFinish`, `pushDeleteSet` en el repositorio
  - `flushQueue(): Promise<{ sent: number; failed: number }>`
  - `useOnlineStatus(): boolean`

- [ ] **Step 1: Implementar el repositorio**

Crear `src/features/workouts/workout-repository.ts`:

```typescript
import { supabase } from '../../lib/supabase'
import type { Workout, WorkoutSet } from './workout-types'

export async function pushWorkout(workout: Workout): Promise<void> {
  // upsert y no insert: reintentar una subida ya aplicada no debe fallar.
  // El identificador lo generó el dispositivo, así que la fila es la misma.
  const { error } = await supabase.from('workouts').upsert(
    {
      id: workout.id,
      user_id: workout.userId,
      routine_id: workout.routineId,
      started_at: workout.startedAt,
      ended_at: workout.endedAt,
      notes: workout.notes,
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(error.message)
}

export async function pushSet(set: WorkoutSet): Promise<void> {
  // insert y no upsert: workout_sets no tiene grant de UPDATE a propósito, así
  // que un upsert sobre una fila existente daría 42501 en vez del 23505 que la
  // cola sabe interpretar como "ya estaba subida". Con insert, un reintento de
  // algo ya aplicado produce exactamente el conflicto de clave que se espera.
  const { error } = await supabase.from('workout_sets').insert({
    id: set.id,
    workout_id: set.workoutId,
    exercise_id: set.exerciseId,
    set_index: set.setIndex,
    reps: set.reps,
    weight: set.weight,
    rpe: set.rpe,
    is_warmup: set.isWarmup,
    completed_at: set.completedAt,
  })
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
}

export async function pushFinish(input: { id: string; endedAt: string }): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ ended_at: input.endedAt })
    .eq('id', input.id)
  if (error) throw new Error(error.message)
}

export async function pushDeleteSet(input: { id: string }): Promise<void> {
  const { error } = await supabase.from('workout_sets').delete().eq('id', input.id)
  if (error) throw new Error(error.message)
}
```

`pushWorkout` sí usa `upsert` porque `workouts` tiene grant de UPDATE y la operación `finish` necesita modificar `ended_at`. `pushSet` usa `insert` por la razón del comentario. Los mensajes de error incluyen el código de PostgREST para que `sync-queue` pueda distinguir "ya estaba subida" de un fallo real.

- [ ] **Step 2: Escribir la prueba que falla para la cola**

Crear `src/features/workouts/sync-queue.test.ts`:

```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const pushWorkout = vi.fn()
const pushSet = vi.fn()
const pushFinish = vi.fn()
const pushDeleteSet = vi.fn()

vi.mock('./workout-repository', () => ({
  pushWorkout: (...args: unknown[]) => pushWorkout(...args),
  pushSet: (...args: unknown[]) => pushSet(...args),
  pushFinish: (...args: unknown[]) => pushFinish(...args),
  pushDeleteSet: (...args: unknown[]) => pushDeleteSet(...args),
}))

const { db } = await import('../../lib/db')
const { flushQueue } = await import('./sync-queue')

async function enqueue(kind: string, payload: unknown, id = crypto.randomUUID()) {
  await db.syncQueue.add({
    id,
    kind: kind as never,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  })
}

describe('sync-queue', () => {
  beforeEach(async () => {
    await db.syncQueue.clear()
    pushWorkout.mockReset().mockResolvedValue(undefined)
    pushSet.mockReset().mockResolvedValue(undefined)
    pushFinish.mockReset().mockResolvedValue(undefined)
    pushDeleteSet.mockReset().mockResolvedValue(undefined)
  })

  it('no hace nada con la cola vacía', async () => {
    const result = await flushQueue()
    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(pushWorkout).not.toHaveBeenCalled()
  })

  it('sube una operación y la saca de la cola', async () => {
    await enqueue('workout', { id: 'w1' })

    const result = await flushQueue()

    expect(pushWorkout).toHaveBeenCalledOnce()
    expect(result.sent).toBe(1)
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('respeta el orden de encolado', async () => {
    const order: string[] = []
    pushWorkout.mockImplementation(async () => {
      order.push('workout')
    })
    pushSet.mockImplementation(async () => {
      order.push('set')
    })

    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })

    await flushQueue()

    expect(order).toEqual(['workout', 'set'])
  })

  it('conserva en la cola lo que falló', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })

    const result = await flushQueue()

    expect(result).toEqual({ sent: 0, failed: 1 })
    expect(await db.syncQueue.count()).toBe(1)
  })

  it('cuenta el intento fallido y guarda el motivo', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })

    await flushQueue()

    const [pending] = await db.syncQueue.toArray()
    expect(pending.attempts).toBe(1)
    expect(pending.lastError).toContain('sin red')
  })

  it('se detiene en el primer fallo para no romper el orden', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })

    await flushQueue()

    // La serie depende de que su entreno exista en el servidor: subirla
    // primero fallaría por la llave foránea.
    expect(pushSet).not.toHaveBeenCalled()
    expect(await db.syncQueue.count()).toBe(2)
  })

  it('trata el conflicto de clave duplicada como éxito', async () => {
    pushSet.mockRejectedValue(new Error('duplicate key value violates unique constraint'))
    await enqueue('set', { id: 's1' })

    const result = await flushQueue()

    expect(result.sent).toBe(1)
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('vacía la cola completa cuando todo sale bien', async () => {
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })
    await enqueue('finish', { id: 'w1', endedAt: new Date().toISOString() })

    const result = await flushQueue()

    expect(result.sent).toBe(3)
    expect(await db.syncQueue.count()).toBe(0)
  })
})
```

- [ ] **Step 3: Ejecutar para ver fallar**

```bash
pnpm test sync-queue
```
Esperado: FALLA, `Failed to resolve import "./sync-queue"`.

- [ ] **Step 4: Implementar la cola**

Crear `src/features/workouts/sync-queue.ts`:

```typescript
import { db } from '../../lib/db'
import {
  pushWorkout,
  pushSet,
  pushFinish,
  pushDeleteSet,
} from './workout-repository'
import type { PendingOperation, Workout, WorkoutSet } from './workout-types'

/**
 * Una fila ya presente en el servidor no es un fallo: significa que un intento
 * anterior sí llegó y la respuesta se perdió. Tratarlo como error dejaría la
 * cola atorada para siempre.
 */
function isAlreadyApplied(message: string): boolean {
  return (
    message.includes('duplicate key') ||
    message.includes('already exists') ||
    message.includes('23505')
  )
}

async function apply(operation: PendingOperation): Promise<void> {
  switch (operation.kind) {
    case 'workout':
      return pushWorkout(operation.payload as Workout)
    case 'set':
      return pushSet(operation.payload as WorkoutSet)
    case 'finish':
      return pushFinish(operation.payload as { id: string; endedAt: string })
    case 'deleteSet':
      return pushDeleteSet(operation.payload as { id: string })
  }
}

/**
 * Sube lo pendiente en el orden en que se creó y se detiene en el primer
 * fallo: una serie depende de que su entreno ya exista en el servidor, así que
 * saltarse una operación rompería la llave foránea de la siguiente.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const pending = (await db.syncQueue.toArray()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )

  let sent = 0

  for (const operation of pending) {
    try {
      await apply(operation)
      await db.syncQueue.delete(operation.id)
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (isAlreadyApplied(message)) {
        await db.syncQueue.delete(operation.id)
        sent += 1
        continue
      }

      await db.syncQueue.update(operation.id, {
        attempts: operation.attempts + 1,
        lastError: message,
      })
      return { sent, failed: pending.length - sent }
    }
  }

  return { sent, failed: 0 }
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

```bash
pnpm test sync-queue
```
Esperado: PASAN las 8.

- [ ] **Step 6: Implementar el estado de red**

Crear `src/features/workouts/useOnlineStatus.ts`:

```typescript
import { useEffect, useState } from 'react'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
```

- [ ] **Step 7: Commit**

```bash
git add src/features/workouts
git commit -m "feat: add sync queue that survives failures without losing data"
```

---

### Task 4: Referencia de la última vez

**Files:**
- Create: `src/features/workouts/lastPerformance.ts`
- Test: `src/features/workouts/lastPerformance.test.ts`

**Interfaces:**
- Consumes: el tipo `WorkoutSet`.
- Produces: `lastPerformance(sets: WorkoutSet[], exerciseId: string): WorkoutSet[] | null`

Esta referencia es lo que hace que la app se use: ver en gris lo que levantaste la última vez es la diferencia entre una libreta y una herramienta.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/workouts/lastPerformance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { lastPerformance } from './lastPerformance'
import type { WorkoutSet } from './workout-types'

function set(
  workoutId: string,
  exerciseId: string,
  completedAt: string,
  reps: number,
  weight: number,
): WorkoutSet {
  return {
    id: `${workoutId}-${exerciseId}-${completedAt}-${reps}`,
    workoutId,
    exerciseId,
    setIndex: 0,
    reps,
    weight,
    rpe: null,
    isWarmup: false,
    completedAt,
  }
}

describe('lastPerformance', () => {
  it('devuelve null cuando no hay historial', () => {
    expect(lastPerformance([], 'squat')).toBeNull()
  })

  it('devuelve null cuando el ejercicio nunca se hizo', () => {
    const history = [set('w1', 'bench', '2026-08-01T10:00:00Z', 8, 60)]
    expect(lastPerformance(history, 'squat')).toBeNull()
  })

  it('devuelve las series del entreno más reciente con ese ejercicio', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
      set('w1', 'squat', '2026-08-01T10:05:00Z', 8, 60),
      set('w2', 'squat', '2026-08-03T10:00:00Z', 6, 70),
      set('w2', 'squat', '2026-08-03T10:05:00Z', 6, 72.5),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last).toHaveLength(2)
    expect(last?.map((entry) => entry.weight)).toEqual([70, 72.5])
  })

  it('no mezcla ejercicios distintos', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
      set('w2', 'bench', '2026-08-03T10:00:00Z', 10, 40),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last).toHaveLength(1)
    expect(last?.[0].weight).toBe(60)
  })

  it('ordena las series del entreno por hora', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:10:00Z', 6, 65),
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last?.map((entry) => entry.weight)).toEqual([60, 65])
  })

  it('ignora las series de calentamiento', () => {
    const history: WorkoutSet[] = [
      { ...set('w1', 'squat', '2026-08-01T10:00:00Z', 10, 20), isWarmup: true },
      set('w1', 'squat', '2026-08-01T10:05:00Z', 8, 60),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last).toHaveLength(1)
    expect(last?.[0].weight).toBe(60)
  })

  it('excluye el entreno en curso cuando se le indica', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
      set('w2', 'squat', '2026-08-03T10:00:00Z', 6, 70),
    ]

    const last = lastPerformance(history, 'squat', 'w2')

    expect(last?.[0].weight).toBe(60)
  })
})
```

- [ ] **Step 2: Ejecutar para ver fallar**

```bash
pnpm test lastPerformance
```
Esperado: FALLA, `Failed to resolve import "./lastPerformance"`.

- [ ] **Step 3: Implementar**

Crear `src/features/workouts/lastPerformance.ts`:

```typescript
import type { WorkoutSet } from './workout-types'

/**
 * Las series del último entreno en que se hizo este ejercicio. Se excluye el
 * entreno en curso: comparar contra lo que acabas de levantar hace un minuto
 * no dice nada.
 */
export function lastPerformance(
  sets: WorkoutSet[],
  exerciseId: string,
  excludeWorkoutId?: string,
): WorkoutSet[] | null {
  const candidates = sets.filter(
    (set) =>
      set.exerciseId === exerciseId &&
      !set.isWarmup &&
      set.workoutId !== excludeWorkoutId,
  )

  if (candidates.length === 0) return null

  const latest = candidates.reduce((best, current) =>
    current.completedAt > best.completedAt ? current : best,
  )

  return candidates
    .filter((set) => set.workoutId === latest.workoutId)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

```bash
pnpm test lastPerformance
```
Esperado: PASAN las 7.

- [ ] **Step 5: Commit**

```bash
git add src/features/workouts/lastPerformance.ts src/features/workouts/lastPerformance.test.ts
git commit -m "feat: add last-performance lookup for the set logger"
```

---

### Task 5: Pantalla de entreno

**Files:**
- Create: `src/features/workouts/SetLogger.tsx`, `src/features/workouts/ExercisePicker.tsx`, `src/features/workouts/ActiveWorkout.tsx`, `src/features/workouts/WorkoutPage.tsx`, `src/features/workouts/SyncBanner.tsx`
- Test: `src/features/workouts/SetLogger.test.tsx`, `src/features/workouts/WorkoutPage.test.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Consumes: todo lo anterior, más `loadExercises`/`searchExercises` del Plan 2 y `useAuth`.
- Produces: la pantalla Entrenar, en la ruta índice `/`.

- [ ] **Step 1: Escribir la prueba que falla para el registrador de series**

Crear `src/features/workouts/SetLogger.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetLogger } from './SetLogger'

describe('SetLogger', () => {
  const onLog = vi.fn()

  beforeEach(() => {
    onLog.mockReset().mockResolvedValue(undefined)
  })

  it('registra peso y repeticiones', async () => {
    const user = userEvent.setup()
    render(<SetLogger exerciseName="Sentadilla" lastSets={null} onLog={onLog} />)

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(onLog).toHaveBeenCalledWith({ weight: 60, reps: 8 })
  })

  it('acepta peso con decimales', async () => {
    const user = userEvent.setup()
    render(<SetLogger exerciseName="Sentadilla" lastSets={null} onLog={onLog} />)

    await user.type(screen.getByLabelText(/peso/i), '62.5')
    await user.type(screen.getByLabelText(/repeticiones/i), '6')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(onLog).toHaveBeenCalledWith({ weight: 62.5, reps: 6 })
  })

  it('acepta peso corporal como cero', async () => {
    const user = userEvent.setup()
    render(<SetLogger exerciseName="Dominadas" lastSets={null} onLog={onLog} />)

    await user.type(screen.getByLabelText(/peso/i), '0')
    await user.type(screen.getByLabelText(/repeticiones/i), '12')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(onLog).toHaveBeenCalledWith({ weight: 0, reps: 12 })
  })

  it('avisa si faltan las repeticiones', async () => {
    const user = userEvent.setup()
    render(<SetLogger exerciseName="Sentadilla" lastSets={null} onLog={onLog} />)

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onLog).not.toHaveBeenCalled()
  })

  it('limpia las repeticiones tras registrar pero conserva el peso', async () => {
    const user = userEvent.setup()
    render(<SetLogger exerciseName="Sentadilla" lastSets={null} onLog={onLog} />)

    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar/i }))

    // Normalmente repites el mismo peso varias series seguidas.
    expect(screen.getByLabelText(/peso/i)).toHaveValue('60')
    expect(screen.getByLabelText(/repeticiones/i)).toHaveValue('')
  })

  it('muestra lo que se levantó la última vez', () => {
    render(
      <SetLogger
        exerciseName="Sentadilla"
        lastSets={[
          {
            id: '1',
            workoutId: 'w1',
            exerciseId: 'squat',
            setIndex: 0,
            reps: 8,
            weight: 60,
            rpe: null,
            isWarmup: false,
            completedAt: '2026-08-01T10:00:00Z',
          },
        ]}
        onLog={onLog}
      />,
    )

    expect(screen.getByText(/60 kg × 8/)).toBeInTheDocument()
  })

  it('no muestra referencia cuando es la primera vez', () => {
    render(<SetLogger exerciseName="Sentadilla" lastSets={null} onLog={onLog} />)
    expect(screen.getByText(/primera vez/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar para ver fallar**

```bash
pnpm test SetLogger
```
Esperado: FALLA, `Failed to resolve import "./SetLogger"`.

- [ ] **Step 3: Implementar el registrador**

Crear `src/features/workouts/SetLogger.tsx`. Los campos son grandes y numéricos porque se usan de pie, con una mano, sudando:

```typescript
import { useState, type FormEvent } from 'react'
import { formatWeight } from '../../shared/formatWeight'
import type { WorkoutSet } from './workout-types'

const FIELD =
  'w-full rounded-lg border border-border bg-surface-raised px-4 py-4 text-2xl text-content'

export function SetLogger({
  exerciseName,
  lastSets,
  onLog,
}: {
  exerciseName: string
  lastSets: WorkoutSet[] | null
  onLog: (input: { weight: number; reps: number }) => Promise<void>
}) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()

    const weightValue = Number(weight)
    const repsValue = Number(reps)

    if (weight.trim() === '' || !Number.isFinite(weightValue) || weightValue < 0) {
      setError('Escribe el peso')
      return
    }
    if (reps.trim() === '' || !Number.isInteger(repsValue) || repsValue <= 0) {
      setError('Escribe cuántas repeticiones hiciste')
      return
    }

    setError(null)
    setSaving(true)
    await onLog({ weight: weightValue, reps: repsValue })
    setSaving(false)

    // El peso se conserva: casi siempre repites el mismo varias series.
    setReps('')
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-content">{exerciseName}</h2>

      <p className="text-sm text-content-muted">
        {lastSets && lastSets.length > 0
          ? `La última vez: ${lastSets
              .map((set) => `${formatWeight(set.weight)} × ${set.reps}`)
              .join(', ')}`
          : 'Primera vez con este ejercicio'}
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="set-weight" className="text-sm text-content-muted">
            Peso (kg)
          </label>
          <input
            id="set-weight"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className={FIELD}
            autoComplete="off"
          />
        </div>

        <div className="flex-1">
          <label htmlFor="set-reps" className="text-sm text-content-muted">
            Repeticiones
          </label>
          <input
            id="set-reps"
            inputMode="numeric"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className={FIELD}
            autoComplete="off"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand px-4 py-4 text-lg font-medium text-brand-content disabled:opacity-60"
      >
        Registrar serie
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

```bash
pnpm test SetLogger
```
Esperado: PASAN las 7.

- [ ] **Step 5: Implementar el selector de ejercicio**

Crear `src/features/workouts/ExercisePicker.tsx`: carga el catálogo con `loadExercises()`, filtra con `searchExercises()`, y llama a `onPick(exercise)` al tocar uno. Reutilizar el patrón visual de `ExerciseList` del Plan 2 — imagen a la izquierda, nombre y músculo a la derecha — pero cada elemento es un `<button>` en lugar de un `<li>` pasivo, para que sea alcanzable por teclado. Todo color desde tokens.

- [ ] **Step 6: Implementar el aviso de sincronización**

Crear `src/features/workouts/SyncBanner.tsx`:

```typescript
export function SyncBanner({ online, pending }: { online: boolean; pending: number }) {
  if (online && pending === 0) return null

  const message = !online
    ? pending > 0
      ? `Sin conexión. ${pending} ${pending === 1 ? 'cambio' : 'cambios'} por subir.`
      : 'Sin conexión. Tus series se guardan en el teléfono.'
    : `Subiendo ${pending} ${pending === 1 ? 'cambio' : 'cambios'}…`

  return (
    <p
      role="status"
      className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm text-content-muted"
    >
      {message}
    </p>
  )
}
```

- [ ] **Step 7: Implementar la sesión en curso y la pantalla**

Crear `src/features/workouts/ActiveWorkout.tsx` y `src/features/workouts/WorkoutPage.tsx`.

`WorkoutPage` es la pantalla de la ruta índice. Comportamiento requerido:

- Al montar, busca el entreno activo con `getActiveWorkout()`. Si no hay, muestra un botón **Empezar entreno** que llama a `startWorkout(session.user.id)`.
- Con entreno activo, muestra `SyncBanner`, la lista de series ya registradas agrupadas por ejercicio, el `SetLogger` del ejercicio seleccionado, un botón para cambiar de ejercicio que abre `ExercisePicker`, y un botón **Terminar entreno** que llama a `finishWorkout`.
- Cada serie registrada se puede borrar con un botón junto a ella que llama a `removeSet`.
- Llama a `flushQueue()` al montar y cada vez que `useOnlineStatus()` pase de falso a verdadero. Nunca bloquea la interfaz esperando a que termine.
- El contador de pendientes se refresca con `pendingCount()` después de cada registro y cada vaciado de cola.

**Terminar entreno es destructivo desde el punto de vista del usuario** — cierra la sesión y ya no puede añadir series. Pedir confirmación con un segundo toque en el mismo botón, que cambia a "¿Seguro?", en vez de un diálogo del navegador: los diálogos nativos bloquean y en una PWA se ven mal.

- [ ] **Step 8: Escribir la prueba de la pantalla**

Crear `src/features/workouts/WorkoutPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Workout, WorkoutSet } from './workout-types'

const getActiveWorkout = vi.fn()
const startWorkout = vi.fn()
const addSet = vi.fn()
const removeSet = vi.fn()
const getSetsFor = vi.fn()
const finishWorkout = vi.fn()
const pendingCount = vi.fn()
const flushQueue = vi.fn()
const loadExercises = vi.fn()

vi.mock('./workout-local', () => ({
  getActiveWorkout: () => getActiveWorkout(),
  startWorkout: (...a: unknown[]) => startWorkout(...a),
  addSet: (...a: unknown[]) => addSet(...a),
  removeSet: (...a: unknown[]) => removeSet(...a),
  getSetsFor: (...a: unknown[]) => getSetsFor(...a),
  finishWorkout: (...a: unknown[]) => finishWorkout(...a),
  pendingCount: () => pendingCount(),
}))

vi.mock('./sync-queue', () => ({ flushQueue: () => flushQueue() }))

vi.mock('../exercises/exercise-cache', () => ({
  loadExercises: () => loadExercises(),
}))

vi.mock('../exercises/exercise-repository', () => ({
  exerciseImageUrl: (path: string) => `http://test/${path}`,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    loading: false,
  }),
}))

const { WorkoutPage } = await import('./WorkoutPage')

const WORKOUT: Workout = {
  id: 'w1',
  userId: 'user-1',
  routineId: null,
  startedAt: '2026-08-04T10:00:00Z',
  endedAt: null,
  notes: null,
}

const SET: WorkoutSet = {
  id: 's1',
  workoutId: 'w1',
  exerciseId: 'squat',
  setIndex: 0,
  reps: 8,
  weight: 60,
  rpe: null,
  isWarmup: false,
  completedAt: '2026-08-04T10:05:00Z',
}

const CATALOG = [
  {
    id: 'squat',
    name: 'Sentadilla con barra',
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    instructions: [],
    imagePaths: [],
  },
]

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('WorkoutPage', () => {
  beforeEach(() => {
    getActiveWorkout.mockReset().mockResolvedValue(null)
    startWorkout.mockReset().mockResolvedValue(WORKOUT)
    addSet.mockReset().mockResolvedValue(SET)
    removeSet.mockReset().mockResolvedValue(undefined)
    getSetsFor.mockReset().mockResolvedValue([])
    finishWorkout.mockReset().mockResolvedValue(undefined)
    pendingCount.mockReset().mockResolvedValue(0)
    flushQueue.mockReset().mockResolvedValue({ sent: 0, failed: 0 })
    loadExercises.mockReset().mockResolvedValue(CATALOG)
    setOnline(true)
  })

  afterEach(() => {
    setOnline(true)
  })

  it('ofrece empezar cuando no hay entreno activo', async () => {
    render(<WorkoutPage />)
    expect(
      await screen.findByRole('button', { name: /empezar entreno/i }),
    ).toBeInTheDocument()
  })

  it('empieza un entreno al pulsar', async () => {
    const user = userEvent.setup()
    render(<WorkoutPage />)

    await user.click(await screen.findByRole('button', { name: /empezar entreno/i }))

    expect(startWorkout).toHaveBeenCalledWith('user-1')
    expect(await screen.findByText('Sentadilla con barra')).toBeInTheDocument()
  })

  it('registra una serie del ejercicio elegido', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    const user = userEvent.setup()
    render(<WorkoutPage />)

    await user.click(await screen.findByRole('button', { name: /sentadilla con barra/i }))
    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar serie/i }))

    await waitFor(() =>
      expect(addSet).toHaveBeenCalledWith(
        expect.objectContaining({ workoutId: 'w1', exerciseId: 'squat', reps: 8, weight: 60 }),
      ),
    )
  })

  it('avisa cuando no hay conexión', async () => {
    setOnline(false)
    getActiveWorkout.mockResolvedValue(WORKOUT)
    pendingCount.mockResolvedValue(2)

    render(<WorkoutPage />)

    expect(await screen.findByRole('status')).toHaveTextContent(/sin conexión/i)
  })

  it('no avisa con red y sin pendientes', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    render(<WorkoutPage />)

    await screen.findByRole('button', { name: /terminar entreno/i })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pide confirmación antes de terminar el entreno', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    const user = userEvent.setup()
    render(<WorkoutPage />)

    const button = await screen.findByRole('button', { name: /terminar entreno/i })
    await user.click(button)

    expect(finishWorkout).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /seguro/i }))

    expect(finishWorkout).toHaveBeenCalledWith('w1')
  })

  it('vacía la cola al montar', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    render(<WorkoutPage />)

    await waitFor(() => expect(flushQueue).toHaveBeenCalled())
  })
})
```

- [ ] **Step 9: Ejecutar y verificar**

```bash
pnpm test WorkoutPage
```
Esperado: PASAN las 7.

- [ ] **Step 10: Enlazar la ruta**

En `src/app/routes.tsx`, sustituir el marcador de posición de la ruta índice por `<WorkoutPage />`.

- [ ] **Step 11: Verificar el flujo real de punta a punta**

```bash
pnpm db:start
pnpm seed:exercises   # si el catálogo no está sembrado
pnpm dev
```

En el navegador:
1. Entrar, empezar un entreno, elegir un ejercicio, registrar tres series.
2. Recargar la página — las series siguen ahí y el entreno sigue activo.
3. Poner el navegador en modo offline desde las herramientas de desarrollo. Registrar dos series más. Comprobar que aparecen al instante y que el banner dice que hay cambios por subir.
4. Volver a poner red. Comprobar que el banner desaparece y que las filas llegaron al servidor:
   ```bash
   pnpm supabase status   # para la URL
   ```
   Consultar `workout_sets` y confirmar el número de filas.
5. Cerrar la pestaña con el entreno abierto y volver a entrar: el entreno sigue activo con sus series.
6. Terminar el entreno y comprobar que ya no aparece como activo.
7. Repetir el registro de una serie en tema claro y en oscuro.

- [ ] **Step 12: Ejecutar toda la verificación**

```bash
pnpm exec tsc -b && pnpm build && pnpm lint && pnpm test && pnpm test:rls
```
Esperado: todo limpio, y `pnpm test` también con `.env.local` movido a un lado.

- [ ] **Step 13: Commit**

```bash
git add src/features/workouts src/app/routes.tsx
git commit -m "feat: add offline-first workout logging screen"
```

---

## Al terminar este plan

Se puede registrar un entreno completo desde el teléfono, sin señal, y nada se pierde: las series se escriben en el dispositivo al instante y suben solas cuando vuelve la red. La pantalla muestra qué se levantó la última vez en cada ejercicio, que es la razón por la que alguien abre la app un martes cualquiera. Los entrenos son estrictamente privados y está probado con RLS.

Siguiente plan: **Plan 4 — Rutinas**, que permite guardar una secuencia de ejercicios y ejecutarla, en vez de elegirlos uno por uno cada vez.
