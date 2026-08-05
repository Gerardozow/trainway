# Trainway — Diseño

**Fecha:** 2026-08-05
**Estado:** aprobado, pendiente de plan de implementación

---

## 1. Qué es

Aplicación web de entrenamiento de gimnasio. El usuario responde un cuestionario guiado, una IA le genera un mesociclo de 4 semanas usando ejercicios de un catálogo real con imágenes, y durante el entreno registra series, pesos, repeticiones y tiempos desde el celular — incluso sin señal. Al terminar el bloque, la IA revisa el historial y genera el siguiente.

Dominio: `gzow.dev/trainway`. Todo el hosting en capas gratuitas.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Usuarios | Multiusuario con login desde el día 1 |
| IA | MiniMax (API compatible con Anthropic), key ya disponible |
| Catálogo | `free-exercise-db` — 873 ejercicios, Unlicense (dominio público) |
| Idioma | Interfaz en español; ejercicios traducidos por IA y cacheados |
| Onboarding | Wizard guiado de 6 pasos + campo de texto libre |
| Progresión | Híbrida: reglas deterministas semanales + revisión IA por bloque |
| Estructura | Bloques (mesociclos) de 4 semanas |
| Registro | Check por serie, peso y reps reales, RPE/notas, timer de descanso |
| Offline | PWA instalable con sincronización diferida |
| Hosting | Cloudflare Workers + Supabase |

## 3. Alcance

### Dentro de v1

- Registro e inicio de sesión (email + contraseña, y magic link)
- Wizard de intake
- Generación de bloque de 4 semanas por IA
- Vista "Hoy" con el entreno del día
- Sesión activa: registro por serie, timer de descanso, imágenes del ejercicio
- Entrenamiento de fuerza y **cardio de gimnasio** (cinta, elíptica, remo, bici estática, Stairmaster, Step Mill)
- Progresión automática entre sesiones
- Revisión de bloque por IA y generación del siguiente
- Gráficas de progreso
- Modo claro / oscuro / sistema
- Funcionamiento offline con sincronización

### Fuera de v1

| Fuera | Motivo |
|---|---|
| Nutrición, calorías, macros | Excluido explícitamente por el usuario |
| Cardio con GPS, mapas, exteriores | Solo cardio de gimnasio |
| Social, ranking, feed, compartir | Subsistema completo. Aplazado a v3 |
| Vídeo de ejercicios | El catálogo solo trae imágenes |
| App nativa en tiendas | La PWA cubre el caso de uso |

### Fases futuras

- **v2** — plantillas de rutina sin IA, exportar historial, medidas corporales y peso.
- **v3** — social: seguir amigos, compartir bloques, ranking. Requiere su propio spec.

El modelo de datos de v1 no bloquea ninguna de las dos: `programs` ya es una entidad independiente y compartible, y `set_logs` ya es la unidad atómica de cualquier estadística futura.

---

## 4. Arquitectura

```
                      gzow.dev/trainway/*
                              |
              Cloudflare Worker (route en la zona gzow.dev)
              - sirve los assets estáticos del SPA
              - POST /api/plan       genera un bloque
              - POST /api/review     revisa un bloque cerrado
              - POST /api/translate  cachea traducciones
                              |
              +---------------+----------------+
              |                                |
         Supabase                          MiniMax
         auth + Postgres + RLS             MiniMax-M3
         el navegador habla directo        solo desde el Worker
         (protegido por RLS)               la key nunca sale al cliente

  Imágenes:  cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/...
  Catálogo:  exercises.json (980 KB) empaquetado en el repo, cargado lazy
```

El Worker existe por una sola razón de peso: **la key de MiniMax no puede estar en el cliente**. Todo lo demás (auth, lecturas, escrituras) va directo del navegador a Supabase, protegido por RLS. Menos saltos, menos código, menos latencia.

El catálogo de ejercicios vive **dentro del repo**, no se pide en runtime. 980 KB se descargan una vez, quedan en el service worker, y la app funciona sin conexión sin depender de GitHub.

