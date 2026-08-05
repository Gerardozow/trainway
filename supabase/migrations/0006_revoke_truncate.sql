-- TRUNCATE ignora las políticas RLS por completo: no queda fila que filtrar
-- cuando se vacía la tabla entera. Supabase instala ALTER DEFAULT PRIVILEGES
-- que conceden TRUNCATE, REFERENCES y TRIGGER a anon y authenticated sobre
-- todo lo que se cree en el esquema public, así que cada tabla nueva nace con
-- esos permisos aunque su propia migración solo conceda select.
--
-- Hoy no es alcanzable: PostgREST no expone ningún verbo que se traduzca a
-- TRUNCATE, y anon y authenticated solo existen a través de PostgREST. Pero
-- todo el modelo de seguridad de Trainway descansa en RLS, y estos tres
-- permisos la puentean o la rodean:
--   TRUNCATE   vacía la tabla sin evaluar ninguna política
--   REFERENCES permite crear llaves foráneas contra ella, que filtran la
--              existencia de filas por el error de violación
--   TRIGGER    permite colgarle un trigger, que corre con permisos del dueño
--
-- Ninguno de los tres hace falta para nada que la aplicación haga.

revoke truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Y que las tablas futuras tampoco los hereden. Sin esto, la próxima migración
-- que cree una tabla vuelve a abrir el hueco en silencio.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon;

alter default privileges in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- El rol postgres es el dueño y supabase_admin administra: no se tocan.
-- service_role los conserva porque es el rol de los scripts de servidor, que
-- sí necesitan poder recrear el catálogo.
