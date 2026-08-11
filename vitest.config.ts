import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Módulo virtual del plugin de PWA: solo existe cuando compila Vite.
      'virtual:pwa-register': path.resolve(import.meta.dirname, 'tests/stubs/pwa-register.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Zona fija, y a propósito una con desfase negativo: agrupar por día es
    // sensible al huso y en UTC los fallos de conversión no aparecen.
    env: { TZ: 'America/Mexico_City' },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
