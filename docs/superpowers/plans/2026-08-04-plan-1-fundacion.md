# Trainway — Plan 1: Fundación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar Trainway en pie como PWA instalable con tema claro/oscuro, base Supabase local con la tabla `profiles` protegida por RLS, y autenticación funcionando de punta a punta.

**Architecture:** SPA de Vite + React + TypeScript organizada por dominio bajo `src/features/`. La UI nunca llama a Supabase directamente: cada feature expone un repositorio y las pantallas consumen esa interfaz. El backend corre en local con Supabase CLI sobre Docker; el esquema vive en migraciones SQL versionadas.

**Tech Stack:** Vite 7, React 19, TypeScript, Tailwind CSS 4, react-router 7, TanStack Query 5, Supabase (Postgres + Auth), Vitest + Testing Library, `vite-plugin-pwa`.

## Global Constraints

- Gestor de paquetes: **pnpm**. Nunca `npm install` ni `yarn` en este repositorio.
- Node 24.x (instalado: v24.18.0). pnpm 11.x (instalado: 11.15.0).
- Supabase CLI se instala como **dependencia de desarrollo** (`pnpm add -D supabase`), nunca global. Se invoca con `pnpm supabase ...`.
- **Ningún secreto en el cliente.** En `src/` solo pueden aparecer variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. La clave `service_role` solo se usa en pruebas de RLS bajo `tests/` y en scripts de servidor. Nunca se importa desde `src/`.
- `.env.local` está en `.gitignore` y jamás se commitea. `.env.example` sí se commitea, con valores vacíos.
- **Tema claro y oscuro son ciudadanos de primera clase.** Todo color se declara como token CSS; ningún componente escribe un color literal como `bg-white` o `text-black`. Cada pantalla nueva se verifica en ambos temas antes de dar por terminada una tarea.
- Nombre del producto en toda la interfaz y metadatos: **Trainway** (una palabra, T mayúscula).
- Idioma de la interfaz: español. Los identificadores en el código van en inglés.
- Todas las tablas de Postgres llevan RLS habilitado desde la migración que las crea. Una tabla sin RLS es un defecto, no un pendiente.
- TDD: la prueba que falla se escribe y se ejecuta antes de la implementación, en cada tarea.

---

## Estructura de archivos

Al terminar este plan el repositorio se ve así. Cada archivo tiene una responsabilidad:

```
trainway/
  .env.example              # forma de las variables, sin valores
  .gitignore
  index.html                # metadatos de la app, color de tema
  package.json
  tsconfig.json
  vite.config.ts            # plugins React, Tailwind, PWA; configuración de Vitest
  supabase/
    config.toml             # generado por supabase init
    migrations/
      0001_profiles.sql     # tabla profiles, RLS, trigger de alta
  src/
    main.tsx                # punto de entrada: proveedores + router
    index.css               # tokens de color de ambos temas, capa de Tailwind
    lib/
      supabase.ts           # cliente único de Supabase para el navegador
    features/
      theme/
        ThemeProvider.tsx   # estado del tema, persistencia, aplicación de clase
        useTheme.ts         # hook de consumo
        ThemeToggle.tsx     # control de interfaz
        theme-storage.ts    # lectura/escritura de la preferencia, sin React
      auth/
        auth-repository.ts  # única puerta a Supabase Auth
        AuthProvider.tsx    # sesión en contexto de React
        useAuth.ts
        LoginPage.tsx
        RequireAuth.tsx     # guardia de rutas
      profile/
        profile-repository.ts
        UsernameOnboarding.tsx
    app/
      AppShell.tsx          # navegación inferior de 4 destinos
      routes.tsx            # definición de rutas
  tests/
    setup.ts                # configuración global de Vitest
    rls/
      client.ts             # ayudantes para crear usuarios de prueba
      profiles.test.ts      # pruebas de aislamiento de RLS
```

Regla de decomposición: `theme-storage.ts` y `auth-repository.ts` no importan React. Esto los hace probables sin renderizar nada, y permite que la lógica se pruebe rápido y en aislamiento.

---

### Task 1: Scaffold del proyecto con Tailwind y Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`, `.env.example`
- Create: `tests/setup.ts`
- Create: `src/shared/formatWeight.ts`
- Test: `src/shared/formatWeight.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: proyecto ejecutable con `pnpm dev`, suite ejecutable con `pnpm test`, Tailwind 4 activo con variante `dark` por clase. Exporta `formatWeight(kg: number): string`.

- [ ] **Step 1: Generar el scaffold fuera del repositorio y moverlo dentro**

El directorio `trainway/` ya contiene `docs/` y `.git/`, y `create-vite` se niega a trabajar en un directorio no vacío sin preguntar. Se genera aparte y se copia:

```bash
cd /home/gzow/proyectos
pnpm create vite@latest trainway-scaffold --template react-ts
cp -r trainway-scaffold/. trainway/
rm -rf trainway-scaffold
cd trainway
pnpm install
```

Verificar que `docs/` sigue presente:

```bash
ls docs/superpowers/specs/
```
Esperado: aparece `2026-08-04-trainway-design.md`.

- [ ] **Step 2: Instalar dependencias del proyecto**

```bash
pnpm add react-router @tanstack/react-query @supabase/supabase-js
pnpm add -D tailwindcss @tailwindcss/vite vitest @vitest/coverage-v8 jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  vite-plugin-pwa supabase
```

- [ ] **Step 3: Configurar Vite con Tailwind y Vitest**

Reemplazar `vite.config.ts` completo:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
})
```

