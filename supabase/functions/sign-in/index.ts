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
