# Trainway — Plan 2: Catálogo de ejercicios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener en la base los ~800 ejercicios de Free Exercise DB con sus imágenes, disponibles sin conexión, y una pantalla para buscarlos por nombre y por músculo.

**Architecture:** El catálogo es estático y compartido: vive en `public.exercises` con lectura pública y escritura reservada al dueño para los ejercicios propios. Las imágenes se suben una sola vez a Supabase Storage, así producción no depende de un repositorio de GitHub ajeno. Como el catálogo cambia poco y pesa poco, el cliente lo cachea completo en IndexedDB y busca en local — sin ida y vuelta al servidor por cada tecla.

**Tech Stack:** Postgres + RLS, Supabase Storage, Dexie (IndexedDB), TanStack Query, React + TypeScript, Vitest.

## Contexto: qué existe ya

Planes 1 y 1b completos y fusionados en `main`:

- Vite 7 + React 19 + TypeScript + Tailwind 4, PWA instalable, tema claro/oscuro por tokens `--color-*` (marca `#FFC603`, contenido sobre marca `#18181b`, y `--color-danger` en ambos temas).
- Supabase local sobre Docker. `public.profiles` con RLS probado. `public.email_for_username` y `public.username_available`.
- Autenticación: magic link con PKCE, y contraseña con identificador dual vía la Edge Function `sign-in`.
- Armazón de navegación con cuatro destinos — Entrenar, Rutinas, Progreso, Perfil — bajo `RequireAuth`, con ruta comodín y `errorElement`.
- Organización por dominio en `src/features/`. **La interfaz nunca llama a Supabase directamente**: cada feature expone un repositorio y las pantallas consumen esa interfaz.
- Vitest en tres proyectos: `unit` (jsdom, `pnpm test`, corre sin Docker y sin variables de entorno), `rls` (node, `pnpm test:rls`), `edge` (node, `pnpm test:edge`, requiere `supabase functions serve`).
- `tsconfig.app.json` cubre `src` y `tests` excepto `tests/rls` y `tests/edge`, con `types: ["vite/client"]` — `process` no compila en `src/` a propósito.

## Global Constraints

- Gestor de paquetes: **pnpm**. `npm`, `npx` y `yarn` están bloqueados; el equivalente de `npx foo` es `pnpm exec foo`.
- **Ningún secreto en el cliente.** Bajo `src/` solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` vive en `tests/` y en scripts de servidor bajo `scripts/`, nunca en `src/`, y `src/` nunca referencia `process.env`.
- **`pnpm test` debe seguir pasando con `.env.local` ausente.** Tres tareas anteriores lo arreglaron; una regresión aquí es un defecto importante.
- **Los tres proyectos de Vitest se conservan.** No colapsar ni reescribir `unit`, `rls` ni `edge`.
- Toda tabla nueva lleva RLS habilitado en la migración que la crea, con grants explícitos por rol. Depender de un grant por defecto es un defecto.
- Todo color viene de un token `--color-*` vía clase de Tailwind. Ninguna pantalla escribe un color literal. Cada pantalla nueva se verifica en tema claro y oscuro.
- Nombre del producto: **Trainway**. Interfaz en español, identificadores en inglés.
- TDD: la prueba que falla se escribe y se ejecuta antes de la implementación.
- **La licencia del dataset se respeta y se declara.** Free Exercise DB es de dominio público (Unlicense), pero la atribución va en el README de todos modos.

---

## Estructura de archivos

```
supabase/
  migrations/
    0005_exercises.sql          # tabla exercises, RLS, grants, bucket de Storage
scripts/
  seed-exercises.ts             # descarga el dataset, inserta filas, sube imágenes
src/
  lib/
    db.ts                       # esquema de Dexie (IndexedDB)
  features/
    exercises/
      exercise-types.ts         # el tipo Exercise, sin dependencias
      exercise-repository.ts    # única puerta a Supabase para ejercicios
      exercise-cache.ts         # sincronía del catálogo con IndexedDB
      searchExercises.ts        # filtrado puro: nombre + músculo, sin React
      ExerciseList.tsx          # lista con imagen, nombre y músculo
      ExerciseSearch.tsx        # campo de búsqueda + filtro de músculo
      ExercisesPage.tsx         # pantalla /ejercicios
tests/
  rls/
    exercises.test.ts           # aislamiento de ejercicios propios
