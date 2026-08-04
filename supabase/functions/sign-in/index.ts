import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Un único mensaje para todos los fallos de credenciales. Distinguir entre
// "ese username no existe" y "la contraseña está mal" convierte esta función
// en un buscador de cuentas.
const INVALID = 'Credenciales inválidas'

// Correo que con certeza no existe. Se usa para que el camino "username
// desconocido" también pague el costo de una verificación de contraseña y no
// se distinga del camino "username conocido, contraseña mala" por su tiempo
// de respuesta.
const DECOY_EMAIL = 'decoy-nonexistent@trainway.invalid'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  let identifier: unknown
  let password: unknown
  try {
    const body = await request.json()
    identifier = body?.identifier
    password = body?.password
  } catch {
    return json({ error: INVALID }, 400)
  }

  if (typeof identifier !== 'string' || typeof password !== 'string') {
    return json({ error: INVALID }, 400)
  }
  if (identifier.length === 0 || password.length === 0) {
    return json({ error: INVALID }, 400)
  }

  let email = identifier
  if (!identifier.includes('@')) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await admin.rpc('email_for_username', {
      p_username: identifier.toLowerCase(),
    })
    // Si el username no existe seguimos con un correo señuelo en vez de
    // responder de inmediato: así el atacante no puede medir la diferencia.
    email = !error && typeof data === 'string' && data.length > 0 ? data : DECOY_EMAIL
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await anon.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    return json({ error: INVALID }, 400)
  }

  return json({ session: data.session }, 200)
})
