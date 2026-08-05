create table public.exercises (
  id text primary key,
  name text not null,
  category text,
  equipment text,
  force text,
  level text,
  mechanic text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions text[] not null default '{}',
  image_paths text[] not null default '{}',
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Los ejercicios del catálogo tienen owner_id nulo y los ve todo el mundo.
-- Un ejercicio propio solo lo ve y edita su dueño.
create index exercises_owner_id_idx on public.exercises (owner_id);
create index exercises_name_idx on public.exercises (lower(name));

alter table public.exercises enable row level security;

create policy exercises_select_global_or_own
  on public.exercises for select
  using (owner_id is null or auth.uid() = owner_id);

create policy exercises_insert_own
  on public.exercises for insert
  with check (auth.uid() = owner_id and owner_id is not null);

create policy exercises_update_own
  on public.exercises for update
  using (auth.uid() = owner_id and owner_id is not null)
  with check (auth.uid() = owner_id and owner_id is not null);

create policy exercises_delete_own
  on public.exercises for delete
  using (auth.uid() = owner_id and owner_id is not null);

-- Los grants son la primera capa: sin ellos las políticas no conceden nada,
-- porque esta versión de Supabase ya no expone tablas nuevas automáticamente.
grant select on public.exercises to anon;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.exercises to service_role;

-- Bucket público: las imágenes del catálogo no son secretas y se sirven por CDN.
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;
