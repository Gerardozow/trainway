-- Traduce un username a su correo. Es deliberadamente inalcanzable desde el
-- navegador: solo la Edge Function, que corre con la clave de servicio, puede
-- ejecutarla. Si anon pudiera llamarla, cualquiera cosecharía los correos de
-- todos los usuarios recorriendo la lista pública de usernames.
create function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = p_username;
$$;

revoke execute on function public.email_for_username(text) from public;
revoke execute on function public.email_for_username(text) from anon;
revoke execute on function public.email_for_username(text) from authenticated;
grant execute on function public.email_for_username(text) to service_role;

-- Esta sí es pública: solo dice si un username está libre, y los usernames ya
-- son legibles por cualquiera vía profiles. No revela nada nuevo.
create function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profiles where username = p_username
  );
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon;
grant execute on function public.username_available(text) to authenticated;
grant execute on function public.username_available(text) to service_role;