## 5. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Build / SPA | Vite + React + TypeScript | Bundle pequeño, `base` para subpath, control total del service worker |
| Router | React Router con `basename: '/trainway'` | |
| Estilos | Tailwind CSS v4 | Tokens de tema nativos, dark mode por clase |
| Componentes | shadcn/ui | Accesibles, sin estilo impuesto, se pueden reescribir |
| Estado servidor | TanStack Query | Caché, reintentos, revalidación |
| Estado local / offline | Dexie (IndexedDB) | Cola de sincronización |
| PWA | `vite-plugin-pwa` (Workbox) | Precache y estrategias de runtime |
| Gráficas | Recharts, siguiendo la skill `dataviz` | |
| Backend | Cloudflare Workers | Gratis, ya está el dominio en Cloudflare |
| Datos / auth | Supabase | Postgres real, RLS, auth incluida, capa gratuita |
| SDK de IA | `@anthropic-ai/sdk` con `baseURL` de MiniMax | La API de MiniMax es compatible con Anthropic |
| Tests | Vitest + Playwright | |

Descartados: **Next.js** (el adaptador de Cloudflare añade fricción, el App Router pelea con el service worker, y no necesitamos SSR en una app detrás de login). **SvelteKit** (excelente encaje técnico, descartado por ecosistema de componentes más chico).

---

## 6. Modelo de datos

Postgres en Supabase. Todas las tablas de usuario con RLS `user_id = auth.uid()`.

```sql
profiles
  id             uuid PK -> auth.users(id)
  display_name   text
  units          text  default 'metric'   -- metric | imperial
  locale         text  default 'es'
  theme          text  default 'system'   -- light | dark | system
  created_at     timestamptz

intakes                                    -- respuestas del wizard
  id             uuid PK
  user_id        uuid
  goal           text        -- fuerza | hipertrofia | perdida_grasa | resistencia | general
  days_per_week  int
  session_minutes int
  experience     text        -- principiante | intermedio | avanzado
  equipment      text[]      -- valores del catálogo: barbell, dumbbell, machine, cable...
  focus_muscles  text[]
  limitations    text        -- lesiones, texto libre
  free_notes     text
  created_at     timestamptz

programs                                   -- un mesociclo de 4 semanas
  id             uuid PK
  user_id        uuid
  intake_id      uuid
  name           text
  block_number   int         -- 1, 2, 3... bloques encadenados
  weeks          int  default 4
  starts_on      date
  status         text        -- active | completed | archived
  ai_model       text        -- p.ej. MiniMax-M3, para trazabilidad
  ai_rationale   text        -- por qué la IA armó este bloque
  created_at     timestamptz

program_days
  id             uuid PK
  program_id     uuid
  week           int         -- 1..4
  day_index      int         -- 1..7
  title          text        -- "Empuje A", "Pierna"
  focus          text[]
  is_deload      boolean default false

program_exercises
  id                     uuid PK
  program_day_id         uuid
  exercise_id            text   -- id de free-exercise-db
  category               text   -- strength | cardio | stretching
  position               int
  target_sets            int
  target_reps            text   -- "8-10" o "12"
  target_weight          numeric        -- null durante la calibración
  target_duration_seconds int           -- cardio e isométricos
  target_rpe             int
  rest_seconds           int
  progression_scheme     jsonb  -- ver sección 9
  coach_note             text   -- tip de la IA, en español

workout_sessions
  id               uuid PK
  user_id          uuid
  program_day_id   uuid
  performed_on     date
  started_at       timestamptz
  completed_at     timestamptz
  session_rpe      int
  notes            text

set_logs
  id                  uuid PK
  session_id          uuid
  program_exercise_id uuid
  set_index           int
  done                boolean default false
  weight              numeric   -- fuerza
  reps                int       -- fuerza
  duration_seconds    int       -- cardio
  distance_m          numeric   -- cardio
  intensity           text      -- cardio: "nivel 8", "10 km/h"
  rpe                 int
  note                text
  client_id           text UNIQUE   -- idempotencia de sincronización
  logged_at           timestamptz

exercise_translations                      -- caché compartida entre usuarios
  exercise_id    text
  locale         text
  name           text
  instructions   text[]
  PRIMARY KEY (exercise_id, locale)
```

