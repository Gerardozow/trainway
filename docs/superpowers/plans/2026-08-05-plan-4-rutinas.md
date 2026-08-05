# Trainway — Plan 4: Rutinas — Implementation Plan

**Goal:** Guardar una secuencia de ejercicios con sus series y repeticiones objetivo, y poder ejecutarla — en vez de elegir ejercicio por ejercicio cada vez.

**Architecture:** Una rutina es una lista ordenada de ejercicios con objetivos. Vive en el servidor, no en IndexedDB: se crea sentado en el sofá, no de pie en el gimnasio, así que no necesita el trato local-primero que sí necesitan las series. Al ejecutarla, la pantalla Entrenar arranca con esos ejercicios ya puestos y el resto del flujo es idéntico al del Plan 3.

**Tech Stack:** Postgres + RLS, React + TypeScript, Tailwind 4, Vitest.

## Contexto: qué existe ya

Planes 1, 1b, 2 y 3 completos y fusionados en `main`:

- PWA instalable, tema claro/oscuro por tokens `--color-*` (marca `#FFC603`, `--color-danger` en ambos temas).
- Autenticación por magic link con PKCE o por contraseña con identificador dual.
- `profiles`, `exercises` (873 sembrados, imágenes en Storage), `workouts` y `workout_sets`, todo con RLS probado. Migraciones hasta `0007_workouts.sql`.
- `src/features/exercises/`: `loadExercises()`, `searchExercises()`, `exerciseImageUrl()`, tipo `Exercise`. Catálogo cacheado entero en IndexedDB.
- `src/features/workouts/`: capa local en IndexedDB, cola de sincronización, `lastPerformance`, y la pantalla Entrenar con `SetLogger`, `ExercisePicker` y `SyncBanner`.
- `workouts.routine_id` ya existe como columna, sin llave foránea todavía: este plan la conecta.
- Vitest en tres proyectos: `unit` (jsdom, `pnpm test`, sin Docker ni variables de entorno), `rls` (node), `edge` (node).

## Global Constraints

- Gestor de paquetes: **pnpm**. `npm`, `npx` y `yarn` están bloqueados.
- **Ningún secreto en el cliente.** Bajo `src/` solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; nunca `process.env`.
- **`pnpm test` debe seguir pasando con `.env.local` ausente.**
- **Los tres proyectos de Vitest se conservan.**
- Toda tabla nueva lleva RLS en la migración que la crea, con grants explícitos por rol. Nada de heredar permisos.
- Todo color viene de un token `--color-*`. Errores en `text-danger` con `role="alert"`.
- Interfaz en español, identificadores en inglés. Producto: **Trainway**.
- TDD: la prueba que falla se escribe y se ejecuta antes de la implementación.

## Decisiones de diseño

**Por qué las rutinas no van a IndexedDB.** Las series se registran de pie, sudando, con mala señal: ahí el local-primero es obligatorio. Una rutina se arma sentado, con calma y con red. Meterla en la cola de sincronización añadiría complejidad sin resolver ningún problema real.

**Por qué la posición es un entero y no una lista enlazada.** Reordenar ejercicios reescribe las posiciones de la rutina entera en una transacción. Es O(n) sobre una lista de diez elementos: intentar algo más listo costaría más de lo que ahorra.

**Este plan no incluye compartir.** Compartir rutinas con amigos es el Plan 5, y trae consigo `share_token`, la función `security definer` para leer por token, y `forked_from`. Mezclarlo aquí haría un plan que no cabe en la cabeza.

---

## Estructura de archivos

```
supabase/
  migrations/
    0008_routines.sql              # routines, routine_exercises, RLS, grants
src/
  features/
    routines/
      routine-types.ts             # tipos, sin dependencias
      routine-repository.ts        # única puerta a Supabase para rutinas
      routine-order.ts             # reordenar y renumerar, puro
      RoutineList.tsx              # las rutinas del usuario
      RoutineEditor.tsx            # crear y editar
      RoutinesPage.tsx             # pantalla Rutinas
tests/
  rls/
    routines.test.ts               # aislamiento entre usuarios
```

---

### Task 1: Tablas de rutinas con RLS

**Files:**
- Create: `supabase/migrations/0008_routines.sql`, `tests/rls/routines.test.ts`

- [ ] **Step 1: Escribir la migración**