```

Regla de decomposición: `searchExercises.ts` y `exercise-types.ts` no importan React ni Supabase, así el filtrado se prueba en aislamiento y rápido.

---

### Task 1: Tabla de ejercicios con RLS

**Files:**
- Create: `supabase/migrations/0005_exercises.sql`, `tests/rls/exercises.test.ts`

**Interfaces:**
- Consumes: `public.profiles` y el patrón de grants explícitos de `0001_profiles.sql`.
- Produces: tabla `public.exercises`; bucket de Storage `exercise-images` con lectura pública.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0005_exercises.sql`:

```sql
create table public.exercises (
  id text primary key,
  name text not null,
  category text,
  equipment text,
  force text,
  level text,
  mechanic text,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  instructions text[] not null default '{}',
  image_paths text[] not null default '{}',
  owner_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Los ejercicios del catálogo tienen owner_id nulo y los ve todo el mundo.
-- Un ejercicio propio solo lo ve y edita su dueño.
create index exercises_owner_id_idx on public.exercises (owner_id);
create index exercises_name_idx on public.exercises (lower(name));

alter table public.exercises enable row level security;

create policy exercises_select_global_or_own
  on public.exercises for select
  using (owner_id is null or auth.uid() = owner_id);

create policy exercises_insert_own
  on public.exercises for insert
  with check (auth.uid() = owner_id and owner_id is not null);

create policy exercises_update_own
  on public.exercises for update
  using (auth.uid() = owner_id and owner_id is not null)
  with check (auth.uid() = owner_id and owner_id is not null);

create policy exercises_delete_own
  on public.exercises for delete
  using (auth.uid() = owner_id and owner_id is not null);

-- Los grants son la primera capa: sin ellos las políticas no conceden nada,
-- porque esta versión de Supabase ya no expone tablas nuevas automáticamente.
grant select on public.exercises to anon;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.exercises to service_role;

-- Bucket público: las imágenes del catálogo no son secretas y se sirven por CDN.
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;
```

Nota sobre las políticas de escritura: exigen `owner_id is not null` además de la igualdad con `auth.uid()`. Sin esa condición, `auth.uid() = owner_id` con `owner_id` nulo evalúa a `NULL`, que no es verdadero — funcionaría igual, pero declararlo explícito deja claro que un usuario nunca puede crear ni tocar un ejercicio del catálogo global.

- [ ] **Step 2: Aplicar la migración**

```bash
pnpm db:reset
```
Esperado: aplica `0001` a `0005` sin errores.

- [ ] **Step 3: Escribir las pruebas que fallan**

Crear `tests/rls/exercises.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de exercises', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>
  let globalId: string
  let aliceExerciseId: string

  beforeAll(async () => {
    const stamp = Date.now().toString().slice(-6)
    alice = await createTestUser(`ex-alice-${stamp}@trainway.test`)
    bob = await createTestUser(`ex-bob-${stamp}@trainway.test`)

    globalId = `global_${stamp}`
    aliceExerciseId = `alice_${stamp}`

    const admin = adminClient()
    const { error } = await admin.from('exercises').insert([
      { id: globalId, name: 'Sentadilla global', owner_id: null },
      { id: aliceExerciseId, name: 'Ejercicio de Alice', owner_id: alice.id },
    ])
    if (error) throw error
  }, 30_000)

  it('deja leer el catálogo global a un visitante sin sesión', async () => {
    const { data, error } = await anonClient()
      .from('exercises')
      .select('id, name')
      .eq('id', globalId)
      .single()

    expect(error).toBeNull()
    expect(data?.name).toBe('Sentadilla global')
  })

  it('deja al dueño leer su propio ejercicio', async () => {
    const { data, error } = await alice.client
      .from('exercises')
      .select('id')
      .eq('id', aliceExerciseId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(aliceExerciseId)
  })

  it('esconde el ejercicio propio de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('exercises')
      .select('id')
      .eq('id', aliceExerciseId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('esconde el ejercicio propio de Alice a un visitante sin sesión', async () => {
    const { data, error } = await anonClient()
      .from('exercises')
      .select('id')
      .eq('id', aliceExerciseId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('impide a Bob modificar el ejercicio de Alice', async () => {
    const { data, error } = await bob.client
      .from('exercises')
      .update({ name: 'secuestrado' })
      .eq('id', aliceExerciseId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide a Bob borrar el ejercicio de Alice', async () => {
    const { data, error } = await bob.client
      .from('exercises')
      .delete()
      .eq('id', aliceExerciseId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide a un usuario modificar un ejercicio del catálogo global', async () => {
    const { data, error } = await alice.client
      .from('exercises')
      .update({ name: 'secuestrado' })
      .eq('id', globalId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide crear un ejercicio a nombre de otro usuario', async () => {
    const { error } = await bob.client.from('exercises').insert({
      id: `impostor_${Date.now().toString().slice(-6)}`,
      name: 'Impostor',
      owner_id: alice.id,
    })

    expect(error?.code).toBe('42501')
  })

  it('impide crear un ejercicio global desde el cliente', async () => {
    const { error } = await alice.client.from('exercises').insert({
      id: `falso_global_${Date.now().toString().slice(-6)}`,
      name: 'Falso global',
      owner_id: null,
    })

    expect(error?.code).toBe('42501')
  })
})
```

