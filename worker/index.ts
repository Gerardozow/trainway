import { errorResponse, HttpError, json, requireUser, type Env } from './lib/auth'
import { handlePlan } from './routes/plan'
import { handleTranslate } from './routes/translate'
import { handleReview } from './routes/review'

const BASE = '/trainway'

/**
 * ¿La respuesta es el index.html haciéndose pasar por otra cosa?
 *
 * `not_found_handling: single-page-application` devuelve index.html para todo
 * lo que no encuentra. Para una ruta de la app es justo lo que se quiere; para
 * `/assets/Progress-abc123.js` es una mentira que el navegador destapa con
 * "Expected a JavaScript module but the server responded with text/html", y
 * peor: el service worker guardaría ese HTML en la caché como si fuera el
 * chunk. Un 404 honesto se puede reintentar; un HTML disfrazado, no.
 */
export function looksLikeSpaFallback(pathname: string, contentType: string | null): boolean {
  if (!contentType?.includes('text/html')) return false

  const file = pathname.slice(pathname.lastIndexOf('/') + 1)
  if (!file.includes('.')) return false // una ruta de la app, no un archivo

  return !file.endsWith('.html')
}

/**
 * Un solo Worker sirve el SPA y la API.
 *
 * El subpath se resuelve quitando el prefijo `/trainway` antes de delegar en el
 * binding de assets: Vite compila con `base: '/trainway/'`, así que el HTML pide
 * `/trainway/assets/...` y el binding los tiene en la raíz.
 */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname.startsWith(`${BASE}/api/`)) {
      if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

      try {
        const { userId, token } = await requireUser(req, env)
        const route = url.pathname.slice(`${BASE}/api/`.length)

        switch (route) {
          case 'plan':
            return await handlePlan(req, env, userId, token)
          case 'translate':
            return await handleTranslate(req, env, token)
          case 'review':
            return await handleReview(req, env)
          default:
            throw new HttpError('Ruta no encontrada.', 404)
        }
      } catch (err) {
        return errorResponse(err)
      }
    }

    // Assets estáticos: el binding los sirve desde la raíz, sin el prefijo.
    const assetUrl = new URL(url)
    assetUrl.pathname = url.pathname.startsWith(BASE)
      ? url.pathname.slice(BASE.length) || '/'
      : url.pathname

    const response = await env.ASSETS.fetch(new Request(assetUrl, req))

    // El binding no sabe nada del prefijo, así que cualquier redirección que
    // emita apunta a la raíz del dominio. Se la devolvemos.
    const location = response.headers.get('Location')
    if (response.status >= 300 && response.status < 400 && location?.startsWith('/')) {
      const headers = new Headers(response.headers)
      headers.set('Location', `${BASE}${location}`)
      return new Response(response.body, { status: response.status, headers })
    }

    if (looksLikeSpaFallback(assetUrl.pathname, response.headers.get('Content-Type'))) {
      return new Response('No encontrado.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    return response
  },
}
