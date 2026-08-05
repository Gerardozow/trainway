-- Trainway — políticas de aislamiento por usuario.
--
-- El navegador habla directo con Postgres usando la anon key, así que estas
-- políticas SON la seguridad del sistema. Si una falla, un usuario lee los
-- datos de otro. Hay un test de integración que lo verifica (tests/rls.test.ts).

alter table public.profiles              enable row level security;
alter table public.intakes               enable row level security;
alter table public.programs              enable row level security;
alter table public.program_days          enable row level security;
alter table public.program_exercises     enable row level security;
alter table public.workout_sessions      enable row level security;
alter table public.set_logs              enable row level security;
alter table public.exercise_translations enable row level security;

-- --- Tablas con user_id propio ---------------------------------------------

create policy "perfil propio" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "intakes propios" on public.intakes
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "programas propios" on public.programs
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "sesiones propias" on public.workout_sessions
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- --- Tablas sin user_id: se resuelve por la tabla padre ---------------------

create policy "dias del programa propio" on public.program_days
  for all
  using (exists (
    select 1 from public.programs p
    where p.id = program_days.program_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.programs p
    where p.id = program_days.program_id and p.user_id = (select auth.uid())
  ));

create policy "ejercicios del programa propio" on public.program_exercises
  for all
  using (exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_exercises.program_day_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_exercises.program_day_id and p.user_id = (select auth.uid())
  ));

create policy "series de sesiones propias" on public.set_logs
  for all
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = set_logs.session_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_sessions s
    where s.id = set_logs.session_id and s.user_id = (select auth.uid())
  ));

-- --- Traducciones: lectura pública, escritura solo del Worker ---------------
-- Sin política de escritura, solo la service role key (que vive como secret del
-- Worker) puede insertar. Un ejercicio se traduce una vez para todo el proyecto.

create policy "traducciones legibles por todos" on public.exercise_translations
  for select using (true);
