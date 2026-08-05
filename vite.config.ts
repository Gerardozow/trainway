import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/**
 * Guardia de configuración.
 *
 * Vite sustituye `import.meta.env.*` por literales al compilar. Si faltan, toda
 * comprobación de configuración se pliega a una constante y el bundler elimina
 * como código muerto lo que venga detrás — en el peor caso, la aplicación
 * entera, con el build marcado como exitoso.
 *
 * Así que el build falla aquí, ruidosamente, en lugar de producir un archivo
 * que no contiene nada.
 */
function assertConfigured(env: Record<string, string>, isBuild: boolean): void {
  if (!isBuild || process.env.TRAINWAY_ALLOW_UNCONFIGURED === '1') return

  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !env[k])
  if (missing.length === 0) return

  throw new Error(
    `\nBuild abortado: faltan ${missing.join(' y ')}.\n` +
      `Copia .env.example a .env y rellénalas, o exporta TRAINWAY_ALLOW_UNCONFIGURED=1 ` +
      `si de verdad quieres un bundle sin configurar.\n`,
  )
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  assertConfigured(env, command === 'build')

  return {
    base: '/trainway/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'fonts/*.woff2'],
        manifest: {
          name: 'Trainway',
          short_name: 'Trainway',
          description: 'Tu plan de gimnasio, generado y ajustado semana a semana.',
          lang: 'es',
          start_url: '/trainway/',
          scope: '/trainway/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0B0B0C',
          theme_color: '#FFC603',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // El catálogo pesa 866 KB y es justo lo que hace falta sin señal.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
          navigateFallback: '/trainway/index.html',
          runtimeCaching: [
            {
              // Imágenes de los ejercicios: se guardan al verlas y siguen ahí
              // en el gimnasio sin cobertura.
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ejercicios-imagenes',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          // Supabase NUNCA pasa por el service worker: sus respuestas dependen
          // de la sesión y servir una cacheada mostraría datos de otro momento.
          navigateFallbackDenylist: [/^\/trainway\/api\//],
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        output: {
          // El catálogo pesa casi 1 MB y no cambia nunca: en su propio chunk se
          // descarga una vez y se queda en caché para siempre. Mezclado con el
          // código de la app se volvería a bajar entero en cada despliegue.
          advancedChunks: {
            groups: [
              { name: 'catalogo', test: /data[\\/]exercises\.json/ },
              { name: 'supabase', test: /node_modules[\\/]@supabase/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