Si TypeScript marca error en la propiedad `test`, cambiar la primera línea a `import { defineConfig } from 'vitest/config'` y eliminar la importación de `vite`.

- [ ] **Step 4: Crear el archivo de setup de pruebas**

Crear `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Declarar los tokens de color y la variante oscura**

Reemplazar `src/index.css` completo. Los tokens son la única fuente de color de la aplicación; ningún componente escribe un color literal:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-surface: #ffffff;
  --color-surface-raised: #f4f4f5;
  --color-border: #e4e4e7;
  --color-content: #18181b;
  --color-content-muted: #52525b;
  --color-brand: #1d4ed8;
  --color-brand-content: #ffffff;
}

.dark {
  --color-surface: #09090b;
  --color-surface-raised: #18181b;
  --color-border: #27272a;
  --color-content: #fafafa;
  --color-content-muted: #a1a1aa;
  --color-brand: #3b82f6;
  --color-brand-content: #0b1120;
}

html, body, #root {
  height: 100%;
}

body {
  background-color: var(--color-surface);
  color: var(--color-content);
}
```

- [ ] **Step 6: Escribir la prueba que falla**

Crear `src/shared/formatWeight.test.ts`. Esta utilidad existe para verificar que la tubería de pruebas funciona y porque el formato de peso se usará en cada pantalla de registro:

```typescript
import { describe, it, expect } from 'vitest'
import { formatWeight } from './formatWeight'

describe('formatWeight', () => {
  it('omite decimales en pesos enteros', () => {
    expect(formatWeight(60)).toBe('60 kg')
  })

  it('conserva un decimal cuando lo hay', () => {
    expect(formatWeight(62.5)).toBe('62.5 kg')
  })

  it('redondea a un decimal', () => {
    expect(formatWeight(62.55)).toBe('62.6 kg')
  })

  it('representa el peso corporal como cero', () => {
    expect(formatWeight(0)).toBe('0 kg')
  })
})
```

- [ ] **Step 7: Añadir los scripts de pnpm y ejecutar la prueba para verla fallar**

En `package.json`, dentro de `"scripts"`, añadir:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Ejecutar:

```bash
pnpm test
```
Esperado: FALLA con un error de resolución, `Failed to resolve import "./formatWeight"`.

- [ ] **Step 8: Escribir la implementación mínima**

Crear `src/shared/formatWeight.ts`:

```typescript
export function formatWeight(kg: number): string {
  const rounded = Math.round(kg * 10) / 10
  return `${rounded} kg`
}
```

- [ ] **Step 9: Ejecutar la prueba y verificar que pasa**

```bash
pnpm test
```
Esperado: PASA, 4 pruebas.

- [ ] **Step 10: Verificar que el servidor de desarrollo levanta**

```bash
pnpm dev
```
Esperado: imprime una URL local. Abrirla muestra la página por defecto de Vite. Detener con Ctrl-C.

- [ ] **Step 11: Proteger los secretos antes del primer commit**

Añadir al final de `.gitignore`:

```
.env
.env.local
.env.*.local
```

Crear `.env.example`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript with Tailwind 4 and Vitest"
```

---

### Task 2: Tema claro y oscuro

**Files:**
- Create: `src/features/theme/theme-storage.ts`, `src/features/theme/ThemeProvider.tsx`, `src/features/theme/useTheme.ts`, `src/features/theme/ThemeToggle.tsx`
- Test: `src/features/theme/theme-storage.test.ts`, `src/features/theme/ThemeToggle.test.tsx`
- Modify: `src/main.tsx`, `index.html`

**Interfaces:**
- Consumes: los tokens de color de `src/index.css` (Task 1) y la variante `dark` por clase.
- Produces:
  - `type ThemePreference = 'light' | 'dark' | 'system'`
  - `type ResolvedTheme = 'light' | 'dark'`
  - `readThemePreference(): ThemePreference`
  - `writeThemePreference(pref: ThemePreference): void`
  - `resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme`
  - `<ThemeProvider>` y `useTheme(): { preference, resolved, setPreference }`
  - `<ThemeToggle />`

- [ ] **Step 1: Escribir la prueba que falla para la capa de almacenamiento**

Crear `src/features/theme/theme-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  readThemePreference,
  writeThemePreference,
  resolveTheme,
} from './theme-storage'

