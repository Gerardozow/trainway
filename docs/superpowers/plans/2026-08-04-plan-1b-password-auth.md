# Trainway — Plan 1b: Acceso con contraseña e identificador dual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el usuario se registre con correo, contraseña y username, y que entre escribiendo **correo o username** más su contraseña. El magic link se conserva como segunda opción visible en la pantalla de acceso.

**Architecture:** El correo de un usuario no es público y no debe serlo — exponerlo permitiría cosechar las direcciones de todos. Por eso la traducción de username a correo ocurre en el servidor: una Edge Function de Supabase recibe identificador y contraseña, resuelve el username mediante una función SQL que solo ella puede ejecutar, pide la sesión a GoTrue y la devuelve. El navegador nunca ve un correo ajeno ni la clave de servicio.

**Tech Stack:** Supabase Edge Functions (Deno), Postgres con funciones `security definer`, `@supabase/supabase-js` en cliente y función, React + TypeScript, Vitest.

## Contexto: qué existe ya

Este plan continúa el Plan 1 (Fundación). Al empezar, el repositorio ya tiene:

- Proyecto Vite + React 19 + TypeScript + Tailwind 4, tema claro/oscuro por tokens `--color-*`.
- Supabase local sobre Docker, tabla `public.profiles` (`id`, `username`, `display_name`, `avatar_url`, `created_at`, `updated_at`) con RLS: lectura pública, escritura solo del dueño. `username` tiene restricción única y un CHECK `^[a-z0-9_]{3,20}$`. Un trigger crea la fila del perfil al nacer el usuario en `auth.users`, con `username` nulo.
- Autenticación por magic link: `src/lib/supabase.ts` (cliente con `flowType: 'pkce'`), `src/features/auth/auth-repository.ts` (`signInWithEmail`, `signInWithGoogle`, `signOut`), `AuthProvider`, `useAuth`, `RequireAuth`, `LoginPage`.
- `src/features/profile/profile-repository.ts` con `validateUsername`, `fetchProfile`, `setUsername`, y `UsernameOnboarding.tsx` que pide el username a quien no lo tiene.
- Vitest dividido en dos proyectos: `unit` (jsdom, `pnpm test`, sin Docker) y `rls` (node, `pnpm test:rls`, requiere el stack levantado).

## Global Constraints

- Gestor de paquetes: **pnpm**. `npm`, `npx` y `yarn` están bloqueados; el equivalente de `npx foo` es `pnpm exec foo`.
- **Ningún secreto en el cliente.** Bajo `src/` solo pueden aparecer `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` jamás se referencia desde `src/`, y `tsconfig.app.json` omite los tipos de node justamente para que `process` no compile ahí. Ese guardia no se debilita.
- **La respuesta ante credenciales incorrectas es siempre idéntica.** Da igual que el username no exista, que el correo no exista o que la contraseña esté mal: mismo mensaje, mismo código de estado, y tiempos de respuesta comparables. Cualquier diferencia convierte la pantalla de acceso en un buscador de cuentas.
- **El correo de un usuario nunca sale hacia el navegador**, ni siquiera el propio en respuestas de error.
- Tema claro y oscuro son ciudadanos de primera clase. Todo color viene de un token `--color-*` vía clase de Tailwind. Cada pantalla nueva se verifica en ambos temas.
- Nombre del producto en interfaz y metadatos: **Trainway**.
- Interfaz en español; identificadores en inglés.
- Toda tabla nueva lleva RLS desde la migración que la crea.
- TDD: la prueba que falla se escribe y se ejecuta antes de la implementación.

---

## Estructura de archivos

```
supabase/
  migrations/
    0002_username_lookup.sql      # email_for_username (bloqueada), username_available (pública)
  functions/
    sign-in/
      index.ts                    # Edge Function: identificador + contraseña -> sesión
  config.toml                     # longitud mínima de contraseña
src/
  features/
    auth/
      auth-repository.ts          # + signInWithIdentifier, signUp
      LoginPage.tsx               # rediseño: contraseña principal, magic link secundario
      SignupPage.tsx              # alta: correo, contraseña, username
    profile/
      profile-repository.ts       # + isUsernameAvailable
tests/
  edge/
    sign-in.test.ts               # pruebas de la Edge Function contra el stack local
  rls/
    username-lookup.test.ts       # que email_for_username no sea alcanzable por anon/authenticated
```

---

### Task 1: Funciones SQL de búsqueda de username

**Files:**
- Create: `supabase/migrations/0002_username_lookup.sql`
- Create: `tests/rls/username-lookup.test.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: tabla `public.profiles` y su columna `username` del Plan 1.
- Produces:
  - `public.email_for_username(p_username text) returns text` — `security definer`, ejecutable **solo** por `service_role`.
  - `public.username_available(p_username text) returns boolean` — ejecutable por `anon` y `authenticated`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0002_username_lookup.sql`:

```sql
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
  where p.username = lower(p_username);
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
```

- [ ] **Step 2: Subir la longitud mínima de contraseña**

En `supabase/config.toml`, dentro de la sección `[auth]`, fijar:

```toml
minimum_password_length = 8
```

Si la clave ya existe con otro valor, cambiarla. Si no existe, añadirla dentro de `[auth]`, no en otra sección.

- [ ] **Step 3: Aplicar la migración**

```bash
pnpm db:reset
```
Esperado: aplica `0001_profiles.sql` y `0002_username_lookup.sql` sin errores.

- [ ] **Step 4: Escribir las pruebas que fallan**