- [ ] **Step 4: Ejecutar las pruebas**

```bash
pnpm test:rls
```
Esperado: PASAN las 9 nuevas más las 14 existentes. Total 23.

- [ ] **Step 5: Comprobar que las pruebas de aislamiento no son vacías**

Comentar temporalmente la política `exercises_select_global_or_own` y sustituirla por `using (true)`:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: FALLAN `esconde el ejercicio propio de Alice a Bob` y `esconde el ejercicio propio de Alice a un visitante sin sesión`. Restaurar la política original y repetir:

```bash
pnpm db:reset && pnpm test:rls
```
Esperado: PASAN las 23.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_exercises.sql tests/rls/exercises.test.ts
git commit -m "feat: add exercises table with RLS and public image bucket"
```

---

### Task 2: Script de siembra desde Free Exercise DB

**Files:**
- Create: `scripts/seed-exercises.ts`
- Modify: `package.json` (script `seed:exercises`), `tsconfig.node.json` (incluir `scripts`), `README.md`

**Interfaces:**
- Consumes: la tabla `public.exercises` y el bucket `exercise-images` de la Task 1.
- Produces: comando `pnpm seed:exercises`, idempotente, que deja el catálogo poblado con sus imágenes.

- [ ] **Step 1: Inspeccionar el dataset real antes de escribir el mapeo**

**No asumas la forma de los datos.** Descarga el JSON y mira lo que hay:

```bash
curl -sL https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json -o /tmp/exercises.json
echo "total:"; python3 -c "import json;d=json.load(open('/tmp/exercises.json'));print(len(d))"
echo "claves:"; python3 -c "import json;d=json.load(open('/tmp/exercises.json'));print(sorted(d[0].keys()))"
echo "primer registro:"; python3 -c "import json;d=json.load(open('/tmp/exercises.json'));print(json.dumps(d[0],indent=2)[:800])"
echo "categorias:"; python3 -c "import json;d=json.load(open('/tmp/exercises.json'));print(sorted({e.get('category') for e in d}))"
```

Anota en tu reporte el número de ejercicios, las claves exactas y las categorías. **Si las claves no coinciden con las que asume el Step 3, ajusta el mapeo a lo que realmente hay y dilo en el reporte** — la forma del dataset manda sobre lo que este plan supone.

Comprobar también que una imagen existe y a qué URL responde:

```bash
python3 -c "import json;d=json.load(open('/tmp/exercises.json'));print(d[0].get('images'))"
curl -sI "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/$(python3 -c "import json;d=json.load(open('/tmp/exercises.json'));print(d[0]['images'][0])")" | head -1
```
Esperado: `HTTP/2 200`. Si da 404, encuentra la ruta correcta explorando el repositorio y anótala.

- [ ] **Step 2: Preparar el proyecto para scripts de servidor**

En `tsconfig.node.json`, añadir `"scripts"` al arreglo `include`, conservando lo que ya tenga.

En `package.json`, dentro de `"scripts"`, añadir:

```json
"seed:exercises": "vite-node scripts/seed-exercises.ts"
```

Instalar el ejecutor:

```bash
pnpm add -D vite-node
```

`vite-node` se elige porque ya hay configuración de Vite en el repositorio y respeta `loadEnv`, así el script lee `.env.local` sin trabajo extra.

- [ ] **Step 3: Escribir el script de siembra**

Crear `scripts/seed-exercises.ts`. Idempotente a propósito: se puede correr dos veces sin duplicar nada. Usa la clave de servicio porque inserta filas globales, que las políticas prohíben crear desde el cliente:

```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Llena .env.local con la salida de `pnpm supabase status`.',
  )
}

const DATASET_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const BUCKET = 'exercise-images'