describe('theme-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('usa "system" cuando no hay preferencia guardada', () => {
    expect(readThemePreference()).toBe('system')
  })

  it('lee la preferencia que se escribió', () => {
    writeThemePreference('dark')
    expect(readThemePreference()).toBe('dark')
  })

  it('ignora un valor corrupto en el almacenamiento', () => {
    localStorage.setItem('trainway:theme', 'banana')
    expect(readThemePreference()).toBe('system')
  })

  it('resuelve "system" según la preferencia del sistema operativo', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('la elección explícita gana sobre el sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
```

- [ ] **Step 2: Ejecutar la prueba para verla fallar**

```bash
pnpm test theme-storage
```
Esperado: FALLA, `Failed to resolve import "./theme-storage"`.

- [ ] **Step 3: Implementar la capa de almacenamiento**

Crear `src/features/theme/theme-storage.ts`. No importa React a propósito: así se prueba sin renderizar:

```typescript
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'trainway:theme'

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Modo privado del navegador: la preferencia se pierde al cerrar, no es un fallo.
  }
}

export function resolveTheme(
  pref: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}
```

- [ ] **Step 4: Ejecutar la prueba y verificar que pasa**

```bash
pnpm test theme-storage
```
Esperado: PASA, 5 pruebas.

- [ ] **Step 5: Implementar el proveedor y el hook**

Crear `src/features/theme/ThemeProvider.tsx`:

```typescript
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import {
  readThemePreference,
  writeThemePreference,
  resolveTheme,
  type ThemePreference,
  type ResolvedTheme,
} from './theme-storage'

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference)
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(preference, systemPrefersDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  const setPreference = useCallback((pref: ThemePreference) => {
    writeThemePreference(pref)
    setPreferenceState(pref)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
```

Crear `src/features/theme/useTheme.ts`:

```typescript
import { useContext } from 'react'
import { ThemeContext } from './ThemeProvider'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme requiere un ThemeProvider por encima')
  return context
}
```

- [ ] **Step 6: Escribir la prueba que falla para el control de interfaz**

Crear `src/features/theme/ThemeToggle.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('aplica la clase dark al elegir el tema oscuro', async () => {
    const user = userEvent.setup()
    renderToggle()
    await user.click(screen.getByRole('button', { name: /oscuro/i }))
    expect(document.documentElement).toHaveClass('dark')
  })

  it('quita la clase dark al volver al tema claro', async () => {
    const user = userEvent.setup()
    renderToggle()
    await user.click(screen.getByRole('button', { name: /oscuro/i }))
    await user.click(screen.getByRole('button', { name: /claro/i }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('persiste la elección entre montajes', async () => {
    const user = userEvent.setup()
    const { unmount } = renderToggle()
    await user.click(screen.getByRole('button', { name: /oscuro/i }))
    unmount()
    renderToggle()
    expect(document.documentElement).toHaveClass('dark')
  })
})
```

- [ ] **Step 7: Ejecutar la prueba para verla fallar**

```bash
pnpm test ThemeToggle
```
Esperado: FALLA, `Failed to resolve import "./ThemeToggle"`.

Nota: jsdom no implementa `window.matchMedia`. Si el error es `window.matchMedia is not a function`, añadir al final de `tests/setup.ts`:

```typescript
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
```

- [ ] **Step 8: Implementar el control**

Crear `src/features/theme/ThemeToggle.tsx`:

```typescript
import { useTheme } from './useTheme'
import type { ThemePreference } from './theme-storage'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div
      role="group"
      aria-label="Tema"
      className="inline-flex rounded-lg border border-border bg-surface-raised p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setPreference(option.value)}
          aria-pressed={preference === option.value}
          className={
            preference === option.value
              ? 'rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-content'
              : 'rounded-md px-3 py-1.5 text-sm font-medium text-content-muted'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Ejecutar la prueba y verificar que pasa**

```bash
pnpm test ThemeToggle
```
Esperado: PASA, 3 pruebas.

- [ ] **Step 10: Montar el proveedor y evitar el parpadeo inicial**

Reemplazar `src/main.tsx` completo:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './features/theme/ThemeProvider'
import { ThemeToggle } from './features/theme/ThemeToggle'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-3xl font-bold text-content">Trainway</h1>
        <ThemeToggle />
      </main>
    </ThemeProvider>
  </StrictMode>,
)
```

En `index.html`, cambiar el `<title>` a `Trainway` y añadir dentro de `<head>`, antes de cualquier hoja de estilo, un script que aplica el tema antes del primer pintado. Sin esto la pantalla destella en blanco antes de ponerse oscura:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem('trainway:theme')
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      var dark = stored === 'dark' || (stored !== 'light' && prefersDark)
      if (dark) document.documentElement.classList.add('dark')
    } catch (e) {}
  })()
</script>
```

- [ ] **Step 11: Verificar los dos temas a ojo**

```bash
pnpm dev
```
Abrir la URL. Pulsar Claro, Oscuro y Sistema. Esperado: fondo, texto y botón activo cambian en los tres casos, el texto se lee en ambos temas, y al recargar con Oscuro elegido la página **no** destella en blanco. Detener con Ctrl-C.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add light and dark theme with persisted preference"
```

---

### Task 3: Supabase local y tabla de perfiles con RLS

**Files:**
- Create: `supabase/config.toml` (generado), `supabase/migrations/0001_profiles.sql`
- Create: `tests/rls/client.ts`, `tests/rls/profiles.test.ts`
- Modify: `package.json` (scripts), `.env.example`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces:
  - Tabla `public.profiles` con columnas `id`, `username`, `display_name`, `avatar_url`, `created_at`, `updated_at`.
  - Trigger que inserta una fila en `profiles` al crearse un usuario en `auth.users`.
  - Ayudantes de prueba: `adminClient(): SupabaseClient`, `createTestUser(email: string): Promise<{ id: string; client: SupabaseClient }>`, `anonClient(): SupabaseClient`.

- [ ] **Step 1: Inicializar Supabase y levantarlo**

```bash
pnpm supabase init
pnpm supabase start
```
Esperado: la primera vez descarga imágenes de Docker (varios minutos). Al terminar imprime `API URL`, `anon key` y `service_role key`.

- [ ] **Step 2: Guardar las credenciales locales**

```bash
pnpm supabase status
```

Crear `.env.local` con los valores impresos:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key de la salida>
SUPABASE_SERVICE_ROLE_KEY=<service_role key de la salida>
```

**Seguridad:** `SUPABASE_SERVICE_ROLE_KEY` no lleva el prefijo `VITE_` a propósito. Vite solo expone al navegador las variables con ese prefijo; sin él, la clave nunca puede filtrarse al paquete del cliente aunque alguien la importe por error. Confirmar que `.env.local` está ignorado:

```bash
git check-ignore -v .env.local
```
Esperado: imprime la regla de `.gitignore` que lo cubre. Si no imprime nada, **detenerse** y arreglar `.gitignore` antes de continuar.

Añadir a `.env.example` la tercera línea:

```
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Escribir la migración**

Crear `supabase/migrations/0001_profiles.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (
    username is null or username ~ '^[a-z0-9_]{3,20}$'
  )
);

alter table public.profiles enable row level security;

-- El username es público a propósito: es como los amigos se encuentran entre sí.
create policy profiles_select_all
  on public.profiles for select
  using (true);

create policy profiles_insert_own
  on public.profiles for insert
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Al crearse un usuario en auth.users nace su perfil. Sin esto la aplicación
-- tendría que crear el perfil desde el cliente, que es más frágil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Aplicar la migración**

```bash
pnpm supabase db reset
```
Esperado: recrea la base y aplica `0001_profiles.sql` sin errores.

- [ ] **Step 5: Escribir los ayudantes de prueba**

Crear `tests/rls/client.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON)
}

export function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Crea un usuario confirmado y devuelve un cliente que actúa como él.
 * La contraseña es fija porque solo existe dentro de la base local de pruebas.
 */
export async function createTestUser(email: string) {
  const password = 'test-password-123456'
  const admin = adminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: data.user!.id, client }
}
```

- [ ] **Step 6: Escribir las pruebas de RLS que fallan**

Crear `tests/rls/profiles.test.ts`. La primera línea fija el entorno a Node: estas pruebas hablan con Postgres, no con el DOM.

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de profiles', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    const stamp = Date.now()
    alice = await createTestUser(`alice-${stamp}@trainway.test`)
    bob = await createTestUser(`bob-${stamp}@trainway.test`)
  }, 30_000)

  it('crea un perfil automáticamente al registrarse un usuario', async () => {
    const { data, error } = await adminClient()
      .from('profiles')
      .select('id')
      .eq('id', alice.id)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(alice.id)
  })

  it('permite al usuario actualizar su propio perfil', async () => {
    const { data, error } = await alice.client
      .from('profiles')
      .update({ username: `alice_${Date.now().toString().slice(-6)}` })
      .eq('id', alice.id)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('impide a un usuario modificar el perfil de otro', async () => {
    const { data, error } = await bob.client
      .from('profiles')
      .update({ username: 'secuestrado' })
      .eq('id', alice.id)
      .select()

    // RLS no lanza error: filtra la fila. Cero filas afectadas es el éxito.
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('rechaza un username con formato inválido', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ username: 'MAYÚSCULAS Y ESPACIOS' })
      .eq('id', alice.id)

    expect(error).not.toBeNull()
  })

  it('rechaza un username duplicado', async () => {
    const shared = `dup_${Date.now().toString().slice(-6)}`
    await alice.client.from('profiles').update({ username: shared }).eq('id', alice.id)

    const { error } = await bob.client
      .from('profiles')
      .update({ username: shared })
      .eq('id', bob.id)

    expect(error).not.toBeNull()
  })

  it('deja leer los perfiles a un visitante sin sesión', async () => {
    const { error } = await anonClient().from('profiles').select('username').limit(1)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 7: Hacer que Vitest cargue `.env.local` y ejecutar para ver fallar**

En `vite.config.ts`, añadir `import { loadEnv } from 'vite'` y envolver la configuración para exponer las variables al proceso de pruebas. Reemplazar el archivo completo:

```typescript
import { defineConfig, loadEnv } from 'vite'
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
```

Añadir a los scripts de `package.json`:

```json
"test:rls": "vitest run tests/rls",
"db:reset": "supabase db reset",
"db:start": "supabase start",
"db:stop": "supabase stop"
```

Ejecutar:

```bash
pnpm test:rls
```
Esperado: PASA, 6 pruebas. La migración ya se aplicó en el Step 4, así que este paso confirma que las pruebas corren y que las políticas hacen lo que dicen. Si falla con `fetch failed`, Supabase no está levantado: ejecutar `pnpm db:start`. Si falla porque `SUPABASE_SERVICE_ROLE_KEY` llega vacía, revisar que `.env.local` exista y que `vite.config.ts` tenga el `loadEnv` de este paso.

- [ ] **Step 8: Verificar que las pruebas realmente prueban algo**

Comentar temporalmente la política `profiles_update_own` en la migración, aplicar y ejecutar:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: FALLA la prueba `permite al usuario actualizar su propio perfil`. Esto confirma que las pruebas detectan cambios en las políticas y no pasan por accidente. Descomentar, y volver a ejecutar:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: PASA, 6 pruebas.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add profiles table with RLS policies and isolation tests"
```

---

### Task 4: Autenticación y alta de username

**Files:**
- Create: `src/lib/supabase.ts`, `src/features/auth/auth-repository.ts`, `src/features/auth/AuthProvider.tsx`, `src/features/auth/useAuth.ts`, `src/features/auth/LoginPage.tsx`, `src/features/auth/RequireAuth.tsx`
- Create: `src/features/profile/profile-repository.ts`, `src/features/profile/UsernameOnboarding.tsx`
- Test: `src/features/auth/auth-repository.test.ts`, `src/features/profile/profile-repository.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `ThemeProvider` (Task 2); tabla `profiles` (Task 3).
- Produces:
  - `supabase: SupabaseClient` desde `src/lib/supabase.ts`
  - `signInWithEmail(email: string): Promise<{ error: string | null }>`
  - `signInWithGoogle(): Promise<{ error: string | null }>`
  - `signOut(): Promise<void>`
  - `useAuth(): { session: Session | null; loading: boolean }`
  - `<RequireAuth>` que redirige a `/login` sin sesión
  - `fetchProfile(userId: string)`, `setUsername(userId: string, username: string)`
  - `validateUsername(value: string): string | null` — devuelve el mensaje de error o `null` si es válido

- [ ] **Step 1: Crear el cliente de Supabase**

Crear `src/lib/supabase.ts`. Este archivo es el único punto del cliente que conoce las credenciales:

```typescript
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
  },
})
```

- [ ] **Step 2: Escribir la prueba que falla para la validación de username**

Crear `src/features/profile/profile-repository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateUsername } from './profile-repository'

describe('validateUsername', () => {
  it('acepta un username válido', () => {
    expect(validateUsername('gerardo_99')).toBeNull()
  })

  it('rechaza menos de 3 caracteres', () => {
    expect(validateUsername('ab')).toMatch(/3/)
  })

  it('rechaza más de 20 caracteres', () => {
    expect(validateUsername('a'.repeat(21))).toMatch(/20/)
  })

  it('rechaza mayúsculas', () => {
    expect(validateUsername('Gerardo')).not.toBeNull()
  })

  it('rechaza espacios y símbolos', () => {
    expect(validateUsername('ger ardo')).not.toBeNull()
    expect(validateUsername('gerardo!')).not.toBeNull()
  })

  it('rechaza el valor vacío', () => {
    expect(validateUsername('')).not.toBeNull()
  })
})
```

- [ ] **Step 3: Ejecutar la prueba para verla fallar**

```bash
pnpm test profile-repository
```
Esperado: FALLA, `Failed to resolve import "./profile-repository"`.

- [ ] **Step 4: Implementar el repositorio de perfil**

Crear `src/features/profile/profile-repository.ts`. Las reglas de validación son las mismas que la restricción `username_format` de la migración; se duplican aquí para dar un mensaje útil antes de ir al servidor, y el servidor sigue siendo la autoridad:

```typescript
import { supabase } from '../../lib/supabase'

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export function validateUsername(value: string): string | null {
  if (value.length < 3) return 'El username necesita al menos 3 caracteres'
  if (value.length > 20) return 'El username no puede pasar de 20 caracteres'
  if (!/^[a-z0-9_]+$/.test(value)) {
    return 'Solo minúsculas, números y guion bajo'
  }
  return null
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function setUsername(
  userId: string,
  username: string,
): Promise<{ error: string | null }> {
  const invalid = validateUsername(username)
  if (invalid) return { error: invalid }

  const { error } = await supabase
    .from('profiles')
    .update({ username, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (!error) return { error: null }
  // 23505 es violación de unicidad en Postgres.
  if (error.code === '23505') return { error: 'Ese username ya está tomado' }
  return { error: 'No se pudo guardar el username' }
}
```

- [ ] **Step 5: Ejecutar la prueba y verificar que pasa**

```bash
pnpm test profile-repository
```
Esperado: PASA, 6 pruebas.

- [ ] **Step 6: Escribir la prueba que falla para el repositorio de autenticación**

Crear `src/features/auth/auth-repository.test.ts`. Se simula el cliente de Supabase: aquí se prueba la traducción de errores, no la red:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
const signOutMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}))

const { signInWithEmail, signInWithGoogle, signOut } = await import('./auth-repository')

describe('auth-repository', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    signInWithOAuth.mockReset()
    signOutMock.mockReset()
  })

  it('devuelve error sin llamar al servidor cuando el correo es inválido', async () => {
    const result = await signInWithEmail('no-es-correo')
    expect(result.error).not.toBeNull()
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('envía el magic link con un correo válido', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    const result = await signInWithEmail('gerardo@tradeway.mx')
    expect(result.error).toBeNull()
    expect(signInWithOtp).toHaveBeenCalledOnce()
  })

  it('traduce el fallo del servidor a un mensaje legible', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limit exceeded' } })
    const result = await signInWithEmail('gerardo@tradeway.mx')
    expect(result.error).toBe('No se pudo enviar el correo. Inténtalo en un minuto.')
  })

  it('pide a Supabase el flujo de Google', async () => {
    signInWithOAuth.mockResolvedValue({ error: null })
    await signInWithGoogle()
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })

  it('cierra sesión', async () => {
    signOutMock.mockResolvedValue({ error: null })
    await signOut()
    expect(signOutMock).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 7: Ejecutar la prueba para verla fallar**

```bash
pnpm test auth-repository
```
Esperado: FALLA, `Failed to resolve import "./auth-repository"`.

- [ ] **Step 8: Implementar el repositorio de autenticación**

Crear `src/features/auth/auth-repository.ts`:

```typescript
import { supabase } from '../../lib/supabase'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function signInWithEmail(email: string): Promise<{ error: string | null }> {
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Escribe un correo válido' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  })

  if (error) return { error: 'No se pudo enviar el correo. Inténtalo en un minuto.' }
  return { error: null }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })

  if (error) return { error: 'No se pudo abrir el acceso con Google' }
  return { error: null }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
```

- [ ] **Step 9: Ejecutar la prueba y verificar que pasa**

```bash
pnpm test auth-repository
```
Esperado: PASA, 5 pruebas.

- [ ] **Step 10: Implementar el proveedor de sesión**

Crear `src/features/auth/AuthProvider.tsx`:

```typescript
import { createContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

type AuthContextValue = { session: Session | null; loading: boolean }

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({ session, loading }), [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

Crear `src/features/auth/useAuth.ts`:

```typescript
import { useContext } from 'react'
import { AuthContext } from './AuthProvider'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth requiere un AuthProvider por encima')
  return context
}
```

- [ ] **Step 11: Implementar la pantalla de acceso y la guardia de rutas**

Crear `src/features/auth/LoginPage.tsx`:

```typescript
import { useState, type FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle } from './auth-repository'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setError(null)

    const result = await signInWithEmail(email)
    if (result.error) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold text-content">Trainway</h1>

      {status === 'sent' ? (
        <p className="max-w-sm text-center text-content-muted">
          Te enviamos un enlace a <strong className="text-content">{email}</strong>.
          Ábrelo en este dispositivo para entrar.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <label htmlFor="email" className="text-sm text-content-muted">
            Correo
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
            placeholder="tu@correo.com"
            autoComplete="email"
          />
          {error && <p className="text-sm text-content-muted">{error}</p>}
          <button
            type="submit"
            disabled={status === 'sending'}
            className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
          >
            {status === 'sending' ? 'Enviando…' : 'Enviar enlace de acceso'}
          </button>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="rounded-lg border border-border px-4 py-3 font-medium text-content"
          >
            Entrar con Google
          </button>
        </form>
      )}
    </main>
  )
}
```

Crear `src/features/auth/RequireAuth.tsx`:

```typescript
import { Navigate } from 'react-router'
import { useAuth } from './useAuth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-content-muted">
        Cargando…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