Crear `tests/rls/username-lookup.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, anonClient, createTestUser } from './client'

describe('funciones de búsqueda de username', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let email: string
  let username: string

  beforeAll(async () => {
    const stamp = Date.now().toString().slice(-6)
    email = `lookup-${stamp}@trainway.test`
    username = `lookup_${stamp}`
    alice = await createTestUser(email)
    const { error } = await alice.client
      .from('profiles')
      .update({ username })
      .eq('id', alice.id)
    if (error) throw error
  }, 30_000)

  it('devuelve el correo a quien usa la clave de servicio', async () => {
    const { data, error } = await adminClient().rpc('email_for_username', {
      p_username: username,
    })

    expect(error).toBeNull()
    expect(data).toBe(email)
  })

  it('devuelve null para un username que no existe', async () => {
    const { data, error } = await adminClient().rpc('email_for_username', {
      p_username: 'no_existe_jamas',
    })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('niega la búsqueda de correo a un visitante sin sesión', async () => {
    const { error } = await anonClient().rpc('email_for_username', {
      p_username: username,
    })

    expect(error).not.toBeNull()
  })

  it('niega la búsqueda de correo a un usuario con sesión', async () => {
    const { error } = await alice.client.rpc('email_for_username', {
      p_username: username,
    })

    expect(error).not.toBeNull()
  })

  it('reporta un username tomado como no disponible', async () => {
    const { data, error } = await anonClient().rpc('username_available', {
      p_username: username,
    })

    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('reporta un username libre como disponible', async () => {
    const { data, error } = await anonClient().rpc('username_available', {
      p_username: 'libre_seguro_123',
    })

    expect(error).toBeNull()
    expect(data).toBe(true)
  })
})
```

- [ ] **Step 5: Ejecutar las pruebas**

```bash
pnpm test:rls
```
Esperado: PASAN las 6 nuevas más las 7 existentes de `profiles`. Total 13.

- [ ] **Step 6: Verificar que las pruebas de denegación no pasan por accidente**

Es el punto entero de esta tarea: si `email_for_username` quedara alcanzable, la pantalla de acceso se convierte en un cosechador de correos. Comprobarlo mutando la migración — añadir temporalmente al final:

```sql
grant execute on function public.email_for_username(text) to anon;
```

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: FALLAN las dos pruebas de denegación (`niega la búsqueda de correo a un visitante sin sesión` y, si el grant a `authenticated` también se añadió, la del usuario con sesión). Quitar el grant temporal y repetir:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: PASAN las 13.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0002_username_lookup.sql supabase/config.toml tests/rls/username-lookup.test.ts
git commit -m "feat: add locked-down username to email lookup and availability check"
```

---

### Task 2: Edge Function de acceso con identificador dual

**Files:**
- Create: `supabase/functions/sign-in/index.ts`, `supabase/functions/deno.json`
- Create: `tests/edge/sign-in.test.ts`
- Modify: `vite.config.ts` (tercer proyecto de Vitest, y excluir `tests/edge` del proyecto `unit`), `package.json` (script `test:edge`), `tsconfig.test.json` (incluir `tests/edge`), `tsconfig.app.json` (excluir `tests/edge`, por la misma razón que ya excluye `tests/rls`), `supabase/config.toml` (`[functions.sign-in]`)

**Interfaces:**
- Consumes: `public.email_for_username` de la Task 1.
- Produces: endpoint `POST /functions/v1/sign-in` que recibe `{ identifier: string, password: string }` y devuelve `{ session }` en éxito o `{ error: 'Credenciales inválidas' }` con estado 400 en cualquier fallo de credenciales.

> **Nota de una revisión posterior:** la primera versión de este paso usaba un
> correo señuelo (`DECOY_EMAIL`) para que la rama "username desconocido"
> también llamara a `signInWithPassword` y así, en teoría, pagara el mismo
> costo que la rama "contraseña incorrecta de una cuenta real". Medido en la
> práctica, no funcionó: GoTrue responde "no existe" en cuanto el correo no
> está en `auth.users`, sin tocar bcrypt — así que la ruta del señuelo
> siempre iba a ser más rápida (~14ms medidos) que la de una cuenta real con
> contraseña mala (~75ms, el costo real de bcrypt). El señuelo igualaba dos
> cosas que nunca estuvieron en duda y no hacía nada por la única que
> importaba. La versión de abajo ya incluye la corrección: un piso de tiempo
> fijo en la función misma, versión fijada de la dependencia (con
> `deno.lock`) y manejo de errores que no escapa como 500.
>
> Una segunda ronda de revisión encontró y descartó otro intento de arreglo:
> una primera corrección de esta nota reenviaba `x-forwarded-for` a GoTrue
> para que su límite de intentos por IP volviera a separar quién llama. Se
> revirtió — ese encabezado lo pone quien hace la petición, no una capa de
> confianza, y reenviarlo tal cual le da a un atacante que rote el valor un
> presupuesto por IP ilimitado, peor que el problema que buscaba resolver.
> El límite de intentos por IP sigue roto (ver "Al terminar este plan"); la
> versión de abajo ya no pretende arreglarlo desde la función.

- [ ] **Step 1: Escribir la Edge Function**

Crear `supabase/functions/deno.json` — fija la versión exacta de la dependencia; sin esto, `jsr:@supabase/supabase-js@2` resuelve a lo que sea más nuevo en el momento de cada `serve` o `deploy`, y esta función es el único proceso que sostiene la clave de servicio:

```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2.112.0"
  }
}
```

Crear `supabase/functions/sign-in/index.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Un único mensaje para todos los fallos de credenciales. Distinguir entre
// "ese username no existe" y "la contraseña está mal" convierte esta función
// en un buscador de cuentas.
const INVALID = 'Credenciales inválidas'