// Ajustar estos nombres a lo que el Step 1 haya observado en el dataset real.
type RawExercise = {
  id: string
  name: string
  category?: string
  equipment?: string | null
  force?: string | null
  level?: string
  mechanic?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
  images?: string[]
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function fetchDataset(): Promise<RawExercise[]> {
  const response = await fetch(DATASET_URL)
  if (!response.ok) {
    throw new Error(`El dataset respondió ${response.status}`)
  }
  return response.json()
}

async function uploadImage(path: string): Promise<boolean> {
  const { data: existing } = await supabase.storage.from(BUCKET).list(dirname(path), {
    search: basename(path),
    limit: 1,
  })
  if (existing && existing.length > 0) return false

  const response = await fetch(`${IMAGE_BASE}/${path}`)
  if (!response.ok) {
    console.warn(`  imagen ${path} respondió ${response.status}, se omite`)
    return false
  }

  const body = new Uint8Array(await response.arrayBuffer())
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: response.headers.get('content-type') ?? 'image/jpeg',
    upsert: false,
  })

  if (error && !error.message.includes('already exists')) {
    console.warn(`  no se pudo subir ${path}: ${error.message}`)
    return false
  }
  return true
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function basename(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? path : path.slice(index + 1)
}

async function main() {
  console.log('Descargando el dataset…')
  const raw = await fetchDataset()
  console.log(`  ${raw.length} ejercicios`)

  const rows = raw.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    category: exercise.category ?? null,
    equipment: exercise.equipment ?? null,
    force: exercise.force ?? null,
    level: exercise.level ?? null,
    mechanic: exercise.mechanic ?? null,
    primary_muscles: exercise.primaryMuscles ?? [],
    secondary_muscles: exercise.secondaryMuscles ?? [],
    instructions: exercise.instructions ?? [],
    image_paths: exercise.images ?? [],
    owner_id: null,
  }))

  console.log('Insertando filas…')
  const CHUNK = 200
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK)
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'id' })
    if (error) throw error
    console.log(`  ${Math.min(index + CHUNK, rows.length)}/${rows.length}`)
  }

  console.log('Subiendo imágenes…')
  const paths = raw.flatMap((exercise) => exercise.images ?? [])
  let uploaded = 0
  let skipped = 0
  const PARALLEL = 8

  for (let index = 0; index < paths.length; index += PARALLEL) {
    const batch = paths.slice(index, index + PARALLEL)
    const results = await Promise.all(batch.map(uploadImage))
    uploaded += results.filter(Boolean).length
    skipped += results.filter((ok) => !ok).length
    if (index % 200 === 0) {
      console.log(`  ${index}/${paths.length} (${uploaded} subidas, ${skipped} omitidas)`)
    }
  }

  console.log(`Listo. ${rows.length} ejercicios, ${uploaded} imágenes subidas, ${skipped} omitidas.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 4: Ejecutar la siembra**

```bash
pnpm db:start
pnpm seed:exercises
```
Esperado: imprime el conteo del dataset, avanza por lotes y termina sin excepción. Tarda varios minutos por las imágenes; no lo interrumpas.

- [ ] **Step 5: Verificar el resultado**

```bash
pnpm supabase db diff --schema public > /dev/null 2>&1
psql "$(pnpm supabase status --output json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['DB_URL'])")" -c "select count(*) as ejercicios, count(*) filter (where cardinality(image_paths) > 0) as con_imagen from public.exercises;"
```

Si `psql` no está disponible, verificar con el cliente de JavaScript en un archivo temporal y borrarlo después. Esperado: el conteo coincide con el que reportó el Step 1, y la mayoría tiene al menos una imagen.

Comprobar que una imagen se sirve públicamente:

```bash
curl -sI "http://127.0.0.1:54321/storage/v1/object/public/exercise-images/<una-ruta-real>" | head -1
```
Esperado: `HTTP/1.1 200`.

- [ ] **Step 6: Verificar la idempotencia**

```bash
pnpm seed:exercises
```
Esperado: termina sin error, el conteo de ejercicios no cambia, y casi todas las imágenes se reportan omitidas porque ya estaban.

- [ ] **Step 7: Documentar en el README**

Añadir a `README.md` una sección explicando que `pnpm seed:exercises` puebla el catálogo, que tarda varios minutos la primera vez, y que el dataset es **Free Exercise DB** (<https://github.com/yuhonas/free-exercise-db>), de dominio público bajo la Unlicense. La atribución va aunque la licencia no la exija.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed-exercises.ts package.json pnpm-lock.yaml tsconfig.node.json README.md
git commit -m "feat: add idempotent exercise catalog seed script"
```

---

### Task 3: Repositorio, filtrado y cache local

**Files:**
- Create: `src/features/exercises/exercise-types.ts`, `src/features/exercises/searchExercises.ts`, `src/features/exercises/exercise-repository.ts`, `src/lib/db.ts`, `src/features/exercises/exercise-cache.ts`
- Test: `src/features/exercises/searchExercises.test.ts`, `src/features/exercises/exercise-repository.test.ts`