- [ ] **Step 12: Implementar el alta de username**

Crear `src/features/profile/UsernameOnboarding.tsx`:

```typescript
import { useState, type FormEvent } from 'react'
import { setUsername, validateUsername } from './profile-repository'

export function UsernameOnboarding({
  userId,
  onDone,
}: {
  userId: string
  onDone: () => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateUsername(value)
    if (invalid) {
      setError(invalid)
      return
    }

    setSaving(true)
    const result = await setUsername(userId, value)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }
    onDone()
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold text-content">Elige tu username</h1>
        <p className="mt-2 text-sm text-content-muted">
          Así te encuentran tus amigos para compartirte rutinas.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value.toLowerCase())}
          className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
          placeholder="gerardo_99"
          autoComplete="off"
          aria-label="Username"
        />
        {error && <p className="text-sm text-content-muted">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 13: Verificar el flujo completo a mano**

```bash
pnpm dev
```

Reemplazar temporalmente el contenido de `src/main.tsx` para montar el proveedor de autenticación y la pantalla de acceso:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './features/theme/ThemeProvider'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
```

Escribir un correo cualquiera y enviar. Abrir el buzón local de Supabase en `http://127.0.0.1:54324`. Esperado: aparece el correo con el enlace; al abrirlo, la aplicación queda con sesión iniciada.

