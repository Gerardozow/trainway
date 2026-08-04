import { defineConfig, configDefaults } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Carga todas las variables, incluidas las que no llevan prefijo VITE_,
  // para que las pruebas de RLS puedan usar la clave de servicio.
  // `process.env` solo existe en el proceso de Node de Vitest, nunca en el navegador.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Trainway',
          short_name: 'Trainway',
          description: 'Registra tus entrenos y comparte rutinas con tus amigos.',
          lang: 'es',
          start_url: '/',
          display: 'standalone',
          background_color: '#09090b',
          theme_color: '#09090b',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Las peticiones a Supabase nunca se sirven desde caché: los datos
          // frescos importan y la capa offline vive en IndexedDB, no en el
          // service worker.
          navigateFallbackDenylist: [/^\/api/],
        },
      }),
    ],
    test: {
      // Dos proyectos separados: "unit" (jsdom, componentes) y "rls" (node,
      // habla directo con Postgres/Supabase). Separarlos permite que `pnpm test`
      // corra sin Supabase levantado, y que cada uno tenga su propio entorno y
      // setupFiles sin que se pisen entre sí.
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            globals: true,
            environment: 'jsdom',
            setupFiles: ['./tests/setup.ts'],
            css: true,
            exclude: [...configDefaults.exclude, 'tests/rls/**', 'tests/edge/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'rls',
            globals: true,
            environment: 'node',
            include: ['tests/rls/**/*.test.ts'],
          },
        },
        {
          test: {
            name: 'edge',
            environment: 'node',
            include: ['tests/edge/**/*.test.ts'],
          },
        },
      ],
    },
  }
})