Tres decisiones que conviene entender:

**Una sola tabla para fuerza y cardio.** `set_logs` sirve a ambos: fuerza llena `weight`/`reps`, cardio llena `duration_seconds`/`distance_m`/`intensity`. Se discrimina por `program_exercises.category`. Evita duplicar toda la lógica de sincronización por un caso que solo cambia tres columnas.

**`client_id` es la clave de idempotencia.** Un UUID generado en el celular antes de tocar la red. Si el sync reintenta tras un fallo, el `upsert` por `client_id` no duplica el registro. Sin esto, cada corte de señal ensucia el historial.

**`exercise_translations` es la única tabla de lectura pública.** Escritura solo desde el Worker con service role. Un ejercicio se traduce una vez para todo el proyecto, no una vez por usuario.

### Políticas RLS

| Tabla | Select | Insert / Update / Delete |
|---|---|---|
| `profiles` | `id = auth.uid()` | `id = auth.uid()` |
| `intakes`, `programs`, `workout_sessions` | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `program_days`, `program_exercises` | vía join a `programs.user_id = auth.uid()` | igual |
| `set_logs` | vía join a `workout_sessions.user_id = auth.uid()` | igual |
| `exercise_translations` | público (`true`) | solo service role |

---

## 7. Catálogo de ejercicios

Fuente: `yuhonas/free-exercise-db`, Unlicense (dominio público, sin atribución obligatoria — la incluimos igual en el pie).

Verificado el 2026-08-05:

- 873 ejercicios, `dist/exercises.json` de 980 KB
- `id` slug estable derivado del nombre (`Barbell_Bench_Press_-_Medium_Grip`)
- **Exactamente 2 imágenes por ejercicio**, sin excepción: posición inicial y final
- Categorías: strength 581, stretching 123, plyometrics 61, powerlifting 38, olympic weightlifting 35, strongman 21, **cardio 14**
- Equipamiento: barbell 170, dumbbell 123, other 122, body only 111, cable 81, machine 67, kettlebells 53, bands 20, medicine ball 17, exercise ball 12, foam roll 11, e-z curl bar 9, sin valor 77
- Nivel: beginner 523, intermediate 293, expert 57

Del cardio, los aptos para gimnasio son: `Bicycling, Stationary`, `Elliptical Trainer`, `Jogging, Treadmill`, `Running, Treadmill`, `Rowing, Stationary`, `Stairmaster`, `Step Mill`, `Rope Jumping`. Se excluyen del filtro los de exterior (`Bicycling`, `Skating`, `Running`).

**Las 2 imágenes se alternan cada ~1 s** en la tarjeta del ejercicio. Es un mini-GIF de la técnica sin necesitar vídeo, y sale gratis con los datos que ya hay.

Imágenes servidas por jsDelivr, no por GitHub raw:
```
https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/{path}
```
jsDelivr es un CDN de verdad, con cabeceras de caché correctas y sin límite de tasa. GitHub raw tiene ambos problemas.

El JSON se descarga en un script de `postinstall` y se versiona en el repo. Así el build es reproducible y la app no depende de que GitHub esté arriba.

---

## 8. Traducciones

Los datos vienen en inglés. Estrategia:

1. Al generar un bloque, el Worker junta los `exercise_id` elegidos (~25) y consulta `exercise_translations` por los que falten.
2. Los faltantes se mandan a MiniMax en un solo batch, con salida estructurada.
3. Se guardan en la tabla. Quedan disponibles para todos los usuarios.

Se traducen `name` e `instructions`. Los nombres de músculos y equipamiento se traducen en el cliente con un diccionario estático — son ~30 valores cerrados, no hace falta IA.

Coste: cada ejercicio se paga una vez en la vida del proyecto. Con 873 ejercicios el techo total es trivial, y en la práctica solo se traducirá el subconjunto que la IA use.

---

## 9. Integración con MiniMax

Cliente: `@anthropic-ai/sdk` apuntando a `https://api.minimax.io/anthropic`. Modelo `MiniMax-M3`. La key vive como secret del Worker (`MINIMAX_API_KEY`) y nunca se expone.