Confirmar la sesión desde la consola del navegador. La clave que Supabase usa en `localStorage` depende del host del proyecto, así que se busca por prefijo en vez de adivinar el nombre:

```javascript
Object.keys(localStorage).filter((k) => k.startsWith('sb-'))
```
Esperado: devuelve al menos una clave terminada en `-auth-token`. Si devuelve un arreglo vacío, la sesión no se guardó.

El botón de Google **no funcionará en local** hasta configurar el proveedor en el panel de Supabase. Es esperado en esta tarea; se documenta en el README en la Task 5.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: add magic-link auth, session provider and username onboarding"
```

---

### Task 5: PWA instalable y armazón de navegación

**Files:**
- Create: `src/app/AppShell.tsx`, `src/app/routes.tsx`, `public/pwa-192.png`, `public/pwa-512.png`, `README.md`
- Test: `src/app/AppShell.test.tsx`
- Modify: `vite.config.ts`, `src/main.tsx`, `index.html`

**Interfaces:**
- Consumes: `ThemeProvider`, `ThemeToggle` (Task 2); `AuthProvider`, `RequireAuth`, `LoginPage` (Task 4); `fetchProfile`, `UsernameOnboarding` (Task 4).
- Produces: `<AppShell />` con navegación inferior de cuatro destinos y `router` exportado desde `src/app/routes.tsx`. Aplicación instalable con service worker registrado.

- [ ] **Step 1: Escribir la prueba que falla para el armazón**

Crear `src/app/AppShell.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShell } from './AppShell'

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('muestra los cuatro destinos', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Entrenar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rutinas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Progreso' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
  })

  it('marca el destino activo para lectores de pantalla', () => {
    renderShell('/rutinas')
    expect(screen.getByRole('link', { name: 'Rutinas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Entrenar' })).not.toHaveAttribute(
      'aria-current',
    )
  })
})
```

- [ ] **Step 2: Ejecutar la prueba para verla fallar**

```bash
pnpm test AppShell
```
Esperado: FALLA, `Failed to resolve import "./AppShell"`.

- [ ] **Step 3: Implementar el armazón**

Crear `src/app/AppShell.tsx`:

```typescript
import { NavLink, Outlet } from 'react-router'

