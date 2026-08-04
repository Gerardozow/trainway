# Trainway

Registra tus entrenos de gimnasio y comparte rutinas con tus amigos. PWA instalable.

## Requisitos

- Node 24+
- pnpm 11+
- Docker en marcha (para Supabase local)

## Puesta en marcha

```bash
pnpm install
pnpm db:start
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
| `pnpm lint` | Revisa el código con oxlint |
| `pnpm test` | Pruebas unitarias (proyecto `unit`, jsdom); no necesita Docker |
| `pnpm test:watch` | Pruebas unitarias en modo watch |
| `pnpm test:rls` | Pruebas de aislamiento de la base (proyecto `rls`); requiere `pnpm db:start` primero |
| `pnpm db:start` | Levanta Supabase local (Docker) |
| `pnpm db:stop` | Detiene Supabase local |
| `pnpm db:reset` | Recrea la base local y aplica las migraciones |

## Acceso con Google

Diferido. `signInWithGoogle` vive en `auth-repository.ts` y sus pruebas, pero
`LoginPage` no lo usa: `supabase/config.toml` no tiene `[auth.external.google]`
configurado, así que el botón llevaría directo a un error de "Unsupported
provider". Se reintroduce en la interfaz cuando existan credenciales de OAuth
de Google Cloud.

## Seguridad

`SUPABASE_SERVICE_ROLE_KEY` no lleva prefijo `VITE_`, así que Vite nunca la
incluye en el paquete del navegador. Se usa solo en las pruebas de RLS. Si
alguna vez aparece con prefijo `VITE_`, es un defecto grave: rotar la clave.
