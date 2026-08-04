import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// src/lib/supabase.ts throws at module load if these are missing, which is
// correct for the real app (catches a misconfigured deploy early) but wrong
// for `pnpm test`: that project is jsdom-only and explicitly documented to
// run without Docker or a real Supabase project, so it must not depend on
// `.env.local`. Any test file whose import graph reaches src/lib/supabase.ts
// — directly, or transitively through something like routes.tsx or
// profile-repository.ts — would otherwise fail on a fresh clone/CI where
// `.env.local` (gitignored) doesn't exist. Stubbing here, once, covers every
// unit test file instead of requiring each one to mock '../lib/supabase'
// individually.
vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