### Idea central: la IA genera una semana, no cuatro

MiniMax genera **la semana 1 más un esquema de progresión por ejercicio**. Las semanas 2 a 4 se derivan en código.

Pedirle 4 semanas × 4 días × 6 ejercicios son ~96 entradas de JSON: caro en tokens, lento, y es justo donde un modelo empieza a contradecirse. Una semana son ~24 entradas y sale consistente. Además es como funcionan los programas de fuerza reales: una plantilla y un esquema de carga.

### Idea central: la IA elige de un catálogo, no inventa

El Worker filtra el catálogo por equipamiento, nivel y músculos objetivo, y le pasa ~60 candidatos con sus `id`. El prompt exige elegir **solo** de esa lista.

Validación en el servidor: todo `exercise_id` devuelto debe existir entre los candidatos. Si no:
1. Un reintento, pasándole el error como feedback.
2. Si reincide, se sustituye por el candidato más cercano (mismo músculo primario y equipamiento).

Sin esta restricción el modelo inventa ejercicios plausibles y la app queda con huecos donde debería ir la imagen.

### Endpoints

**`POST /api/plan`** — genera un bloque.

Entrada: `intake_id` (y opcionalmente `previous_program_id` para bloques encadenados).
Salida forzada por JSON schema:

```json
{
  "block_name": "Fuerza base — Bloque 1",
  "rationale": "Cuatro días con frecuencia 2 por grupo. Volumen moderado por ser el primer bloque...",
  "days": [{
    "day_index": 1,
    "title": "Empuje A",
    "focus": ["chest", "shoulders", "triceps"],
    "exercises": [{
      "exercise_id": "Barbell_Bench_Press_-_Medium_Grip",
      "sets": 4,
      "reps": "6-8",
      "target_rpe": 8,
      "rest_seconds": 150,
      "progression": { "type": "double", "increment_kg": 2.5 },
      "coach_note": "Escápulas retraídas y pies firmes en el suelo."
    }]
  }]
}
```

`progression.type` es uno de: `double` (doble progresión por reps), `linear` (peso fijo al alza), `time` (cardio, subir duración), `intensity` (cardio, subir nivel).

**`POST /api/translate`** — batch de traducciones faltantes. Entrada: lista de `exercise_id`. Escribe en `exercise_translations` con service role.

**`POST /api/review`** — revisión al cerrar la semana 4. Recibe un resumen compacto, no el historial crudo:

```json
{
  "adherence_pct": 87,
  "sessions_completed": 14,
  "sessions_planned": 16,
  "volume_by_muscle": { "chest": 42, "back": 48, "quads": 36 },
  "avg_rpe": 7.8,
  "progressed": ["Barbell_Bench_Press_-_Medium_Grip", "Barbell_Squat"],
  "stalled": ["Barbell_Curl"],
  "user_notes": ["hombro derecho molesta en press militar"]
}
```

Devuelve el rationale y los parámetros del siguiente bloque, que alimentan otra llamada a `/api/plan`.

**Volumen de llamadas: ~3 por mes de entrenamiento.** El coste es despreciable.

### Coste y fallos

- Todas las llamadas van con timeout y un reintento.
- Si MiniMax falla al generar el plan, se le muestra al usuario un error claro con un botón de reintentar. **No se genera un plan de respaldo con reglas** — un plan malo silencioso es peor que un error visible.
- Si falla la traducción, se cae al nombre en inglés. Degradación limpia, la app sigue usable.
- Límite de tasa por usuario en el Worker: 10 generaciones de plan al día.

---

## 10. Progresión

### Fuerza — doble progresión

```
Rango objetivo 8-10, 4 series:

  completaste 10/10/10/10  ->  +2.5 kg (torso) o +5 kg (pierna), vuelves a 8
  completaste 10/10/9/8    ->  mismo peso, intentas mejorar reps
  fallaste el piso (8) en 2 sesiones seguidas  ->  deload del 10% en ese ejercicio
```

Incrementos por defecto: 2.5 kg en ejercicios de tren superior, 5 kg en tren inferior. Configurable, y ajustable por la IA en `progression.increment_kg`.

### Cardio

