-- Trainway — esquema base
-- Las políticas RLS van en 0002_rls.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  units         text not null default 'metric' check (units in ('metric', 'imperial')),
  locale        text not null default 'es',
  theme         text not null default 'system' check (theme in ('light', 'dark', 'system')),
  created_at    timestamptz not null default now()
);

-- Crea el perfil junto con el usuario: la app nunca ve un usuario sin fila aquí.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Respuestas del wizard
-- ---------------------------------------------------------------------------
create table public.intakes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  goal            text not null check (goal in ('fuerza', 'hipertrofia', 'perdida_grasa', 'resistencia', 'general')),
  days_per_week   int  not null check (days_per_week between 2 and 7),
  session_minutes int  not null check (session_minutes between 20 and 150),
  experience      text not null check (experience in ('principiante', 'intermedio', 'avanzado')),
  equipment       text[] not null default '{}',
  focus_muscles   text[] not null default '{}',
  include_cardio  boolean not null default false,
  limitations     text,
  free_notes      text,
  created_at      timestamptz not null default now()
);

create index intakes_user_idx on public.intakes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Mesociclo de 4 semanas
-- ---------------------------------------------------------------------------
create table public.programs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  intake_id     uuid references public.intakes(id) on delete set null,
  name          text not null,
  block_number  int  not null default 1,
  weeks         int  not null default 4,
  starts_on     date not null,
  status        text not null default 'active' check (status in ('active', 'completed', 'archived')),
  ai_model      text,
  ai_rationale  text,
  created_at    timestamptz not null default now()
);

create index programs_user_idx on public.programs (user_id, created_at desc);
-- Un solo bloque activo por usuario: evita dos planes compitiendo por el mismo día.
create unique index programs_one_active_per_user
  on public.programs (user_id) where status = 'active';

create table public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  week        int  not null check (week between 1 and 12),
  day_index   int  not null check (day_index between 1 and 7),
  title       text not null,
  focus       text[] not null default '{}',
  is_deload   boolean not null default false,
  unique (program_id, week, day_index)
);

create index program_days_program_idx on public.program_days (program_id, week);

create table public.program_exercises (
  id                      uuid primary key default gen_random_uuid(),
  program_day_id          uuid not null references public.program_days(id) on delete cascade,
  exercise_id             text not null,
  category                text not null,
  position                int  not null,
  target_sets             int  not null check (target_sets between 1 and 10),
  target_reps             text,
  target_weight           numeric(6,2),
  target_duration_seconds int,
  target_rpe              int check (target_rpe between 1 and 10),
  rest_seconds            int  not null default 90,
  progression_scheme      jsonb not null,
  coach_note              text,
  unique (program_day_id, position)
);

create index program_exercises_day_idx on public.program_exercises (program_day_id, position);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- Lo que realmente pasó
-- ---------------------------------------------------------------------------
create table public.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  program_day_id  uuid not null references public.program_days(id) on delete cascade,
  performed_on    date not null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  session_rpe     int check (session_rpe between 1 and 10),
  notes           text,
  unique (user_id, program_day_id, performed_on)
);

create index workout_sessions_user_date_idx on public.workout_sessions (user_id, performed_on desc);

create table public.set_logs (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.workout_sessions(id) on delete cascade,
  program_exercise_id uuid not null references public.program_exercises(id) on delete cascade,
  set_index           int  not null,
  done                boolean not null default false,
  -- fuerza
  weight              numeric(6,2),
  reps                int,
  -- cardio
  duration_seconds    int,
  distance_m          numeric(8,2),
  intensity           text,
  --
  rpe                 int check (rpe between 1 and 10),
  note                text,
  -- Clave de idempotencia: la genera el celular antes de tocar la red, así un
  -- reintento tras un corte de señal no duplica el registro.
  client_id           text not null unique,
  logged_at           timestamptz not null default now()
);

create index set_logs_session_idx on public.set_logs (session_id);
create index set_logs_exercise_idx on public.set_logs (program_exercise_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Caché de traducciones, compartida entre todos los usuarios
-- ---------------------------------------------------------------------------
create table public.exercise_translations (
  exercise_id   text not null,
  locale        text not null default 'es',
  name          text not null,
  instructions  text[] not null default '{}',
  created_at    timestamptz not null default now(),
  primary key (exercise_id, locale)
);
