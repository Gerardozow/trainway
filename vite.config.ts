import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Carga todas las variables, incluidas las que no llevan prefijo VITE_,
  // para que las pruebas de RLS puedan usar la clave de servicio.
  // `process.env` solo existe en el proceso de Node de Vitest, nunca en el navegador.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), tailwindcss()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      css: true,
    },
  }
})