**Interfaces:**
- Consumes: la tabla `exercises` de la Task 1, poblada por la Task 2.
- Produces:
  - `type Exercise` con campos en camelCase
  - `searchExercises(all: Exercise[], query: string, muscle: string | null): Exercise[]`
  - `fetchAllExercises(): Promise<Exercise[]>`
  - `exerciseImageUrl(path: string): string`
  - `loadExercises(): Promise<Exercise[]>` — de IndexedDB si hay, del servidor si no, refrescando en segundo plano

- [ ] **Step 1: Instalar Dexie**

```bash
pnpm add dexie
```

- [ ] **Step 2: Definir el tipo**

Crear `src/features/exercises/exercise-types.ts`:

```typescript
export type Exercise = {
  id: string
  name: string
  category: string | null
  equipment: string | null
  force: string | null
  level: string | null
  mechanic: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  imagePaths: string[]
}
```

- [ ] **Step 3: Escribir la prueba que falla para el filtrado**

Crear `src/features/exercises/searchExercises.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { searchExercises } from './searchExercises'
import type { Exercise } from './exercise-types'

function make(partial: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    imagePaths: [],
    ...partial,
  }
}

const CATALOG: Exercise[] = [
  make({ id: '1', name: 'Sentadilla con barra', primaryMuscles: ['quadriceps'] }),
  make({ id: '2', name: 'Press de banca', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] }),
  make({ id: '3', name: 'Curl de bíceps', primaryMuscles: ['biceps'] }),
  make({ id: '4', name: 'Peso muerto', primaryMuscles: ['hamstrings'], secondaryMuscles: ['quadriceps'] }),
]

describe('searchExercises', () => {
  it('devuelve todo sin filtros', () => {
    expect(searchExercises(CATALOG, '', null)).toHaveLength(4)
  })

  it('busca por fragmento del nombre', () => {
    const found = searchExercises(CATALOG, 'press', null)
    expect(found.map((exercise) => exercise.id)).toEqual(['2'])
  })

  it('ignora mayúsculas y minúsculas', () => {
    expect(searchExercises(CATALOG, 'SENTADILLA', null)).toHaveLength(1)
  })

  it('ignora los acentos', () => {
    expect(searchExercises(CATALOG, 'biceps', null).map((e) => e.id)).toEqual(['3'])
    expect(searchExercises(CATALOG, 'bíceps', null).map((e) => e.id)).toEqual(['3'])
  })

  it('filtra por músculo primario', () => {
    expect(searchExercises(CATALOG, '', 'chest').map((e) => e.id)).toEqual(['2'])
  })

  it('incluye el músculo secundario en el filtro', () => {
    const found = searchExercises(CATALOG, '', 'quadriceps')
    expect(found.map((exercise) => exercise.id).sort()).toEqual(['1', '4'])
  })

  it('combina texto y músculo', () => {
    expect(searchExercises(CATALOG, 'peso', 'quadriceps').map((e) => e.id)).toEqual(['4'])
  })

  it('devuelve vacío cuando nada coincide', () => {
    expect(searchExercises(CATALOG, 'zancada', null)).toEqual([])
  })

  it('ignora espacios sobrantes en la consulta', () => {
    expect(searchExercises(CATALOG, '  press  ', null)).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Ejecutar para ver fallar**

```bash
pnpm test searchExercises
```
Esperado: FALLA, `Failed to resolve import "./searchExercises"`.

- [ ] **Step 5: Implementar el filtrado**

Crear `src/features/exercises/searchExercises.ts`. No importa React ni Supabase a propósito:

```typescript
import type { Exercise } from './exercise-types'

// El usuario escribe "biceps" tanto como "bíceps"; sin normalizar, la mitad
// de las búsquedas en español no encuentran nada.
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function searchExercises(
  all: Exercise[],
  query: string,
  muscle: string | null,
): Exercise[] {
  const needle = normalize(query)

  return all.filter((exercise) => {
    const matchesText = needle === '' || normalize(exercise.name).includes(needle)
    if (!matchesText) return false

    if (muscle === null) return true
    return (
      exercise.primaryMuscles.includes(muscle) ||
      exercise.secondaryMuscles.includes(muscle)
    )
  })
}
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

```bash
pnpm test searchExercises
```
Esperado: PASAN las 9.

- [ ] **Step 7: Escribir la prueba que falla para el repositorio**

Crear `src/features/exercises/exercise-repository.test.ts`. Simula el cliente de Supabase — **no importar el módulo real**, porque su guardia de variables de entorno rompería `pnpm test` en un clon limpio:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: (...args: unknown[]) => selectMock(...args) }),
  },
}))

vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')

const { fetchAllExercises, exerciseImageUrl } = await import('./exercise-repository')

describe('exercise-repository', () => {
  beforeEach(() => {
    selectMock.mockReset()
  })

  it('convierte las columnas snake_case del servidor a camelCase', async () => {
    selectMock.mockResolvedValue({
      data: [
        {
          id: 'squat',
          name: 'Sentadilla',
          category: 'strength',
          equipment: 'barbell',
          force: 'push',
          level: 'intermediate',
          mechanic: 'compound',
          primary_muscles: ['quadriceps'],
          secondary_muscles: ['glutes'],
          instructions: ['Baja', 'Sube'],
          image_paths: ['Squat/0.jpg'],
        },
      ],
      error: null,
    })

    const exercises = await fetchAllExercises()

    expect(exercises).toHaveLength(1)
    expect(exercises[0].primaryMuscles).toEqual(['quadriceps'])
    expect(exercises[0].secondaryMuscles).toEqual(['glutes'])
    expect(exercises[0].imagePaths).toEqual(['Squat/0.jpg'])
  })

  it('sustituye por arreglos vacíos las columnas nulas', async () => {
    selectMock.mockResolvedValue({
      data: [{ id: 'x', name: 'X', primary_muscles: null, image_paths: null }],
      error: null,
    })

    const exercises = await fetchAllExercises()

    expect(exercises[0].primaryMuscles).toEqual([])
    expect(exercises[0].imagePaths).toEqual([])
  })

  it('lanza cuando el servidor devuelve error', async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(fetchAllExercises()).rejects.toThrow()
  })

  it('arma la URL pública de una imagen', () => {
    expect(exerciseImageUrl('Squat/0.jpg')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/exercise-images/Squat/0.jpg',
    )
  })
})
```

- [ ] **Step 8: Ejecutar para ver fallar**

```bash
pnpm test exercise-repository
```
Esperado: FALLA, `Failed to resolve import "./exercise-repository"`.

- [ ] **Step 9: Implementar el repositorio**

Crear `src/features/exercises/exercise-repository.ts`:

```typescript
import { supabase } from '../../lib/supabase'
import type { Exercise } from './exercise-types'

const COLUMNS =
  'id, name, category, equipment, force, level, mechanic, primary_muscles, secondary_muscles, instructions, image_paths'

type ExerciseRow = {
  id: string
  name: string
  category: string | null
  equipment: string | null
  force: string | null
  level: string | null
  mechanic: string | null
  primary_muscles: string[] | null
  secondary_muscles: string[] | null
  instructions: string[] | null
  image_paths: string[] | null
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    equipment: row.equipment ?? null,
    force: row.force ?? null,
    level: row.level ?? null,
    mechanic: row.mechanic ?? null,
    primaryMuscles: row.primary_muscles ?? [],
    secondaryMuscles: row.secondary_muscles ?? [],
    instructions: row.instructions ?? [],
    imagePaths: row.image_paths ?? [],
  }
}

export async function fetchAllExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select(COLUMNS)
  if (error) throw new Error('No se pudo cargar el catálogo de ejercicios')
  return (data as ExerciseRow[]).map(toExercise)
}

