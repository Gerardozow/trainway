# Trainway

Registra tus entrenos de gimnasio y comparte rutinas con tus amigos. PWA instalable.

## Requisitos

- Node 24+
- pnpm 11+
- Docker en marcha (para Supabase local)

## Puesta en marcha

```bash
pnpm install
pnpm supabase start
pnpm supabase status   # copia las claves al paso siguiente
cp .env.example .env.local
# llenar VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
pnpm db:reset
pnpm dev
```

Los correos de acceso no salen a internet en local: se leen en el buzón de
pruebas en <http://127.0.0.1:54324>.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Compilación de producción |
| `pnpm test` | Toda la suite |
| `pnpm test:rls` | Solo las pruebas de aislamiento de la base |
| `pnpm db:reset` | Recrea la base local y aplica las migraciones |

## Acceso con Google

Funciona en producción una vez configurado el proveedor Google en el panel de
Supabase (Authentication → Providers → Google) con las credenciales de OAuth de
Google Cloud. En local el botón existe pero no completa el flujo.

## Seguridad

`SUPABASE_SERVICE_ROLE_KEY` no lleva prefijo `VITE_`, así que Vite nunca la
incluye en el paquete del navegador. Se usa solo en las pruebas de RLS. Si
alguna vez aparece con prefijo `VITE_`, es un defecto grave: rotar la clave.
