-- Reemplaza de una vez la lista de ejercicios de una rutina.
--
-- Por qué hace falta una función y no basta con varios update desde el
-- cliente: PostgREST ejecuta cada petición en su propia transacción, así que
-- el `deferrable initially deferred` de la restricción única de posición no
-- sirve de nada entre peticiones. Reordenar dos ejercicios chocaría contra el
-- índice único a mitad de camino. Dentro de esta función todo ocurre en una
-- sola transacción y la comprobación se difiere al final, que es justo para
-- lo que existe.
--
-- Es `security invoker` a propósito, no definer: así las políticas RLS de
-- routine_exercises y routines se evalúan con el usuario que llama, y no hace
-- falta reimplementar la comprobación de propiedad aquí dentro. Un usuario
-- que intente tocar una rutina ajena no verá ninguna fila que borrar y sus
-- inserciones serán rechazadas por la política.
create function public.save_routine_exercises(
  p_routine_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owns boolean;
begin
  -- Se comprueba explícitamente en vez de confiar en que el delete no borre
  -- nada: sin esto, llamar con una rutina ajena no haría daño pero tampoco
  -- diría nada, y el cliente creería que guardó.
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and r.owner_id = auth.uid()
  ) into owns;

  if not owns then
    raise exception 'La rutina no existe o no es tuya' using errcode = '42501';
  end if;

  delete from public.routine_exercises
  where routine_id = p_routine_id
    and id not in (
      select (item ->> 'id')::uuid
      from jsonb_array_elements(p_items) as item
    );

  insert into public.routine_exercises (
    id, routine_id, exercise_id, position, target_sets, target_reps, target_weight, notes
  )
  select
    (item ->> 'id')::uuid,
    p_routine_id,
    item ->> 'exercise_id',
    (item ->> 'position')::integer,
    nullif(item ->> 'target_sets', '')::integer,
    nullif(item ->> 'target_reps', '')::integer,
    nullif(item ->> 'target_weight', '')::numeric,
    nullif(item ->> 'notes', '')
  from jsonb_array_elements(p_items) as item
  on conflict (id) do update set
    exercise_id = excluded.exercise_id,
    position = excluded.position,
    target_sets = excluded.target_sets,
    target_reps = excluded.target_reps,
    target_weight = excluded.target_weight,
    notes = excluded.notes;

  update public.routines
  set updated_at = now()
  where id = p_routine_id;
end;
$$;

revoke execute on function public.save_routine_exercises(uuid, jsonb) from public;
revoke execute on function public.save_routine_exercises(uuid, jsonb) from anon;
grant execute on function public.save_routine_exercises(uuid, jsonb) to authenticated;
grant execute on function public.save_routine_exercises(uuid, jsonb) to service_role;
