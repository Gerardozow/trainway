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
pnpm seed:exercises   # tarda varios minutos la primera vez
pnpm dev
```

Los correos de acceso no salen a internet en local: se leen en el buzón de
pruebas en <http://127.0.0.1:54324>.

## Catálogo de ejercicios

`pnpm seed:exercises` puebla la tabla `exercises` con 873 ejercicios y sube sus
1746 imágenes a Supabase Storage. La primera vez tarda varios minutos; después
es idempotente y solo reintenta lo que falte, así que se puede volver a correr
sin miedo.

El catálogo viene de **Free Exercise DB**
(<https://github.com/yuhonas/free-exercise-db>), de dominio público bajo la
Unlicense. La licencia no exige atribución; se pone igual.

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
| `pnpm seed:exercises` | Puebla el catálogo de ejercicios y sube sus imágenes |

## Si las pruebas fallan con `AuthRetryableFetchError`

Tras `pnpm db:reset` los contenedores cambian de IP y Kong, la puerta de
entrada, se queda con las viejas cacheadas. Las pruebas que hablan con GoTrue
fallan entonces con un error de red que no tiene nada que ver con el código:

```bash
docker restart supabase_kong_trainway
```

Esperar unos segundos y volver a correrlas.

## Despliegue de la Edge Function

`sign-in` es la única función Edge del proyecto: recibe identificador
(correo o username) más contraseña y devuelve una sesión. Desplegarla:

```bash
pnpm supabase functions deploy sign-in
```

Antes del primer despliegue real hay que fijar el secreto `ALLOWED_ORIGINS`
(lista de orígenes separados por coma, sin protocolo de más ni espacios) a
los orígenes reales de la PWA:

```bash
pnpm supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.com,https://otro-dominio.com
```

Sin esto, la función cae al valor por defecto de desarrollo
(`http://localhost:5173,http://127.0.0.1:5173`) y sirve
`Access-Control-Allow-Origin` apuntando a `localhost` para cualquier origen
real: el navegador descarta la respuesta por CORS y quien intenta entrar ve
"No se pudo conectar. Revisa tu conexión.", sin ninguna pista de que el
problema es de configuración. La función lo grita en sus propios logs al
arrancar (`console.error`) si detecta que sigue en el valor por defecto —
revisar `pnpm supabase functions logs sign-in` tras desplegar si el login
falla en producción.

`pnpm test:edge` habla con la función real por HTTP, no con un mock: antes
de correrlo hace falta el stack local levantado y la función servida en otra
terminal:

```bash
pnpm db:start
pnpm supabase functions serve sign-in --no-verify-jwt
```

## Confirmación de correo (SMTP)

`supabase/config.toml` tiene `enable_confirmations = true`: ninguna cuenta
puede iniciar sesión sin confirmar su correo primero. En local, los correos
se leen en el buzón de pruebas (`http://127.0.0.1:54324`) sin salir a
internet, pero `[auth.email.smtp]` está comentado por completo —
**antes de cualquier despliegue real hay que configurarlo** (host, puerto y
credenciales de un proveedor real de correo).

Sin SMTP configurado, GoTrue no puede entregar el correo de confirmación a
nadie: cada cuenta nueva queda permanentemente sin confirmar, y el inicio de
sesión de una cuenta sin confirmar devuelve, correctamente (por la propiedad
de que un fallo de credenciales nunca distingue la causa), el mismo
"Credenciales inválidas" que una contraseña mala — sin reenvío de correo y
sin forma de recuperarla. Es la forma más cercana a un abandono permanente
que tiene la rama, y nace de un valor por defecto de configuración, no de un
error de quien se registra.

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
