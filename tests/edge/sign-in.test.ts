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