export function exerciseImageUrl(path: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/exercise-images/${path}`
}
```

- [ ] **Step 10: Ejecutar y verificar que pasa**

```bash
pnpm test exercise-repository
```
Esperado: PASAN las 4.

- [ ] **Step 11: Implementar la cache local**

Crear `src/lib/db.ts`:

```typescript
import Dexie, { type EntityTable } from 'dexie'
import type { Exercise } from '../features/exercises/exercise-types'

// El catálogo es estático y cabe entero: cachearlo completo evita una ida y
// vuelta al servidor por cada tecla y hace que la búsqueda funcione sin red.
const db = new Dexie('trainway') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  meta: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  exercises: 'id, name',
  meta: 'key',
})

export { db }
```

Crear `src/features/exercises/exercise-cache.ts`:

```typescript
import { db } from '../../lib/db'
import { fetchAllExercises } from './exercise-repository'
import type { Exercise } from './exercise-types'

const CACHED_AT = 'exercises:cachedAt'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function refresh(): Promise<Exercise[]> {
  const fresh = await fetchAllExercises()
  await db.transaction('rw', db.exercises, db.meta, async () => {
    await db.exercises.clear()
    await db.exercises.bulkAdd(fresh)
    await db.meta.put({ key: CACHED_AT, value: String(Date.now()) })
  })
  return fresh
}

/**
 * Devuelve el catálogo, prefiriendo la copia local. Si la copia está vieja se
 * refresca en segundo plano: la pantalla pinta de inmediato con lo que hay y
 * se actualiza sola cuando llegan los datos nuevos.
 */
export async function loadExercises(): Promise<Exercise[]> {
  const cached = await db.exercises.toArray()

  if (cached.length === 0) return refresh()

  const stamp = await db.meta.get(CACHED_AT)
  const age = stamp ? Date.now() - Number(stamp.value) : Infinity
  if (age > MAX_AGE_MS) {
    // Sin await: no bloquea el primer pintado, y si falla por estar sin red
    // la copia local sigue sirviendo.
    void refresh().catch(() => {})
  }

  return cached
}
```

- [ ] **Step 12: Ejecutar la suite completa**

```bash
pnpm test
```
Esperado: PASAN todas. Verificar también con `.env.local` movido a un lado que sigue en verde.

- [ ] **Step 13: Commit**

```bash
git add src/features/exercises src/lib/db.ts package.json pnpm-lock.yaml
git commit -m "feat: add exercise repository, search and offline catalog cache"
```

---

### Task 4: Pantalla de ejercicios

**Files:**
- Create: `src/features/exercises/ExerciseList.tsx`, `src/features/exercises/ExerciseSearch.tsx`, `src/features/exercises/ExercisesPage.tsx`
- Test: `src/features/exercises/ExercisesPage.test.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Consumes: `loadExercises`, `searchExercises`, `exerciseImageUrl` de la Task 3.
- Produces: ruta `/ejercicios` bajo `RequireAuth`, enlazada desde la pantalla de Rutinas.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `src/features/exercises/ExercisesPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Exercise } from './exercise-types'

const loadExercises = vi.fn()

vi.mock('./exercise-cache', () => ({
  loadExercises: () => loadExercises(),
}))

vi.mock('./exercise-repository', () => ({
  exerciseImageUrl: (path: string) => `http://test/${path}`,
}))

const { ExercisesPage } = await import('./ExercisesPage')

function make(id: string, name: string, muscles: string[]): Exercise {
  return {
    id,
    name,
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: muscles,
    secondaryMuscles: [],
    instructions: [],
    imagePaths: [`${id}/0.jpg`],
  }
}

describe('ExercisesPage', () => {
  beforeEach(() => {
    loadExercises.mockReset()
  })

  it('muestra los ejercicios que carga', async () => {
    loadExercises.mockResolvedValue([
      make('1', 'Sentadilla con barra', ['quadriceps']),
      make('2', 'Press de banca', ['chest']),
    ])

    render(<ExercisesPage />)

    expect(await screen.findByText('Sentadilla con barra')).toBeInTheDocument()
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
  })

  it('filtra conforme el usuario escribe', async () => {
    loadExercises.mockResolvedValue([
      make('1', 'Sentadilla con barra', ['quadriceps']),
      make('2', 'Press de banca', ['chest']),
    ])

    const user = userEvent.setup()
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    await user.type(screen.getByLabelText(/buscar/i), 'press')

    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    expect(screen.queryByText('Sentadilla con barra')).not.toBeInTheDocument()
  })

  it('avisa cuando la búsqueda no encuentra nada', async () => {
    loadExercises.mockResolvedValue([make('1', 'Sentadilla con barra', ['quadriceps'])])

    const user = userEvent.setup()
    render(<ExercisesPage />)
    await screen.findByText('Sentadilla con barra')

    await user.type(screen.getByLabelText(/buscar/i), 'zancada')

    expect(screen.getByText(/ningún ejercicio/i)).toBeInTheDocument()
  })

  it('muestra un mensaje cuando la carga falla', async () => {
    loadExercises.mockRejectedValue(new Error('sin red'))

    render(<ExercisesPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo/i)
  })
})
```

- [ ] **Step 2: Ejecutar para ver fallar**

```bash
pnpm test ExercisesPage
```
Esperado: FALLA, `Failed to resolve import "./ExercisesPage"`.

- [ ] **Step 3: Implementar la lista**

Crear `src/features/exercises/ExerciseList.tsx`:

```typescript
import { exerciseImageUrl } from './exercise-repository'
import type { Exercise } from './exercise-types'

