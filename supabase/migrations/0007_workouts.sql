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
-- Para "¿qué levanté la última vez en este ejercicio?", que se consulta al
-- abrir cada ejercicio en la pantalla de registro.
create index workout_sets_exercise_completed_idx
  on public.workout_sets (exercise_id, completed_at desc);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;

-- Los entrenos son estrictamente privados. No hay lectura pública ni entre
-- amigos: compartir rutinas no es compartir el historial.
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

-- Las series heredan la privacidad de su entreno: no tienen user_id propio,
-- así que la política pregunta por el dueño del entreno al que pertenecen.
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

-- Sin política ni grant de UPDATE para las series, a propósito: una serie mal
-- capturada se corrige borrándola y volviéndola a registrar. Eso elimina la
-- clase entera de conflictos de escritura concurrente entre dispositivos, sin
-- ninguna maquinaria de resolución.

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, delete on public.workout_sets to authenticated;
grant all on public.workouts to service_role;
grant all on public.workout_sets to service_role;
-- anon no recibe nada: un visitante sin sesión no tiene entrenos que ver.