`type: "time"` — +1 a 2 minutos por semana hasta la duración objetivo.
`type: "intensity"` — misma duración, sube el nivel de la máquina.

### La semana 4 es de descarga

Volumen al 60 % (menos series), intensidad al 90 % del peso. `program_days.is_deload = true`. Es lo que convierte un mesociclo de 4 semanas en algo sostenible en vez de en una escalada hasta el agotamiento.

### El bloque 1 no conoce tus cargas

Ningún sistema puede prescribir kilos el primer día. Por eso **la semana 1 es de calibración**: la IA prescribe series, repeticiones y RPE objetivo, con `target_weight` en `null`. La app pide registrar con qué carga se llegó a ese esfuerzo. Desde la semana 2, las reglas ya operan sobre datos reales.

La UI lo dice explícitamente en la semana 1: *"Semana de calibración: usa un peso donde las últimas 2 reps cuesten. Se anota y a partir de aquí Trainway ajusta solo."*

### Se calcula al abrir la sesión

El target no se precalcula en batch. Al abrir la sesión, la app lee los `set_logs` de la última vez que se hizo ese `exercise_id` y calcula ahí mismo.

Consecuencia buena: **saltarse un día no rompe nada**. El día queda sin `workout_session`, se sigue normal, y la adherencia se registra y entra en el review del bloque.

La lógica vive en funciones puras en `src/lib/progression/`, sin dependencias de red ni de base de datos. Es la parte del sistema con más reglas y la más fácil de testear a fondo.

---

## 11. Offline y sincronización

```
Service Worker (Workbox vía vite-plugin-pwa)
  app shell + exercises.json  ->  precache
  imágenes de jsDelivr        ->  cache-first, expiración 60 días, tope 300 entradas
  peticiones a Supabase       ->  NO pasan por el service worker

IndexedDB (Dexie) = fuente de verdad durante el entreno
  1. se marca la serie   ->  escribe local con client_id UUID y synced=false
  2. la UI se repinta    ->  instantáneo, nunca espera a la red
  3. el flusher          ->  sube la cola cuando hay red, con backoff exponencial
  4. Supabase upsert     ->  por client_id, idempotente
```

Al abrir la sesión del día con conexión, se hidrata el día completo en IndexedDB. A partir de ahí el entreno funciona en modo avión.

**La UI nunca espera a la red.** Un indicador discreto muestra cuántos registros faltan por subir; al completarse desaparece.

Conflictos: gana el último en escribir, por `logged_at`. Es un usuario en un dispositivo a la vez — meter CRDTs aquí sería ingeniería de vanidad.

---

## 12. UI / UX

Móvil primero de verdad, no "responsive". El caso de uso es una persona de pie, con prisa, manos sudadas y una mano ocupada.

### Marca

El logo es un wordmark: `brand/logo.png`, 1162×215, con el lema *TRAIN. PERFORM. ACHIEVE. REPEAT.*

Colores extraídos del PNG:

| Token | Valor | Uso |
|---|---|---|
| `--tw-yellow` | `#FFC603` | Acento único |
| `--tw-grey` | `#787878` | Texto secundario del lema |

El amarillo es el **único** acento; todo lo demás son grises neutros.

Regla de contraste, no negociable y asimétrica entre temas:

- **Tema claro:** `#FFC603` sobre blanco da ~1.6:1. No es color de texto, jamás. Va en fondos de botón, barras de progreso y estados activos, siempre con texto casi negro encima (~13:1, sobra).
- **Tema oscuro:** `#FFC603` sobre `#0A0A0A` da ~13:1. Ahí sí puede ser color de texto y de icono.

**Falta un icono cuadrado.** Un wordmark de 5.4:1 no sirve como icono de PWA. Hay que producir una marca cuadrada (512×512 y 192×192, más una versión maskable) para el manifest y la pantalla de inicio. Es una tarea del plan de implementación, no un supuesto.

### Pantallas

