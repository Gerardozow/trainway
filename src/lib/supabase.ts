import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y llénalo con la salida de `pnpm supabase status`.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE: el magic link y OAuth devuelven un `?code=` de un solo uso que se
    // intercambia por POST, en vez de tokens en el fragmento de la URL
    // (flujo implícito), que quedan expuestos en el historial del navegador.
    flowType: 'pkce',
  },
})
