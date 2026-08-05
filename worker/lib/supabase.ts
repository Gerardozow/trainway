import type { Env } from './auth'

/**
 * Cliente REST mínimo de Supabase para el Worker.
 *
 * Se usa `fetch` directo en vez del SDK para no arrastrar 60 KB al bundle del
 * Worker por cuatro consultas. `asUser` respeta RLS; `asService` la ignora y
 * solo se usa para escribir traducciones, que son compartidas.
 */
export function db(env: Env, opts: { token?: string; service?: boolean } = {}) {
  const key = opts.service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY
  const auth = opts.service ? env.SUPABASE_SERVICE_ROLE_KEY : (opts.token ?? env.SUPABASE_ANON_KEY)

  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${auth}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    const text = await res.text()
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : null
  }

  return {
    select: <T>(path: string) => request(path) as Promise<T>,

    insert: <T>(table: string, rows: unknown, returning = true) =>
      request(table, {
        method: 'POST',
        headers: { Prefer: returning ? 'return=representation' : 'return=minimal' },
        body: JSON.stringify(rows),
      }) as Promise<T>,

    upsert: <T>(table: string, rows: unknown, onConflict: string) =>
      request(`${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      }) as Promise<T>,

    patch: <T>(path: string, body: unknown) =>
      request(path, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(body),
      }) as Promise<T>,
  }
}
