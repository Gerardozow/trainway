-- email_for_username (0002) hace lower(p_username) para no depender de que
-- quien llama ya normalizó el caso. username_available quedó sin el mismo
-- lower() por descuido: un mismo username tomado reportaba "disponible"
-- (true) para una variante en mayúsculas y "tomado" (false) en minúsculas --
-- divergente y verificado en vivo contra el stack local. SignupPage manda el
-- username ya en minúsculas hoy, pero el RPC es público (anon, authenticated)
-- y cualquier otro llamador -- o una futura pantalla que no garantice el
-- caso -- vuelve a pisar la misma divergencia. create or replace conserva
-- los GRANT/REVOKE ya aplicados por 0002; no hace falta repetirlos.
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profiles where username = lower(p_username)
  );
$$;