const DESTINATIONS = [
  { to: '/', label: 'Entrenar', end: true },
  { to: '/rutinas', label: 'Rutinas', end: false },
  { to: '/progreso', label: 'Progreso', end: false },
  { to: '/perfil', label: 'Perfil', end: false },
]

export function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface-raised"
      >
        <ul className="mx-auto flex max-w-lg">
          {DESTINATIONS.map((destination) => (
            <li key={destination.to} className="flex-1">
              <NavLink
                to={destination.to}
                end={destination.end}
                className={({ isActive }) =>
                  isActive
                    ? 'block py-3 text-center text-sm font-medium text-brand'
                    : 'block py-3 text-center text-sm font-medium text-content-muted'
                }
              >
                {destination.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
```

`NavLink` pone `aria-current="page"` en el enlace activo por su cuenta. No fijarlo a mano: hacerlo rompe la segunda prueba, que verifica justamente que el atributo aparece solo en el destino activo.

- [ ] **Step 4: Ejecutar la prueba y verificar que pasa**

```bash
pnpm test AppShell
```
Esperado: PASA, 2 pruebas.

- [ ] **Step 5: Definir las rutas**

Crear `src/app/routes.tsx`. Las cuatro pantallas son marcadores de posición porque su contenido llega en los planes 3 a 6; el armazón y las rutas sí quedan terminados aquí:

```typescript
import { createBrowserRouter } from 'react-router'
import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { signOut } from '../features/auth/auth-repository'

function Placeholder({ title }: { title: string }) {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold text-content">{title}</h1>
      <p className="mt-2 text-content-muted">Próximamente.</p>
    </section>
  )
}

function ProfilePage() {
  return (
    <section className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-content">Perfil</h1>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-content-muted">Tema</span>
        <ThemeToggle />
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="self-start rounded-lg border border-border px-4 py-2 text-content"
      >
        Cerrar sesión
      </button>
    </section>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Placeholder title="Entrenar" /> },
      { path: 'rutinas', element: <Placeholder title="Rutinas" /> },
      { path: 'progreso', element: <Placeholder title="Progreso" /> },
      { path: 'perfil', element: <ProfilePage /> },
    ],
  },
])
```

- [ ] **Step 6: Conectar el alta de username al arranque**

Reemplazar `src/main.tsx` completo. El componente `Gate` decide entre pedir username y mostrar la aplicación:

```typescript
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './features/theme/ThemeProvider'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/useAuth'
import { fetchProfile } from './features/profile/profile-repository'
import { UsernameOnboarding } from './features/profile/UsernameOnboarding'
import { router } from './app/routes'
import './index.css'

