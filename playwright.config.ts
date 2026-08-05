import { defineConfig, devices } from '@playwright/test'

/**
 * Trainway es una app de móvil. No se prueba en escritorio porque no es donde
 * se usa: se usa de pie, con una mano, en un gimnasio.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    // La barra final importa: sin ella, `goto('/entrar')` resuelve a la raíz
    // del host y se prueba la página de error de Vite en vez de la app.
    baseURL: 'http://localhost:4173/trainway/',
    trace: 'on-first-retry',
    locale: 'es-MX',
  },

  projects: [{ name: 'movil', use: { ...devices['Pixel 7'] } }],

  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/trainway/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