// Mensaje aparte, y deliberadamente distinto, para cuando el problema es
// nuestro y no de quien intenta entrar: así un incidente de infraestructura
// no se lee como "todos escribieron mal su contraseña", y quien revise los
// logs (ver console.error más abajo) puede diferenciar ambos casos. Solo se
// usa cuando la falla es igual sin importar qué identificador se pidió, así
// que usarlo no delata ninguna cuenta.
const UNAVAILABLE = 'Servicio no disponible, intenta de nuevo'

// Piso fijo de tiempo de respuesta, en milisegundos, para TODA respuesta de
// fallo. Un correo señuelo no alcanza: GoTrue responde "no existe" sin tocar
// bcrypt en cuanto el correo no está en auth.users, así que la ruta
// "username desconocido" siempre iba a ser más rápida que "contraseña
// incorrecta de una cuenta real" (bcrypt costo 10 + ida y vuelta midió unos
// 75ms en local) — sin importar qué correo se le pase a signInWithPassword.
// Un piso fijo, y no jitter aleatorio, es lo que cierra esa diferencia:
// el jitter se promedia con suficientes muestras, un piso no, porque cada
// respuesta tarda exactamente lo mismo desde afuera sin importar el trabajo
// real que hizo por debajo. 250 deja margen amplio sobre los ~75ms medidos.
const MIN_FAILURE_MS = 250