```sql
create table public.routines (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_name_length check (
    char_length(name) between 1 and 80
  )
);

create index routines_owner_idx on public.routines (owner_id, updated_at desc);

create table public.routine_exercises (
  id uuid primary key,
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position integer not null,
  target_sets integer,
  target_reps integer,
  target_weight numeric(6, 2),
  notes text,
  constraint position_positive check (position >= 0),
  constraint target_sets_sane check (
    target_sets is null or (target_sets > 0 and target_sets <= 50)
  ),
  constraint target_reps_sane check (
    target_reps is null or (target_reps > 0 and target_reps <= 1000)
  ),
  constraint target_weight_sane check (
    target_weight is null or (target_weight >= 0 and target_weight <= 1000)
  ),
  -- Dos ejercicios no pueden ocupar la misma posición en la misma rutina.
  -- Sin esto, un reordenamiento a medias dejaría un orden ambiguo.
  constraint unique_position_per_routine unique (routine_id, position)
    deferrable initially deferred
);

create index routine_exercises_routine_idx
  on public.routine_exercises (routine_id, position);

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;

-- Por ahora una rutina es estrictamente privada. El Plan 5 añade compartir.
create policy routines_select_own
  on public.routines for select
  using (auth.uid() = owner_id);

create policy routines_insert_own
  on public.routines for insert
  with check (auth.uid() = owner_id);

create policy routines_update_own
  on public.routines for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy routines_delete_own
  on public.routines for delete
  using (auth.uid() = owner_id);

-- Los ejercicios de una rutina heredan su dueño.
create policy routine_exercises_select_own
  on public.routine_exercises for select
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id and r.owner_id = auth.uid()
    )
  );

create policy routine_exercises_insert_own
  on public.routine_exercises for insert
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_id and r.owner_id = auth.uid()
    )
  );

create policy routine_exercises_update_own
  on public.routine_exercises for update
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.routines r
      where r.id = routine_id and r.owner_id = auth.uid()
    )
  );

create policy routine_exercises_delete_own
  on public.routine_exercises for delete
  using (
    exists (
      select 1 from public.routines r
      where r.id = routine_id and r.owner_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_exercises to authenticated;
grant all on public.routines to service_role;
grant all on public.routine_exercises to service_role;
-- anon no recibe nada: sin sesión no hay rutinas que ver.

-- Ahora que routines existe, se conecta la columna que workouts ya tenía.
-- on delete set null y no cascade: borrar una rutina no debe borrar el
-- historial de los entrenos que se hicieron con ella.
alter table public.workouts
  add constraint workouts_routine_id_fkey
  foreign key (routine_id) references public.routines (id) on delete set null;
```

- [ ] **Step 2: Aplicar y verificar los permisos**

```bash
pnpm db:reset
```

Comprobar que las tablas nuevas no heredaron nada — `anon` no debe aparecer:

```bash
docker exec supabase_db_trainway psql -U postgres -d postgres -t -c "
select grantee || ' en ' || table_name || ' -> ' || string_agg(privilege_type,',' order by privilege_type)
  from information_schema.role_table_grants
  where table_name in ('routines','routine_exercises') and grantee in ('anon','authenticated')
  group by grantee, table_name;"
```

- [ ] **Step 3: Escribir las pruebas de aislamiento**

Crear `tests/rls/routines.test.ts` cubriendo, con dos usuarios Alice y Bob y las mismas convenciones de los otros archivos de `tests/rls/` (`crypto.randomUUID().slice(0, 8)` para los identificadores, `afterAll` que limpia lo que la prueba insertó):

1. El dueño lee su rutina.
2. Bob no ve la rutina de Alice.
3. Un visitante sin sesión recibe `42501` al pedir rutinas.
4. Bob no puede crear una rutina a nombre de Alice (`42501`).
5. Bob no puede modificar la rutina de Alice (cero filas).
6. Bob no puede borrar la rutina de Alice (cero filas).
7. Bob no ve los ejercicios de la rutina de Alice.
8. Bob no puede meter un ejercicio en la rutina de Alice (`42501`).
9. Un nombre vacío se rechaza (`23514`).
10. Un nombre de más de 80 caracteres se rechaza (`23514`).
11. `target_sets` fuera de rango se rechaza (`23514`).
12. Dos ejercicios en la misma posición de la misma rutina se rechazan (`23505`).
13. Borrar la rutina borra sus ejercicios en cascada.
14. Borrar la rutina deja el entreno que la usó, con `routine_id` nulo.

- [ ] **Step 4: Comprobación de mutación**

