import { defineConfig, configDefaults } from 'vitest/config'
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
            exclude: [...configDefaults.exclude, 'tests/rls/**'],
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
      ],
    },
  }
})