const queryClient = new QueryClient()

function Gate() {
  const { session, loading } = useAuth()
  const [needsUsername, setNeedsUsername] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) {
      setNeedsUsername(null)
      return
    }
    fetchProfile(session.user.id)
      .then((profile) => setNeedsUsername(!profile?.username))
      .catch(() => setNeedsUsername(false))
  }, [session])

  if (!loading && session && needsUsername === true) {
    return (
      <UsernameOnboarding
        userId={session.user.id}
        onDone={() => setNeedsUsername(false)}
      />
    )
  }

  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
```

- [ ] **Step 7: Configurar la PWA**

Reemplazar `vite.config.ts` completo:

```typescript
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
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
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      css: true,
    },
  }
})
```

- [ ] **Step 8: Generar los iconos provisionales**

El logo definitivo lo entrega Gerardo. Mientras tanto, generar dos cuadrados con la inicial para que el manifiesto sea válido:

```bash
python3 - <<'PY'
from pathlib import Path
import struct, zlib

def png(path, size, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * size for _ in range(size))
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))
    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    Path(path).write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', header)
        + chunk(b'IDAT', zlib.compress(raw))
        + chunk(b'IEND', b'')
    )

png('public/pwa-192.png', 192, (29, 78, 216))
png('public/pwa-512.png', 512, (29, 78, 216))
print('iconos provisionales generados')
PY
```
Esperado: imprime `iconos provisionales generados` y aparecen los dos archivos.

- [ ] **Step 9: Verificar la compilación de producción y la instalabilidad**

```bash
pnpm build && pnpm preview
```
Esperado: la compilación termina sin errores y `vite-plugin-pwa` reporta los archivos precacheados. Abrir la URL de vista previa, y en las herramientas de desarrollo del navegador, pestaña Application: el manifiesto muestra nombre `Trainway` con sus iconos, y hay un service worker activo. Detener con Ctrl-C.

- [ ] **Step 10: Escribir el README**

Crear `README.md`:

````markdown
# Trainway

Registra tus entrenos de gimnasio y comparte rutinas con tus amigos. PWA instalable.

## Requisitos

- Node 24+
- pnpm 11+
- Docker en marcha (para Supabase local)

## Puesta en marcha

```bash
pnpm install
pnpm supabase start
pnpm supabase status   # copia las claves al paso siguiente
cp .env.example .env.local
# llenar VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
pnpm db:reset
pnpm dev
```

Los correos de acceso no salen a internet en local: se leen en el buzón de
pruebas en <http://127.0.0.1:54324>.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Compilación de producción |
| `pnpm test` | Toda la suite |
| `pnpm test:rls` | Solo las pruebas de aislamiento de la base |
| `pnpm db:reset` | Recrea la base local y aplica las migraciones |

## Acceso con Google

Funciona en producción una vez configurado el proveedor Google en el panel de
Supabase (Authentication → Providers → Google) con las credenciales de OAuth de
Google Cloud. En local el botón existe pero no completa el flujo.

## Seguridad

`SUPABASE_SERVICE_ROLE_KEY` no lleva prefijo `VITE_`, así que Vite nunca la
incluye en el paquete del navegador. Se usa solo en las pruebas de RLS. Si
alguna vez aparece con prefijo `VITE_`, es un defecto grave: rotar la clave.
````

- [ ] **Step 11: Ejecutar la suite completa**

Supabase tiene que estar levantado: la suite completa incluye las pruebas de RLS, que hablan con Postgres.

```bash
pnpm db:start && pnpm test
```
Esperado: PASAN todas las pruebas de las cinco tareas — `formatWeight` (4), `theme-storage` (5), `ThemeToggle` (3), `profile-repository` (6), `auth-repository` (5), `AppShell` (2), y RLS de `profiles` (6). Total 31.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest, service worker, navigation shell and README"
```

---

## Al terminar este plan

La aplicación arranca, se instala en el teléfono, respeta el tema del sistema con opción de forzarlo, permite entrar por magic link, pide username la primera vez, y muestra los cuatro destinos con la sesión protegida. La base local tiene `profiles` con RLS verificado por pruebas que fallan si se rompe una política.

Siguiente plan: **Plan 2 — Catálogo de ejercicios**, que siembra Free Exercise DB en `exercises` y sube las imágenes a Supabase Storage.