Sustituir `routines_select_own` por `using (true)`, aplicar, y confirmar que falla **exactamente** la prueba 2 y ninguna otra. Restaurar y confirmar verde.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add routines and routine_exercises tables with private RLS"
```

---

### Task 2: Reordenar, puro

**Files:**
- Create: `src/features/routines/routine-types.ts`, `src/features/routines/routine-order.ts`
- Test: `src/features/routines/routine-order.test.ts`

**Produces:**
- `type Routine`, `type RoutineExercise`
- `moveExercise(items, from, to): RoutineExercise[]` — devuelve una lista nueva con las posiciones renumeradas de 0 en adelante

- [ ] **Step 1: Escribir las pruebas que fallan**

Cubrir: mover hacia abajo, mover hacia arriba, mover al principio, mover al final, mover a la misma posición (sin cambios), índices fuera de rango (sin cambios), que las posiciones queden siempre `0..n-1` sin huecos, y que no mute la lista recibida.

- [ ] **Step 2: Implementar**

Renumerar la lista entera tras mover. Es O(n) sobre diez elementos; cualquier cosa más lista cuesta más de lo que ahorra.

- [ ] **Step 3: Commit**

---

### Task 3: Repositorio de rutinas

**Files:**
- Create: `src/features/routines/routine-repository.ts`
- Test: `src/features/routines/routine-repository.test.ts`

**Produces:**
- `fetchRoutines(): Promise<Routine[]>`
- `fetchRoutine(id): Promise<{ routine: Routine; exercises: RoutineExercise[] } | null>`
- `createRoutine(ownerId, name): Promise<Routine>`
- `renameRoutine(id, name): Promise<{ error: string | null }>`
- `deleteRoutine(id): Promise<{ error: string | null }>`
- `saveExercises(routineId, exercises): Promise<{ error: string | null }>`

Requisitos:

- Convierte snake_case a camelCase, como `exercise-repository`.
- No propaga el mensaje del servidor, que puede llevar detalles del esquema.
- `saveExercises` reemplaza la lista entera en una transacción lógica: borra las filas que ya no están, inserta las nuevas y actualiza las posiciones. La restricción única de posición es `deferrable initially deferred` justamente para que un reordenamiento no choque a mitad de camino.
- Las pruebas simulan `../../lib/supabase`; el módulo real revienta al cargar sin variables de entorno y `pnpm test` tiene que pasar en un clon limpio.

---

### Task 4: Pantalla de rutinas

**Files:**
- Create: `src/features/routines/RoutineList.tsx`, `src/features/routines/RoutineEditor.tsx`, `src/features/routines/RoutinesPage.tsx`
- Test: `src/features/routines/RoutinesPage.test.tsx`
- Modify: `src/app/routes.tsx`

Requisitos:

- La ruta `/rutinas` deja de ser marcador de posición. El enlace a `/ejercicios` se conserva.
- Lista de rutinas con su número de ejercicios. Vacía: invita a crear la primera.
- Crear pide solo el nombre; los ejercicios se añaden después.
- El editor añade ejercicios con el `ExercisePicker` que ya existe, los reordena con botones de subir y bajar —no arrastrar, que en móvil es frágil y difícil de probar—, fija series y repeticiones objetivo, y quita ejercicios.
- Borrar una rutina pide confirmación con un segundo toque en el mismo botón, como Terminar entreno.
- Todo error en `role="alert"` y `text-danger`.
- Verificar en tema claro y oscuro.

---

### Task 5: Ejecutar una rutina

**Files:**
- Modify: `src/features/workouts/WorkoutPage.tsx`, `src/features/workouts/workout-local.ts`
- Test: ampliar `WorkoutPage.test.tsx` y `workout-local.test.ts`

Requisitos:

- `startWorkout` acepta un `routineId` opcional y lo guarda en el entreno local y en la cola.
- Desde una rutina, un botón **Entrenar esta rutina** lleva a la pantalla Entrenar con la rutina cargada.
- La pantalla Entrenar, con rutina, muestra la lista de ejercicios de la rutina y cuáles ya tienen series registradas hoy, en vez del buscador. Se puede añadir un ejercicio fuera de la rutina.
- Sin rutina, el comportamiento es exactamente el del Plan 3.
- Los objetivos de la rutina se muestran junto a lo que se levantó la última vez, sin sustituirlo: el objetivo dice qué toca hacer, el historial dice de dónde vienes.

---

## Al terminar este plan

Se pueden guardar rutinas, editarlas, reordenarlas y ejecutarlas. El entreno queda ligado a la rutina que lo originó, y borrar la rutina no borra el historial.

Siguiente plan: **Plan 5 — Amigos y compartir**, que añade `share_token`, la función `security definer` para leer una rutina por token sin exponer nada más, y copiar una rutina ajena con `forked_from`.
