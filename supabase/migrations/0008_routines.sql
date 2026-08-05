create table public.routines (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_name_length check (char_length(name) between 1 and 80)
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
  -- Es `deferrable initially deferred` porque reordenar reescribe varias
  -- posiciones: sin diferir la comprobación, el orden intermedio de la
  -- transacción chocaría contra la restricción a mitad de camino.
  constraint unique_position_per_routine unique (routine_id, position)
    deferrable initially deferred
);

create index routine_exercises_routine_idx
  on public.routine_exercises (routine_id, position);

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;

-- Por ahora una rutina es estrictamente privada. Compartir es el Plan 5.
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

-- Los ejercicios de una rutina heredan su dueño: no tienen owner_id propio,
-- así que la política pregunta por el dueño de la rutina a la que pertenecen.
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

-- Ahora que routines existe se conecta la columna que workouts ya tenía.
-- `on delete set null` y no cascade: borrar una rutina no debe borrar el
-- historial de los entrenos que se hicieron con ella. Ese historial es del
-- usuario y la rutina solo dice de dónde salió.
alter table public.workouts
  add constraint workouts_routine_id_fkey
  foreign key (routine_id) references public.routines (id) on delete set null;
