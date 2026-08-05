export type Env = {
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  MINIMAX_API_KEY: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/**
 * Comprueba la configuración antes de usarla.
 *
 * Sin esto, un secret ausente o vacío se manifiesta como un error interno del
 * SDK de turno — "Could not resolve authentication method" — que no dice nada
 * sobre qué falta ni dónde arreglarlo. El nombre del binding sí.
 *
 * Nunca revela valores, solo si están y cuánto miden.
 */
export function requireConfig(env: Env, claves: (keyof Env)[]): void {
  const faltan = claves.filter((k) => typeof env[k] !== 'string' || (env[k] as string).length === 0)
  if (faltan.length === 0) return

  const detalle = claves
    .map((k) => `${String(k)}=${typeof env[k] === 'string' ? `${(env[k] as string).length} car.` : typeof env[k]}`)
    .join(', ')

  throw new HttpError(
    `Falta configurar en el Worker: ${faltan.join(', ')}. ` +
      `Cárgalo con "npx wrangler secret put ${String(faltan[0])}". [${detalle}]`,
    500,
  )
}

/**
 * Valida el JWT de Supabase contra su endpoint de usuario.
 *
 * Se verifica en el servidor en lugar de confiar en el `sub` del token: el
 * Worker actúa después con la service role key, que se salta RLS, así que aquí
 * no puede haber atajos.
 */
export async function requireUser(req: Request, env: Env): Promise<{ userId: string; token: string }> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new HttpError('Falta el token de sesión.', 401)

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY },
  })
  if (!res.ok) throw new HttpError('Tu sesión caducó. Vuelve a entrar.', 401)

  const user = (await res.json()) as { id?: string }
  if (!user.id) throw new HttpError('Tu sesión caducó. Vuelve a entrar.', 401)

  return { userId: user.id, token }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, err.status)
  const message = err instanceof Error ? err.message : 'Algo falló en el servidor.'
  return json({ error: message }, 502)
}