export function ExerciseList({ exercises }: { exercises: Exercise[] }) {
  if (exercises.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-content-muted">
        Ningún ejercicio coincide con tu búsqueda.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercises.map((exercise) => (
        <li
          key={exercise.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3"
        >
          {exercise.imagePaths[0] ? (
            <img
              src={exerciseImageUrl(exercise.imagePaths[0])}
              alt=""
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-md bg-surface" />
          )}

          <div className="min-w-0">
            <p className="truncate font-medium text-content">{exercise.name}</p>
            <p className="truncate text-sm text-content-muted">
              {exercise.primaryMuscles.join(', ') || 'Sin músculo registrado'}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

El `alt=""` es deliberado: el nombre del ejercicio ya está en el texto contiguo, así que repetirlo en la imagen le haría leer lo mismo dos veces a un lector de pantalla.

- [ ] **Step 4: Implementar el buscador**

Crear `src/features/exercises/ExerciseSearch.tsx`:

```typescript
export function ExerciseSearch({
  query,
  onQueryChange,
  muscle,
  onMuscleChange,
  muscles,
}: {
  query: string
  onQueryChange: (value: string) => void
  muscle: string | null
  onMuscleChange: (value: string | null) => void
  muscles: string[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="exercise-search" className="text-sm text-content-muted">
        Buscar
      </label>
      <input
        id="exercise-search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
        placeholder="sentadilla, press…"
        autoComplete="off"
      />

      <label htmlFor="exercise-muscle" className="text-sm text-content-muted">
        Músculo
      </label>
      <select
        id="exercise-muscle"
        value={muscle ?? ''}
        onChange={(event) => onMuscleChange(event.target.value || null)}
        className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
      >
        <option value="">Todos</option>
        {muscles.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 5: Implementar la pantalla**

Crear `src/features/exercises/ExercisesPage.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react'
import { loadExercises } from './exercise-cache'
import { searchExercises } from './searchExercises'
import { ExerciseList } from './ExerciseList'
import { ExerciseSearch } from './ExerciseSearch'
import type { Exercise } from './exercise-types'

export function ExercisesPage() {
  const [all, setAll] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadExercises()
      .then((exercises) => {
        if (!cancelled) setAll(exercises)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el catálogo de ejercicios.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const muscles = useMemo(() => {
    if (!all) return []
    const set = new Set<string>()
    for (const exercise of all) {
      for (const name of exercise.primaryMuscles) set.add(name)
    }
    return [...set].sort()
  }, [all])

  const visible = useMemo(
    () => (all ? searchExercises(all, query, muscle) : []),
    [all, query, muscle],
  )

  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-content">Ejercicios</h1>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!error && (
        <>
          <ExerciseSearch
            query={query}
            onQueryChange={setQuery}
            muscle={muscle}
            onMuscleChange={setMuscle}
            muscles={muscles}
          />

          {all === null ? (
            <p className="px-4 py-8 text-center text-content-muted">Cargando…</p>
          ) : (
            <ExerciseList exercises={visible} />
          )}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

```bash
pnpm test ExercisesPage
```
Esperado: PASAN las 4.

- [ ] **Step 7: Enlazar la ruta**

En `src/app/routes.tsx`, añadir `{ path: 'ejercicios', element: <ExercisesPage /> }` a los hijos de la ruta `/`, junto a `rutinas`, `progreso` y `perfil`. La pantalla de Rutinas sigue siendo un marcador de posición; añadirle un enlace a `/ejercicios` para que el catálogo sea alcanzable desde la interfaz.

- [ ] **Step 8: Verificar a mano en ambos temas**

```bash
pnpm db:start
pnpm dev
```

Entrar, navegar a Rutinas y de ahí a Ejercicios. Comprobar: la lista carga con imágenes, escribir filtra, el selector de músculo filtra, y la combinación de ambos funciona. Cambiar a tema claro y repetir. Comprobar además que al recargar sin red — con las herramientas del navegador en modo offline — la lista sigue apareciendo desde IndexedDB.

- [ ] **Step 9: Ejecutar toda la verificación**

```bash
pnpm exec tsc -b && pnpm build && pnpm lint && pnpm test && pnpm test:rls
```
Esperado: todo limpio. `pnpm test` también con `.env.local` movido a un lado.

- [ ] **Step 10: Commit**

```bash
git add src/features/exercises src/app/routes.tsx
git commit -m "feat: add exercise catalog screen with search and muscle filter"
```

---

## Al terminar este plan

El catálogo completo de Free Exercise DB vive en la base con sus imágenes en Storage, se cachea entero en el navegador, y hay una pantalla para buscarlo por nombre o músculo que funciona sin conexión. Los ejercicios propios de cada usuario están aislados por RLS y probados.

Siguiente plan: **Plan 3 — Registro de entrenos**, que usa este catálogo para registrar series con peso y repeticiones, con cola de sincronización para el gimnasio sin señal.