// Orígenes desde los que se acepta la llamada. Sin esto, cualquier página
// del navegador de cualquier visitante podría invocar esta función contra
// las IPs de sus visitantes — un harness distribuido gratuito para el
// oráculo de tiempo y para probar contraseñas robadas. En producción hay
// que fijar ALLOWED_ORIGINS (lista separada por comas) a los orígenes reales
// de la PWA; el valor por defecto solo cubre el servidor de desarrollo.
//
// `??` no basta: una variable definida pero vacía ('') no es undefined, así
// que `?? default` no cae al valor por defecto — el split de una cadena
// vacía da una lista vacía, y el encabezado terminaría siendo el string
// literal "undefined". Falla cerrado (nadie pasa la comparación), pero es
// una salida de CORS silenciosa y difícil de diagnosticar. Por eso se
// comprueba longitud en vez de solo nulidad.
const DEFAULT_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
const rawAllowedOrigins = Deno.env.get('ALLOWED_ORIGINS')
const ALLOWED_ORIGINS = (
  rawAllowedOrigins && rawAllowedOrigins.length > 0 ? rawAllowedOrigins : DEFAULT_ALLOWED_ORIGINS
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Un error de GoTrue con estado 5xx es una falla del servicio, no de la
// cuenta: ocurre igual sin importar el identificador que se haya pedido, así
// que reportarla aparte (503) no delata nada. Cualquier otro código (400
// contraseña mala, 429 límite de tasa, cuenta no confirmada, cuenta
// suspendida, etc.) sigue colapsando a INVALID: revelar cuál de esas razones
// aplica sí delataría que la cuenta existe.
function isServiceError(error: { status?: number }): boolean {
  return typeof error.status === 'number' && error.status >= 500
}

Deno.serve(async (request) => {
  const startedAt = performance.now()
  const cors = corsHeaders(request.headers.get('origin'))

  // Todo camino de fallo pasa por aquí — JSON malformado, tipos incorrectos,
  // identificador vacío, username desconocido, contraseña mala, error de
  // GoTrue — para que ninguno tome menos que MIN_FAILURE_MS desde afuera.
  async function failure(body: unknown, status: number): Promise<Response> {
    const elapsed = performance.now() - startedAt
    const remaining = MIN_FAILURE_MS - elapsed
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining))
    }
    return json(body, status, cors)
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405, cors)
  }

  try {
    let identifier: unknown
    let password: unknown
    try {
      const body = await request.json()
      identifier = body?.identifier
      password = body?.password
    } catch {
      return failure({ error: INVALID }, 400)
    }

    if (typeof identifier !== 'string' || typeof password !== 'string') {
      return failure({ error: INVALID }, 400)
    }
    if (identifier.length === 0 || password.length === 0) {
      return failure({ error: INVALID }, 400)
    }

    let email = identifier
    if (!identifier.includes('@')) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data, error } = await admin.rpc('email_for_username', {
        p_username: identifier.toLowerCase(),
      })
      if (error) {
        // Esto no es "el username no existe" — esa respuesta llega con
        // error nulo y data nula (ver la migración). Un error aquí es la
        // búsqueda misma fallando, igual sin importar qué username se haya
        // pedido.
        console.error('email_for_username failed', error)
        return failure({ error: UNAVAILABLE }, 503)
      }
      if (typeof data !== 'string' || data.length === 0) {
        return failure({ error: INVALID }, 400)
      }
      email = data
    }

    // Todo intento de acceso llega a GoTrue desde la IP de salida del
    // runtime de la función, así que su límite de 30 intentos por IP en 5
    // minutos (config.toml, auth.rate_limit.sign_in_sign_ups) no separa a
    // quienes llaman: una sola persona agotándolo bloquea a todos los demás.
    // Se consideró reenviar x-forwarded-for y se descartó: ese encabezado lo
    // pone quien llama, no una capa de confianza -- en un despliegue real la
    // plataforma añade la IP verdadera a la cadena en vez de reemplazarla, y
    // reenviar la cadena completa tal cual deja que quien ataca rote el
    // valor y consiga un presupuesto por IP ilimitado, peor que la bolsa
    // compartida que se buscaba arreglar. El cierre real de este hueco no es
    // código en esta función: es un captcha (auth.captcha, ya preparado en
    // config.toml) o un throttle contra algo que quien llama no pueda
    // falsificar.
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await anon.auth.signInWithPassword({ email, password })

    if (error) {
      if (isServiceError(error)) {
        console.error('signInWithPassword failed', error)
        return failure({ error: UNAVAILABLE }, 503)
      }
      return failure({ error: INVALID }, 400)
    }
    if (!data.session) {
      return failure({ error: INVALID }, 400)
    }

    // Éxito: no hay piso que pagar. Un atacante ya sabe que acertó — la
    // sesión que recibe se lo dice — así que no hay nada que igualar aquí.
    return json({ session: data.session }, 200, cors)
  } catch (err) {
    // Cualquier excepción no anticipada — por ejemplo, una variable de
    // entorno ausente que hace fallar createClient — no se distingue de un
    // fallo de credenciales de cara afuera. No hay forma de saber si
    // correspondía a un username o a un correo, así que el default seguro
    // es no distinguir; la causa real queda en los logs, no en la respuesta.
    console.error('sign-in unexpected error', err)
    return failure({ error: INVALID }, 400)
  }
})
```

En `supabase/config.toml`, añadir junto a `[edge_runtime]` (sign-in recibe
identificador + contraseña de quien todavía no tiene sesión — por definición
no puede llevar un JWT — y sin este bloque explícito, un despliegue real
usaría el valor por defecto `true` y divergiría de lo que prueba
`--no-verify-jwt` en local):

```toml
[functions.sign-in]
verify_jwt = false
```

- [ ] **Step 2: Levantar la función y comprobarla a mano**

```bash
pnpm supabase functions serve sign-in --no-verify-jwt
```

En otra terminal, con un usuario de prueba ya creado, comprobar que un identificador inválido responde igual que una contraseña inválida:

```bash
curl -s -i -X POST http://127.0.0.1:54321/functions/v1/sign-in \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"no_existe_jamas","password":"loquesea12"}'
```
Esperado: `HTTP/1.1 400` y cuerpo `{"error":"Credenciales inválidas"}`.

- [ ] **Step 3: Añadir el tercer proyecto de Vitest**

En `vite.config.ts`, dentro del arreglo `test.projects`, añadir junto a los proyectos `unit` y `rls` un tercero:

```typescript
{
  test: {
    name: 'edge',
    environment: 'node',
    include: ['tests/edge/**/*.test.ts'],
  },
},
```

El proyecto `unit` sí necesita un cambio: su `exclude` ya saca `tests/rls/**` pero no tiene ningún `include` propio, así que sin excluir también `tests/edge/**` recoge las pruebas nuevas y las corre bajo jsdom — donde fallan porque no hay clave de servicio. Eso rompe la garantía de que `pnpm test` pasa sin `.env.local`. Añadir la misma exclusión que ya existe para `tests/rls`:

```typescript
exclude: [...configDefaults.exclude, 'tests/rls/**', 'tests/edge/**'],
```

En `package.json`, dentro de `"scripts"`, añadir:

```json
"test:edge": "vitest run --project=edge"
```

Y en `tsconfig.test.json`, extender `include` para que también cubra las pruebas nuevas:

```json
"include": ["tests/rls", "tests/edge"]
```

`tsconfig.app.json` tiene el mismo problema que `vite.config.ts`: incluye `tests` completo y solo excluye `tests/rls`, y su `types` es `["vite/client"]` sin `"node"` — a propósito, es la barrera que impide que `process` compile bajo `src/`. Sin excluir también `tests/edge`, `pnpm build` falla ahí porque `process.env` no resuelve bajo esos tipos. Extender su `exclude` igual que el de `vite.config.ts`:

```json
"exclude": ["tests/rls", "tests/edge"]
```

- [ ] **Step 4: Escribir las pruebas que fallan**

Crear `tests/edge/sign-in.test.ts`. Estas pruebas hablan con la función real por HTTP; requieren el stack levantado y `pnpm supabase functions serve sign-in --no-verify-jwt` corriendo:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENDPOINT = `${URL}/functions/v1/sign-in`

const PASSWORD = 'contrasena-de-prueba-8'

async function signIn(
  identifier: string,
  password: string,
): Promise<{ status: number; body: any }> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ identifier, password }),
  })
  return { status: response.status, body: await response.json() }
}

describe('Edge Function sign-in', () => {
  let email: string
  let username: string

  beforeAll(async () => {
    const stamp = Date.now().toString().slice(-6)
    email = `edge-${stamp}@trainway.test`
    username = `edge_${stamp}`

    const admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw error

    const { error: updateError } = await admin
      .from('profiles')
      .update({ username })
      .eq('id', data.user!.id)
    if (updateError) throw updateError
  }, 30_000)

  it('entrega sesión con correo y contraseña correctos', async () => {
    const { status, body } = await signIn(email, PASSWORD)
    expect(status).toBe(200)
    expect(body.session?.access_token).toBeTruthy()
  })

  it('entrega sesión con username y contraseña correctos', async () => {
    const { status, body } = await signIn(username, PASSWORD)
    expect(status).toBe(200)
    expect(body.session?.access_token).toBeTruthy()
  })

  it('acepta el username sin importar mayúsculas', async () => {
    const { status } = await signIn(username.toUpperCase(), PASSWORD)
    expect(status).toBe(200)
  })

  it('rechaza la contraseña incorrecta', async () => {
    const { status, body } = await signIn(email, 'contrasena-mala-99')
    expect(status).toBe(400)
    expect(body.error).toBe('Credenciales inválidas')
  })

  it('responde exactamente igual ante un username inexistente', async () => {
    const conocido = await signIn(username, 'contrasena-mala-99')
    const desconocido = await signIn('no_existe_jamas', 'contrasena-mala-99')

    expect(desconocido.status).toBe(conocido.status)
    expect(desconocido.body).toEqual(conocido.body)
  })

  it('responde exactamente igual ante un correo inexistente', async () => {
    const conocido = await signIn(email, 'contrasena-mala-99')
    const desconocido = await signIn('nadie@trainway.test', 'contrasena-mala-99')

    expect(desconocido.status).toBe(conocido.status)
    expect(desconocido.body).toEqual(conocido.body)
  })

  it('nunca devuelve un correo en la respuesta de error', async () => {
    const { body } = await signIn(username, 'contrasena-mala-99')
    expect(JSON.stringify(body)).not.toContain('@')
  })

  it('rechaza un cuerpo malformado sin filtrar detalles', async () => {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON },
      body: 'no es json',
    })
    expect(response.status).toBe(400)
    const body: any = await response.json()
    expect(body.error).toBe('Credenciales inválidas')
  })

  it('el piso de tiempo de respuesta no distingue username inexistente de contraseña mala', async () => {
    // Debe coincidir con MIN_FAILURE_MS en supabase/functions/sign-in/index.ts.
    // Sin el piso, este par medía ~75ms (contraseña mala de una cuenta real,
    // que sí paga bcrypt) contra ~14ms (username que no existe, que GoTrue
    // rechaza antes de tocar bcrypt) — una diferencia de 5x, perfectamente
    // medible por quien está probando usernames al azar.
    const FLOOR_MS = 250
    const TRIALS = 6

    async function timed(identifier: string): Promise<number> {
      const start = performance.now()
      await signIn(identifier, 'contrasena-mala-99')
      return performance.now() - start
    }

    const known: number[] = []
    const unknown: number[] = []
    // Intercalado, alternando cuál va primero en cada vuelta, para que una
    // deriva sistemática (por ejemplo el runtime calentándose) no falsifique
    // el resultado.
    for (let i = 0; i < TRIALS; i++) {
      if (i % 2 === 0) {
        known.push(await timed(username))
        unknown.push(await timed(`no_existe_jamas_${i}`))
      } else {
        unknown.push(await timed(`no_existe_jamas_${i}`))
        known.push(await timed(username))
      }
    }

    // setTimeout puede disparar unos milisegundos antes de lo pedido; el
    // margen evita que eso, y no una regresión real, tumbe la prueba.
    const TOLERANCE_MS = 15
    for (const elapsed of [...known, ...unknown]) {
      expect(elapsed).toBeGreaterThanOrEqual(FLOOR_MS - TOLERANCE_MS)
    }

    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    const diff = Math.abs(median(known) - median(unknown))
    // La diferencia real sin piso fue de ~60ms. 50ms de margen deja detectar
    // que el piso sigue puesto sin ser frágil ante el ruido normal de una
    // red local.
    expect(diff).toBeLessThan(50)
  }, 20_000)
})
```

- [ ] **Step 5: Ejecutar las pruebas**

Con `pnpm supabase functions serve sign-in --no-verify-jwt` corriendo en otra terminal:

```bash
pnpm test:edge
```
Esperado: PASAN las 9.

- [ ] **Step 6: Comprobar que las pruebas de seguridad no son vacías**

Dos mutaciones separadas, porque hay dos propiedades distintas en juego: que el status/cuerpo no distingan, y que el piso de tiempo siga puesto.

**6a — status y cuerpo.** Mutar temporalmente la rama de username desconocido para que responda distinto:

```typescript
if (typeof data !== 'string' || data.length === 0) {
  return failure({ error: 'Ese usuario no existe' }, 404)
}
email = data
```

```bash
pnpm test:edge
```
Esperado: FALLA `responde exactamente igual ante un username inexistente`, únicamente esa. Restaurar y volver a ejecutar:

```bash
pnpm test:edge
```
Esperado: PASAN las 9.

**6b — el piso de tiempo.** Mutar temporalmente `failure` para que no espere nada:

```typescript
const elapsed = performance.now() - startedAt
const remaining = 0 // MUTATED: piso desactivado
if (remaining > 0) {
```

```bash
pnpm test:edge
```
Esperado: FALLA `el piso de tiempo de respuesta no distingue username inexistente de contraseña mala` — el tiempo medido cae a los ~75ms reales de bcrypt, por debajo del piso que la prueba exige. Restaurar y volver a ejecutar:

```bash
pnpm test:edge
```
Esperado: PASAN las 9.

- [ ] **Step 6c (una sola vez, no en cada implementación): generar `deno.lock`**

`supabase/functions/deno.json` fija la versión exacta del import, pero eso no basta: un `deno.lock` fija además los hashes de integridad de cada dependencia transitiva. `pnpm supabase functions serve` empaqueta `deno_core` dentro de un runtime en Rust, no la CLI general de Deno, y no escribe un lockfile de vuelta al host aunque se le pase `--import-map` explícitamente — hace falta la CLI real:

```bash
pnpm add -D deno
pnpm approve-builds deno   # aprueba el postinstall que descarga el binario
pnpm exec deno cache --lock=supabase/functions/deno.lock supabase/functions/sign-in/index.ts
```

Esto añade `deno` a `devDependencies`, y `pnpm approve-builds` escribe `allowBuilds: { deno: true }` en `pnpm-workspace.yaml` — sin ese archivo, una instalación limpia en otra máquina vuelve a ignorar el postinstall y el binario nunca se descarga. Los tres archivos (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`) se commitean junto con el lockfile de Deno. No fabricar un `deno.lock` a mano si esto no está disponible: un lockfile con hashes inventados es peor que ninguno — o se ignora en silencio, o falsamente aparenta una protección que no existe. Si no hay manera de instalar `deno` en el entorno que ejecuta esta tarea, dejarlo pendiente y decirlo explícitamente, no forzarlo.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions vite.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.test.json tsconfig.app.json supabase/config.toml tests/edge
git commit -m "feat: add sign-in edge function accepting email or username"
```

---

### Task 3: Registro y pantalla de acceso con contraseña

**Files:**
- Modify: `src/features/auth/auth-repository.ts`, `src/features/auth/LoginPage.tsx`, `src/features/profile/profile-repository.ts`
- Create: `src/features/auth/SignupPage.tsx`
- Test: `src/features/auth/auth-repository.test.ts` (ampliar), `src/features/auth/SignupPage.test.tsx`, `src/features/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: la Edge Function de la Task 2; `username_available` de la Task 1; `validateUsername` y `setUsername` del Plan 1.
- Produces:
  - `signInWithIdentifier(identifier: string, password: string): Promise<{ error: string | null }>`
  - `signUpWithPassword(email: string, password: string, username: string): Promise<{ error: string | null }>`
  - `isUsernameAvailable(username: string): Promise<boolean>`
  - `<SignupPage />`, y `<LoginPage />` con contraseña como camino principal y magic link como segunda opción visible.

- [ ] **Step 1: Escribir las pruebas que fallan para el repositorio**

Añadir a `src/features/auth/auth-repository.test.ts`. Conservar las pruebas existentes; estas se suman:

```typescript
describe('signInWithIdentifier', () => {
  it('rechaza identificador vacío sin llamar a la red', async () => {
    const result = await signInWithIdentifier('', 'contrasena12')
    expect(result.error).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza contraseña vacía sin llamar a la red', async () => {
    const result = await signInWithIdentifier('gerardo_99', '')
    expect(result.error).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('guarda la sesión que devuelve la función', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ session: { access_token: 'a', refresh_token: 'b' } }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBeNull()
    expect(setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'b' })
  })

  it('traduce el rechazo de la función a un mensaje único', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Credenciales inválidas' }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'mala')
    expect(result.error).toBe('Credenciales inválidas')
    expect(setSession).not.toHaveBeenCalled()
  })

  it('traduce un fallo de red a un mensaje legible', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBe('No se pudo conectar. Revisa tu conexión.')
  })
})

describe('signUpWithPassword', () => {
  it('rechaza una contraseña de menos de 8 caracteres sin llamar a la red', async () => {
    const result = await signUpWithPassword('a@b.com', 'corta12', 'gerardo_99')
    expect(result.error).toMatch(/8/)
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rechaza un username inválido sin llamar a la red', async () => {
    const result = await signUpWithPassword('a@b.com', 'contrasena12', 'MAYUS')
    expect(result.error).not.toBeNull()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rechaza un correo inválido sin llamar a la red', async () => {
    const result = await signUpWithPassword('no-es-correo', 'contrasena12', 'gerardo_99')
    expect(result.error).not.toBeNull()
    expect(signUpMock).not.toHaveBeenCalled()
  })
})
```

Para que esas pruebas corran, el bloque de simulación al principio del archivo necesita tres piezas más. Reemplazar la cabecera del archivo hasta el `await import` por:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
const signOutMock = vi.fn()
const setSession = vi.fn()
const signUpMock = vi.fn()
const setUsernameMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
      setSession: (...args: unknown[]) => setSession(...args),
      signUp: (...args: unknown[]) => signUpMock(...args),
    },
  },
}))

vi.mock('../profile/profile-repository', async (importOriginal) => {
  // validateUsername es lógica pura y se quiere la real: si la simulamos,
  // las pruebas de username inválido dejarían de probar nada.
  const actual = await importOriginal<typeof import('../profile/profile-repository')>()
  return { ...actual, setUsername: (...args: unknown[]) => setUsernameMock(...args) }
})

vi.stubGlobal('fetch', fetchMock)

const {
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signInWithIdentifier,
  signUpWithPassword,
} = await import('./auth-repository')

beforeEach(() => {
  signInWithOtp.mockReset()
  signInWithOAuth.mockReset()
  signOutMock.mockReset()
  setSession.mockReset()
  signUpMock.mockReset()
  setUsernameMock.mockReset()
  fetchMock.mockReset()
  setSession.mockResolvedValue({ error: null })
})
```

Las cinco pruebas que ya existían en el archivo se conservan tal cual; solo desaparece su `beforeEach` propio, ahora cubierto por el de arriba.

- [ ] **Step 2: Ejecutar para ver fallar**

```bash
pnpm test auth-repository
```
Esperado: FALLA con `signInWithIdentifier is not a function` o el error de importación equivalente.

- [ ] **Step 3: Implementar las funciones del repositorio**

Añadir a `src/features/auth/auth-repository.ts`:

```typescript
const MIN_PASSWORD_LENGTH = 8

export async function signInWithIdentifier(
  identifier: string,
  password: string,
): Promise<{ error: string | null }> {
  if (identifier.trim().length === 0 || password.length === 0) {
    return { error: 'Escribe tu usuario o correo y tu contraseña' }
  }

  let payload: { session?: { access_token: string; refresh_token: string } }
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-in`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      },
    )
    payload = await response.json()
    if (!response.ok || !payload.session) {
      return { error: 'Credenciales inválidas' }
    }
  } catch {
    return { error: 'No se pudo conectar. Revisa tu conexión.' }
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  })

  if (error) return { error: 'No se pudo iniciar la sesión' }
  return { error: null }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  username: string,
): Promise<{ error: string | null }> {
  if (!EMAIL_PATTERN.test(email)) return { error: 'Escribe un correo válido' }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'La contraseña necesita al menos 8 caracteres' }
  }

  const invalidUsername = validateUsername(username)
  if (invalidUsername) return { error: invalidUsername }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: 'No se pudo crear la cuenta' }

  // El trigger ya creó el perfil con username nulo. Si esta escritura falla
  // (por ejemplo porque alguien tomó el username en el intervalo), la cuenta
  // existe igual y UsernameOnboarding se lo pedirá al entrar. No se pierde nada.
  if (data.user) {
    await setUsername(data.user.id, username)
  }

  return { error: null }
}
```

`validateUsername` y `setUsername` se importan de `../profile/profile-repository`. `EMAIL_PATTERN` ya existe en el archivo.

- [ ] **Step 4: Ejecutar y verificar que pasa**

```bash
pnpm test auth-repository
```
Esperado: PASAN todas, las 5 previas y las 8 nuevas.

- [ ] **Step 5: Añadir la comprobación de disponibilidad de username**

Añadir a `src/features/profile/profile-repository.ts`:

```typescript
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('username_available', {
    p_username: username,
  })
  if (error) return false
  return data === true
}
```

- [ ] **Step 6: Escribir la prueba que falla para la pantalla de alta**

Crear `src/features/auth/SignupPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signUpWithPassword = vi.fn()
vi.mock('./auth-repository', () => ({
  signUpWithPassword: (...args: unknown[]) => signUpWithPassword(...args),
}))

const { SignupPage } = await import('./SignupPage')

describe('SignupPage', () => {
  beforeEach(() => {
    signUpWithPassword.mockReset()
  })

  it('envía correo, contraseña y username', async () => {
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(signUpWithPassword).toHaveBeenCalledWith(
      'gerardo@tradeway.mx',
      'contrasena12',
      'gerardo_99',
    )
  })

  it('muestra el error que devuelve el repositorio', async () => {
    signUpWithPassword.mockResolvedValue({ error: 'Ese username ya está tomado' })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese username ya está tomado',
    )
  })

  it('pasa el username a minúsculas mientras se escribe', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const field = screen.getByLabelText(/usuario/i)
    await user.type(field, 'Gerardo')
    expect(field).toHaveValue('gerardo')
  })
})
```

- [ ] **Step 7: Ejecutar para ver fallar**

```bash
pnpm test SignupPage
```
Esperado: FALLA, `Failed to resolve import "./SignupPage"`.

- [ ] **Step 8: Implementar la pantalla de alta**

Crear `src/features/auth/SignupPage.tsx`. Todo color viene de tokens; el mensaje de error lleva `role="alert"` para que un lector de pantalla lo anuncie:

```typescript
import { useState, type FormEvent } from 'react'
import { signUpWithPassword } from './auth-repository'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const result = await signUpWithPassword(email, password, username)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-3xl font-bold text-content">Cuenta creada</h1>
        <p className="max-w-sm text-center text-content-muted">
          Revisa tu correo para confirmar la cuenta y ya puedes entrar.
        </p>
      </main>
    )
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold text-content">Trainway</h1>

      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="signup-email" className="text-sm text-content-muted">
          Correo
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          autoComplete="email"
        />

        <label htmlFor="signup-password" className="text-sm text-content-muted">
          Contraseña
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          autoComplete="new-password"
        />

        <label htmlFor="signup-username" className="text-sm text-content-muted">
          Usuario
        </label>
        <input
          id="signup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          placeholder="gerardo_99"
          autoComplete="off"
        />

        {error && (
          <p role="alert" className="text-sm text-content">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
        >
          {saving ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 9: Ejecutar y verificar que pasa**

```bash
pnpm test SignupPage
```
Esperado: PASAN las 3.

- [ ] **Step 10: Escribir la prueba que falla para la pantalla de acceso**

Crear `src/features/auth/LoginPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signInWithIdentifier = vi.fn()
const signInWithEmail = vi.fn()
const signInWithGoogle = vi.fn()

vi.mock('./auth-repository', () => ({
  signInWithIdentifier: (...a: unknown[]) => signInWithIdentifier(...a),
  signInWithEmail: (...a: unknown[]) => signInWithEmail(...a),
  signInWithGoogle: (...a: unknown[]) => signInWithGoogle(...a),
}))

const { LoginPage } = await import('./LoginPage')

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithIdentifier.mockReset()
    signInWithEmail.mockReset()
    signInWithGoogle.mockReset()
  })

  it('entra con identificador y contraseña', async () => {
    signInWithIdentifier.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/usuario o correo/i), 'gerardo_99')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(signInWithIdentifier).toHaveBeenCalledWith('gerardo_99', 'contrasena12')
  })

  it('anuncia el error de credenciales', async () => {
    signInWithIdentifier.mockResolvedValue({ error: 'Credenciales inválidas' })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText(/usuario o correo/i), 'gerardo_99')
    await user.type(screen.getByLabelText(/contraseña/i), 'mala')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas')
  })

  it('ofrece el magic link como segunda opción', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /enlace por correo/i }))
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument()
  })

  it('surfacea el error de Google en vez de fallar en silencio', async () => {
    signInWithGoogle.mockResolvedValue({ error: 'No se pudo abrir el acceso con Google' })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /google/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Google')
  })
})
```

- [ ] **Step 11: Ejecutar para ver fallar**

```bash
pnpm test LoginPage
```
Esperado: FALLA porque la pantalla actual no tiene campo de contraseña.

- [ ] **Step 12: Rediseñar la pantalla de acceso**

Reemplazar `src/features/auth/LoginPage.tsx` completo. Dos modos: `password`, el inicial, y `magic`. Todo error se pinta en un `role="alert"` con `text-content`, nunca en `text-content-muted` — un mensaje de error no puede ser menos visible que el texto normal:

```typescript
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { signInWithIdentifier, signInWithEmail, signInWithGoogle } from './auth-repository'

const FIELD =
  'rounded-lg border border-border bg-surface-raised px-4 py-3 text-content'
const PRIMARY =
  'rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60'
const SECONDARY =
  'rounded-lg border border-border px-4 py-3 font-medium text-content disabled:opacity-60'

export function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [linkSent, setLinkSent] = useState(false)

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const result = await signInWithIdentifier(identifier, password)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  async function onMagicSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const result = await signInWithEmail(email)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setLinkSent(true)
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)

    const result = await signInWithGoogle()
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold text-content">Trainway</h1>

      {mode === 'password' ? (
        <form onSubmit={onPasswordSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="login-identifier" className="text-sm text-content-muted">
            Usuario o correo
          </label>
          <input
            id="login-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className={FIELD}
            autoComplete="username"
          />

          <label htmlFor="login-password" className="text-sm text-content-muted">
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={FIELD}
            autoComplete="current-password"
          />

          {error && (
            <p role="alert" className="text-sm text-content">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode('magic')
              setError(null)
            }}
            className={SECONDARY}
          >
            Enlace por correo
          </button>

          <button type="button" disabled={busy} onClick={onGoogle} className={SECONDARY}>
            Entrar con Google
          </button>

          <Link to="/registro" className="pt-2 text-center text-sm text-content-muted">
            Crear cuenta
          </Link>
        </form>
      ) : linkSent ? (
        <p className="max-w-sm text-center text-content-muted">
          Te enviamos un enlace a <strong className="text-content">{email}</strong>.
          Ábrelo en este dispositivo para entrar.
        </p>
      ) : (
        <form onSubmit={onMagicSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="login-email" className="text-sm text-content-muted">
            Correo
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={FIELD}
            placeholder="tu@correo.com"
            autoComplete="email"
          />

          {error && (
            <p role="alert" className="text-sm text-content">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Enviando…' : 'Enviar enlace de acceso'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode('password')
              setError(null)
            }}
            className={SECONDARY}
          >
            Usar contraseña
          </button>
        </form>
      )}
    </main>
  )
}
```

Nota sobre las pruebas: `LoginPage` ahora usa `<Link>`, que exige un Router por encima. Envolver el render de `LoginPage.test.tsx` en `<MemoryRouter>` de `react-router`.

- [ ] **Step 13: Ejecutar y verificar que pasa**

```bash
pnpm test LoginPage
```
Esperado: PASAN las 4.

- [ ] **Step 14: Ejecutar la suite completa**

```bash
pnpm test
```
Esperado: PASAN todas las pruebas unitarias, sin advertencias en la salida.

- [ ] **Step 15: Verificar el flujo real de punta a punta**

Con el stack levantado y la función servida:

```bash
pnpm db:start
pnpm supabase functions serve sign-in --no-verify-jwt
```

En otra terminal, `pnpm dev`. Entonces, en el navegador:

1. Ir a `/registro`, crear una cuenta con correo, contraseña de 8+ caracteres y username.
2. Confirmar el correo desde el buzón local en `http://127.0.0.1:54324`.
3. Volver a `/login`, entrar **con el username** y la contraseña. Esperado: sesión iniciada.
4. Cerrar sesión y repetir entrando **con el correo**. Esperado: sesión iniciada.
5. Intentar con una contraseña incorrecta. Esperado: "Credenciales inválidas".
6. Intentar con un username inexistente. Esperado: el mismo mensaje, indistinguible.
7. Repetir los pasos 3 y 5 en tema claro y en tema oscuro, comprobando que el mensaje de error se lee bien en ambos.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: add password signup and dual-identifier login"
```

---

## Al terminar este plan

El usuario se registra con correo, contraseña y username, y entra escribiendo cualquiera de los dos identificadores. Un atacante que pruebe usernames al azar no puede distinguir "no existe" de "contraseña incorrecta", ni por el mensaje ni por el tiempo de respuesta, y ningún correo ajeno llega jamás al navegador. El magic link sigue disponible como segunda opción.

Pendiente explícito fuera de alcance: recuperación de contraseña, y el proveedor de Google, que requiere credenciales de Google Cloud en el panel de Supabase.

También pendiente: **límite de intentos de acceso por quien llama, no por IP de la función**. `sign-in` hoy llama a GoTrue desde la IP de salida del runtime de la función, así que el límite de `auth.rate_limit.sign_in_sign_ups` (30 cada 5 minutos) no distingue entre quienes llaman — una sola persona agotándolo bloquea a todos los demás. Se evaluó reenviar `x-forwarded-for` y se descartó a propósito: ese encabezado lo pone quien hace la petición, no una capa de confianza; en un despliegue real la plataforma añade la IP verdadera a la cadena en vez de reemplazarla, y reenviar la cadena tal cual dejaría que quien ataca rote el valor y consiga un presupuesto por IP ilimitado — peor que la bolsa compartida que se buscaba arreglar. El cierre real no es código en la función: es un captcha (`[auth.captcha]`, ya preparado con `hcaptcha`/`turnstile` como opciones en `supabase/config.toml`, solo falta una cuenta real y pasar el token desde el cliente) o un throttle contra algo que quien llama no pueda falsificar.
