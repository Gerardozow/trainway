import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isTest = import.meta.env.MODE === 'test'

if (!isTest && (!url || !anonKey)) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y rellénalas.',
  )
}

export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'anon-key-de-pruebas',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'trainway-auth',
    },
  },
)
