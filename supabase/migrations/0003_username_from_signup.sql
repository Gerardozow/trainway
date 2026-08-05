-- El cliente no puede escribir el username al registrarse: sin confirmar el
-- correo no hay sesión, y anon no tiene UPDATE sobre profiles. Así que lo
-- escribe el trigger, que corre como dueño. Si el nombre ya está tomado, el
-- perfil nace sin username en vez de abortar el alta: perder una cuenta por
-- una colisión de nombre sería mucho peor que pedir el nombre otra vez.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired text := new.raw_user_meta_data ->> 'username';
  display text := new.raw_user_meta_data ->> 'full_name';
  avatar text := new.raw_user_meta_data ->> 'avatar_url';
begin
  if desired is null or desired !~ '^[a-z0-9_]{3,20}$' then
    desired := null;
  end if;

  begin
    insert into public.profiles (id, username, display_name, avatar_url)
    values (new.id, desired, display, avatar);
  exception when unique_violation then
    -- Otro registro se quedó con ese nombre entre la comprobación y ahora.
    insert into public.profiles (id, username, display_name, avatar_url)
    values (new.id, null, display, avatar);
  end;

  return new;
end;
$$;
