import { createClient } from '@supabase/supabase-js'
import { isServiceError, requireEnv, resolveMinFailureMs, usingDefaultOrigins } from './logic.ts'

// Las tres se leen y verifican aquí, a nivel de módulo -- no dentro del
// handler. `Deno.env.get(...)!` no lanza si la variable falta: da
// `undefined` en silencio, y entonces `createClient` revienta más abajo,
// dentro de cada petición, aterrizando en el catch y devolviendo un
// veredicto de credenciales (INVALID/400) para el 100% de quienes intenten
// entrar -- un despliegue self-hosted al que le falte un secreto le diría a
// todo el mundo que su contraseña está mal. `requireEnv` lanza aquí en
// cambio, a nivel de módulo: la función ni siquiera arranca, y el runtime de
// Supabase responde con un 5xx de arranque que el cliente traduce a
// "Servicio no disponible" (ver signInWithIdentifier en
// src/features/auth/auth-repository.ts), no a una contraseña mala.
const SUPABASE_URL = requireEnv('SUPABASE_URL', Deno.env.get('SUPABASE_URL'))
const ANON_KEY = requireEnv('SUPABASE_ANON_KEY', Deno.env.get('SUPABASE_ANON_KEY'))
const SERVICE_KEY = requireEnv(
  'SUPABASE_SERVICE_ROLE_KEY',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
)

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
// real que hizo por debajo. 250 deja margen amplio sobre los ~75ms medidos
// en local -- pero es un mínimo, no un tope: si en producción la RPC más
// GoTrue tardan más que esto, la respuesta sale a su latencia real y el
// oráculo de tiempo se reabre sin que nada lo señale (ver el console.warn
// en `failure` más abajo). MIN_FAILURE_MS permite subir el piso sin tocar
// código si eso llega a pasar; el default sigue siendo 250.
const DEFAULT_MIN_FAILURE_MS = 250
const MIN_FAILURE_MS = resolveMinFailureMs(
  Deno.env.get('MIN_FAILURE_MS'),
  DEFAULT_MIN_FAILURE_MS,
)

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

if (usingDefaultOrigins(rawAllowedOrigins)) {
  // Grita en los logs de arranque, no solo en un comentario que nadie
  // relee al desplegar. Sin ALLOWED_ORIGINS puesto, el primer despliegue
  // real sirve `Access-Control-Allow-Origin: http://localhost:5173` a un
  // navegador que llama desde el dominio real de la PWA -- el navegador
  // descarta la respuesta por CORS y quien intenta entrar ve "No se pudo
  // conectar. Revisa tu conexión.", indistinguible de un problema de su
  // propia red. `pnpm supabase functions logs sign-in` es donde esto se ve.
  console.error(
    'ALLOWED_ORIGINS no está configurado: sign-in está sirviendo los valores por ' +
      `defecto de desarrollo (${DEFAULT_ALLOWED_ORIGINS}). Un despliegue real necesita ` +
      'fijar el secreto ALLOWED_ORIGINS a los orígenes reales de la PWA -- ver ' +
      'README.md, sección "Despliegue de la Edge Function" -- o todo inicio de sesión ' +
      'con contraseña va a fallar por CORS.',
  )
}

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
    } else if (remaining < 0) {
      // El piso es un mínimo, no un tope (ver el comentario sobre
      // MIN_FAILURE_MS más arriba): si esto se ve en los logs de
      // producción, la ruta ya tardó más que el piso configurado y el
      // oráculo de tiempo está reabierto ahora mismo, en silencio, sin este
      // warn. Subir MIN_FAILURE_MS o investigar la latencia real es lo que
      // corresponde cuando aparece.
      console.warn(
        `sign-in: el tiempo transcurrido (${elapsed.toFixed(1)}ms) superó ` +
          `MIN_FAILURE_MS (${MIN_FAILURE_MS}ms); esta respuesta salió sin piso.`,
      )
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
    // Este catch es un respaldo, no la primera línea de defensa contra una
    // variable de entorno ausente: eso ahora aborta la carga del módulo más
    // arriba (requireEnv), antes de que llegue ninguna petición. Y no es
    // tampoco donde aterriza un fallo de red al hablar con GoTrue o
    // Postgres: verificado contra @supabase/auth-js@2.112.0 y
    // @supabase/postgrest-js, ninguno de los dos clientes lanza ante un
    // fetch fallido -- ambos lo devuelven como error normal (GoTrue con
    // status: 0, ver isServiceError en logic.ts), así que ese caso ya se
    // maneja arriba, antes de llegar aquí. Lo que queda para este catch es
    // lo verdaderamente no anticipado: un bug propio, o un comportamiento
    // del SDK que ninguno de los chequeos de arriba contempló. Es igual de
    // improbable sin importar qué identificador se haya pedido, así que
    // reportarlo aparte (UNAVAILABLE/503) no delata ninguna cuenta. La causa
    // real queda en los logs, no en la respuesta.
    console.error('sign-in unexpected error', err)
    return failure({ error: UNAVAILABLE }, 503)
  }
})
