create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (
    username is null or username ~ '^[a-z0-9_]{3,20}$'
  )
);

alter table public.profiles enable row level security;

-- El username es público a propósito: es como los amigos se encuentran entre sí.
create policy profiles_select_all
  on public.profiles for select
  using (true);

create policy profiles_insert_own
  on public.profiles for insert
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Las políticas de RLS filtran filas, pero no otorgan por sí solas acceso a la
-- tabla: el rol también necesita el privilegio de Postgres correspondiente.
-- Las versiones nuevas de Supabase ya no exponen tablas nuevas a los roles de
-- la API automáticamente (auto_expose_new_tables), así que se otorgan aquí de
-- forma explícita, alineado con lo que también se necesitará en producción.
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Al crearse un usuario en auth.users nace su perfil. Sin esto la aplicación
-- tendría que crear el perfil desde el cliente, que es más frágil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