```
┌──────────────────────┐   Hoy       entreno del día, o tarjeta de descanso
│  Hoy · Semana 2/4    │   Sesión    la pantalla más usada
│                      │   Plan      el bloque completo, 4 semanas
│  ┌────────────────┐  │   Progreso  gráficas
│  │ [img]  Press   │  │   Perfil    tema, unidades, cerrar sesión
│  │        banca   │  │
│  │  4 × 8-10      │  │
│  │  ┌──┬──┬──┬──┐ │  │
│  │  │60│60│60│  │ │  │  <- steppers grandes, sin teclado
│  │  └──┴──┴──┴──┘ │  │
│  │  [ ✓ serie 3 ] │  │
│  └────────────────┘  │
│   ⏱ descanso 1:47    │  <- arranca solo al marcar la serie
├──────────────────────┤
│ Hoy Plan Prog Perfil │
└──────────────────────┘
```

Navegación inferior, todo alcanzable con el pulgar.

### Lo que hace que sirva en el gimnasio

- Objetivos táctiles de 48 px mínimo
- **Wake Lock API** durante la sesión: la pantalla no se apaga entre series
- Las 2 imágenes del ejercicio alternan cada segundo — demo de técnica sin vídeo
- Oscuro por defecto según `prefers-color-scheme`, con toggle de 3 estados (claro / oscuro / sistema) persistido en `profiles.theme`
- Timer de descanso con vibración; sonido opcional
- Entradas numéricas con steppers, no teclado: `inputmode="decimal"` como respaldo
- Cero scroll horizontal, cero modales anidados

### Accesibilidad

- Contraste AA en ambos temas, verificado y no asumido
- Navegación por teclado y foco visible en toda la app
- Etiquetas ARIA en los controles de serie y en el timer
- Respeta `prefers-reduced-motion`: con esa preferencia, las imágenes del ejercicio no alternan

### Proceso de diseño

Se aplican las skills `frontend-design` y `ui-ux-pro-max-skill` — **ambas están instaladas pero desactivadas** en `.claude/settings.json`, hay que habilitarlas en la primera tarea del plan. Las gráficas siguen la skill `dataviz`.

---

## 13. Despliegue

### Cloudflare Worker con assets estáticos

Un solo Worker sirve el SPA y la API.

```jsonc
// wrangler.jsonc
{
  "name": "trainway",
  "main": "worker/index.ts",
  "compatibility_date": "2026-01-01",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "routes": [{ "pattern": "gzow.dev/trainway*", "zone_name": "gzow.dev" }]
}
```

El subpath se resuelve así:

1. Vite compila con `base: '/trainway/'`, así que el HTML referencia `/trainway/assets/...`
2. React Router usa `basename: '/trainway'`
3. El Worker atiende `/trainway/api/*` con su lógica
4. Para todo lo demás, **quita el prefijo `/trainway`** de la URL y delega en `env.ASSETS.fetch()`

### DNS

`gzow.dev` está registrado en Dondominio con los nameservers apuntando a Cloudflare, y no hay nada publicado todavía.

Una ruta de Worker necesita un registro DNS que resuelva, aunque no haya origen real. Se crea un registro **proxied** (nube naranja) en la raíz:

```
AAAA   gzow.dev   100::   (proxied)
```

`100::` es la dirección de descarte de IPv6. Cloudflare intercepta la petición antes de llegar a ningún sitio y la entrega al Worker. Es el patrón estándar para dominios sin origen.

La raíz `gzow.dev` queda libre para lo que se quiera poner después; solo `/trainway*` pertenece a este Worker.

### Variables de entorno

| Variable | Dónde | Público |
|---|---|---|
| `VITE_SUPABASE_URL` | build del cliente | sí |
| `VITE_SUPABASE_ANON_KEY` | build del cliente | sí (protegida por RLS) |
| `MINIMAX_API_KEY` | secret del Worker | **no** |
| `SUPABASE_SERVICE_ROLE_KEY` | secret del Worker | **no** |

### Capas gratuitas

| Servicio | Límite | Margen |
|---|---|---|
| Cloudflare Workers | 100 000 peticiones/día | de sobra |
| Cloudflare assets | ilimitado | |
| Supabase | 500 MB de base, 50 000 usuarios activos/mes | de sobra |
| jsDelivr | ilimitado | |
| MiniMax | de pago por uso | ~3 llamadas por usuario y mes |

