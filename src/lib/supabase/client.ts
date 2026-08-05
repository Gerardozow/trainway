import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Si falta la configuración, la app lo dice en pantalla.
 *
 * Aquí NO puede haber un `throw` a nivel de módulo. Vite sustituye
 * `import.meta.env.*` por literales en tiempo de compilación, así que sin .env
 * la condición se pliega a `true`, el throw queda incondicional, y el bundler
 * elimina como código muerto todo lo que venga después — es decir, la
 * aplicación entera. El build "pasa" y produce un archivo que solo lanza.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'https://sin-configurar.supabase.co',
  anonKey || 'sin-configurar',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'trainway-auth',
    },
  },
)
