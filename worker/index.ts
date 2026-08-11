import { errorResponse, HttpError, json, requireUser, type Env } from './lib/auth'
import { handlePlan } from './routes/plan'
import { handleTranslate } from './routes/translate'
import { handleReview } from './routes/review'

const BASE = '/trainway'

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

    return response
  },
}