**Riesgo real:** los proyectos gratuitos de Supabase se pausan tras una semana sin actividad. Con uso regular no ocurre; hay que tenerlo presente en periodos de inactividad. Mitigación si molesta: un Cron Trigger de Cloudflare que haga una consulta trivial cada pocos días.

---

## 14. Seguridad

- La key de MiniMax solo existe como secret del Worker
- La service role key de Supabase solo existe como secret del Worker, y solo se usa para escribir `exercise_translations`
- Toda tabla de usuario lleva RLS activo. Se verifica con un test que intenta leer datos de otro usuario y **debe** fallar
- Los endpoints del Worker validan el JWT de Supabase antes de actuar
- El texto libre del wizard llega a un prompt de IA: se acota longitud (2000 caracteres) y se pasa como dato delimitado, nunca concatenado en las instrucciones del sistema
- Límite de tasa por usuario en los endpoints de IA
- CSP restrictiva: solo `self`, el dominio de Supabase y `cdn.jsdelivr.net`

---

## 15. Estrategia de pruebas

| Qué | Cómo | Por qué ahí |
|---|---|---|
| Reglas de progresión | Vitest, funciones puras | Es donde está la lógica de negocio. Cobertura alta |
| Validación de salida de IA | Vitest con respuestas grabadas, incluidas malformadas y con IDs inventados | La ruta de fallo importa más que la feliz |
| Cola de sincronización | Vitest con IndexedDB falso: offline, reintento, idempotencia por `client_id` | El duplicado silencioso es el peor fallo posible |
| Aislamiento RLS | Test de integración contra Supabase local | Un fallo aquí filtra datos entre usuarios |
| Flujo de sesión | Playwright móvil: abrir, marcar series, timer, completar | El recorrido crítico |
| Modo offline | Playwright con red cortada a media sesión | El caso que motivó la PWA |

Se sigue TDD en las reglas de progresión y en la cola de sincronización — ambas son lógica pura con muchos casos límite, justo donde escribir el test antes ahorra tiempo.

---

## 16. Criterios de éxito

v1 está listo cuando:

1. Un usuario nuevo se registra, completa el wizard y recibe un bloque de 4 semanas con ejercicios reales, imágenes visibles y textos en español.
2. Puede abrir el entreno del día, registrar series con peso y reps, usar el timer y completar la sesión.
3. Con el modo avión activado a media sesión, todo sigue funcionando y los registros se suben solos al recuperar la señal, **sin duplicados**.
4. En la segunda semana, los pesos objetivo reflejan lo que realmente levantó la primera.
5. Al completar la semana 4, la revisión de IA genera un bloque nuevo coherente con su historial.
6. La app funciona en `gzow.dev/trainway` en claro y en oscuro, instalable desde el celular.
7. Un usuario no puede leer datos de otro. Verificado por test.

---

## 17. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| MiniMax devuelve JSON inválido o IDs inventados | Alto | Salida con schema forzado, validación contra el catálogo, un reintento con feedback, sustitución por candidato cercano |
| El proyecto gratuito de Supabase se pausa | Medio | Cron Trigger de Cloudflare con consulta trivial |
| El sync duplica registros | Alto | `client_id` UNIQUE y upsert idempotente. Cubierto por tests |
| La calidad del plan de IA es mediocre | Medio | Prompt con principios de programación explícitos (frecuencia, volumen semanal por grupo, orden compuesto antes que aislamiento); el usuario puede regenerar |
| jsDelivr caído | Bajo | Respaldo a GitHub raw; las imágenes ya vistas siguen en caché |
| Falta el icono cuadrado de la marca | Bajo | Tarea explícita en el plan de implementación |

---

## 18. Referencias

- Catálogo: https://github.com/yuhonas/free-exercise-db (Unlicense)
- Datos: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json`
- Imágenes: `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/{path}`
- MiniMax, API compatible con Anthropic: `https://api.minimax.io/anthropic`
- Modelos MiniMax: `MiniMax-M3`, `MiniMax-M2.7`, `MiniMax-M2.5`, `MiniMax-M2.1`, `MiniMax-M2`
