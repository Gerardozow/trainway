# Trainway — Diseño

Fecha: 2026-08-04
Estado: aprobado, listo para plan de implementación

## Qué es

Aplicación para registrar entrenamientos de gimnasio y compartir rutinas con amigos. Doble propósito: uso real por parte del autor y su círculo, y pieza de portafolio profesional.

El nombre hereda el sufijo `-way` de **Tradeway**, el negocio del autor, para que ambas marcas se lean como familia. "Way" también describe el producto: una rutina es un camino.

**Núcleo del producto:** registro personal de entrenos + compartir y copiar rutinas entre amigos. No es una app de competencia ni un feed social tipo Strava.

## Decisiones tomadas

| Decisión | Elección | Razón |
|---|---|---|
| Plataforma | PWA instalable | Un solo código, offline real en el gimnasio, URL pública para portafolio |
| Frontend | Vite + React + TypeScript | Offline sin fricción con `vite-plugin-pwa`, deploy estático |
| Estilos | Tailwind CSS | Velocidad y consistencia; tema claro/oscuro con estrategia `class` |
| Backend | Supabase (Postgres + Auth + Storage) | Cuentas reales, sincronización entre dispositivos, RLS, capa gratis suficiente |
| Estado servidor | TanStack Query | Cache, reintentos, invalidación |
| Cache local | IndexedDB vía Dexie | Sesión en curso y catálogo de ejercicios disponibles sin red |
| Gráficas | Recharts | Suficiente para volumen y progresión de peso |
| Catálogo de ejercicios | Free Exercise DB | ~800 ejercicios con imágenes y licencia libre |
| IA | MiniMax vía Supabase Edge Function | La clave nunca toca el cliente |

Descartado explícitamente: Next.js (offline más peleado, y el offline pesa más que el preview de link), local-first sin servidor (sin multi-dispositivo), app nativa (más trabajo, peor para portafolio).

## Arquitectura

### Capas del frontend

Organización por dominio, no por tipo de archivo:

```
src/
  features/
    auth/
    exercises/
    routines/
    workouts/
    progress/
    coach/        # IA
  shared/         # componentes de UI, hooks, utilidades
  lib/            # cliente Supabase, Dexie, tema
```

Regla de aislamiento: **la UI nunca llama a Supabase directamente.** Cada feature expone un repositorio con su propia interfaz; las pantallas consumen esa interfaz. Consecuencia: se puede cambiar el backend o simular datos en pruebas sin tocar componentes, y cada feature se entiende leyendo su carpeta.

### Modelo de datos (Supabase / Postgres)

| Tabla | Contenido | Notas |
|---|---|---|
| `profiles` | `id` (FK a `auth.users`), `username` único, `display_name`, `avatar_url` | El `username` es lo que buscan los amigos |
| `exercises` | catálogo: `name`, `category`, `equipment`, `primary_muscles[]`, `secondary_muscles[]`, `instructions[]`, `image_paths[]`, `owner_id` | `owner_id` nulo = ejercicio global sembrado desde Free Exercise DB; no nulo = ejercicio propio del usuario |
| `routines` | `owner_id`, `name`, `description`, `visibility`, `share_token`, `forked_from` | `visibility` ∈ `private` \| `link` \| `friends` |
| `routine_exercises` | `routine_id`, `exercise_id`, `position`, `target_sets`, `target_reps`, `target_weight`, `notes` | El orden vive en `position` |
| `workouts` | `user_id`, `routine_id` (nulo si es entreno libre), `started_at`, `ended_at`, `notes` | Una sesión |
| `workout_sets` | `workout_id`, `exercise_id`, `set_index`, `reps`, `weight`, `rpe`, `is_warmup`, `completed_at` | Una serie real ejecutada |
| `friendships` | `requester_id`, `addressee_id`, `status` | `status` ∈ `pending` \| `accepted` |
| `ai_usage` | `user_id`, `day`, `call_count`, `token_count` | Límite de consumo por usuario |

**PRs y métricas de progreso son vistas SQL** sobre `workout_sets`, no tablas: mejor peso por rango de repeticiones y 1RM estimado con la fórmula de Epley. Nada se duplica, así que un PR no puede desincronizarse del historial que lo produjo.

### Seguridad — RLS

Row Level Security activo en todas las tablas. Políticas:

- `workouts` y `workout_sets`: solo el dueño lee y escribe. Sin excepciones.
- `routines`: lee el dueño; lee quien tiene una amistad en estado `accepted` con el dueño cuando `visibility = 'friends'`. Escribe solo el dueño.
- Acceso por link: no se resuelve con una política de RLS, porque el token no viaja en la sesión. Se expone una función `security definer` que recibe el `share_token`, verifica que la rutina tenga `visibility = 'link'`, y devuelve la rutina con sus ejercicios. Es el único camino de lectura por token.
- `routine_exercises`: hereda el permiso de lectura de su rutina.
- `profiles`: lectura pública de `username`, `display_name` y `avatar_url`; escritura solo del dueño.
- `exercises`: los globales (`owner_id` nulo) se leen por cualquiera; los propios solo por su dueño.
- `ai_usage`: solo lectura del dueño; la escritura la hace la Edge Function con la clave de servicio.

Estas políticas se verifican con pruebas automatizadas que intentan el acceso indebido y esperan que falle. No se validan a ojo.

### Imágenes de ejercicios

Un script de seed descarga el dataset de Free Exercise DB, inserta los ejercicios en `exercises` y sube las imágenes a Supabase Storage una sola vez. Producción no depende de un repositorio de GitHub de terceros.

### Offline y sincronización

- El catálogo de ejercicios se cachea completo en IndexedDB. Es estático y cabe.
- Los entrenos se escriben **primero en local** y entran a una cola de sincronización. Al recuperar red se suben.
- Los datos locales no se borran hasta confirmar la escritura en el servidor.
- Los conflictos son prácticamente imposibles por diseño: cada serie pertenece a un solo usuario y solo se crea, no se edita desde dos dispositivos.

## Tema claro y oscuro

Colores como CSS variables, Tailwind en modo `class`. Al primer arranque la app sigue `prefers-color-scheme`; el usuario puede forzar claro u oscuro y la elección se persiste. **Ambos temas se diseñan simultáneamente**, no el oscuro como parche posterior. El oscuro es el caso de uso dominante: teléfono en la mano, gimnasio con poca luz.

## Pantallas

Navegación inferior de cuatro destinos: **Entrenar · Rutinas · Progreso · Perfil**.

### Entrar

Supabase Auth con magic link por correo y Google OAuth. Sin contraseñas que administrar. En el primer ingreso se pide `username`.

### Entrenar

La pantalla crítica: se usa de pie, sudando, con una mano.

- Se arranca desde una rutina o como entreno libre.
- Cada ejercicio muestra sus series objetivo y, atenuado, **lo levantado la última vez**. Esa referencia es lo que sostiene el uso diario.
- Registrar una serie: dos campos grandes (peso, repeticiones) y un botón de completar.
- Todo se guarda local al instante, sin esperar red.
- La sesión sobrevive si la app se cierra o el teléfono se apaga.

### Rutinas

- Lista de rutinas propias y rutinas compartidas contigo.
- Editor: búsqueda en el catálogo con imagen del ejercicio, reordenar arrastrando, fijar series/repeticiones/peso objetivo.
- Compartir: genera un link con `share_token`, o se envía directo a un amigo.
- Al abrir una rutina ajena: **Copiar a mis rutinas**. Se clona registrando `forked_from`; editar la copia no afecta el original.

### Progreso

Historial de sesiones, PRs por ejercicio, y gráficas de volumen semanal y peso por ejercicio en el tiempo.

### Perfil

Amigos (buscar por `username` o link de invitación, aceptar o rechazar), toggle de tema, cerrar sesión.

## Coach IA (MiniMax)

### Seguridad

La clave de API de MiniMax **nunca se expone al cliente**. Todo pasa por una Supabase Edge Function (Deno) que:

1. Guarda la clave como secreto del servidor.
2. Valida el JWT de Supabase del usuario que llama.
3. Verifica el límite en `ai_usage` antes de gastar tokens.
4. Arma el contexto y llama a MiniMax.
5. Devuelve la respuesta al cliente por streaming.

El cliente solo conoce la URL de la Edge Function.

El identificador de modelo y el endpoint exactos de MiniMax se fijan consultando su documentación al momento de implementar, no de memoria.

### Contexto enviado

Rutina activa, últimas sesiones y PRs relevantes, **resumidos**. No se manda el historial completo: cuesta tokens y degrada la respuesta.

### Capacidades en v1

Las tres:

1. **Chat de dudas.** Técnica de ejecución, sustituciones por equipo no disponible, descansos, dolores. Con contexto de los entrenos del usuario.
2. **Proponer cambios a una rutina existente.** Devuelve JSON estructurado, se valida con Zod, y se presenta como diff legible ("sentadilla 3×8 → 4×6, agregar peso muerto rumano") con aceptar o descartar.
3. **Generar una rutina desde cero.** Formulario de objetivo, días por semana y equipo disponible; la IA arma la rutina completa y el usuario la revisa antes de guardarla.

### Regla dura

**La IA nunca escribe en la base de datos directamente.** Solo propone. Todo cambio pasa por aprobación explícita del usuario. Si el JSON no valida contra Zod, se reintenta una vez; si falla de nuevo, se informa que no se pudo generar. Nunca se aplica un cambio parcial.

### Límites de consumo

`ai_usage` cuenta llamadas y tokens por usuario y día. Sin este límite, un solo usuario curioso agota el crédito de la cuenta.

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| Sin red | La app funciona. Banner discreto de "offline" y contador de sesiones pendientes de subir. La IA se deshabilita con mensaje claro, nunca con un spinner indefinido |
| Falla la sincronización | Reintento con backoff exponencial. Los datos locales se conservan hasta confirmar escritura en servidor |
| Sesión expirada | Refresh silencioso; si falla, se pide login y el entreno en curso sobrevive en local |
| MiniMax caído | Timeout de 30 segundos y mensaje concreto |
| Límite diario de IA alcanzado | Mensaje que indica cuándo se reinicia |
| JSON de la IA inválido | Un reintento; luego se informa el fallo sin aplicar nada |

## Estrategia de pruebas

- **Vitest (unitarias):** 1RM estimado, detección de PRs, cola de sincronización, validadores Zod.
- **RLS contra Supabase local:** pruebas que intentan leer entrenos ajenos y rutinas privadas y esperan un fallo. Es seguridad; se verifica explícitamente.
- **Playwright (extremo a extremo):** registrar un entreno completo; compartir una rutina entre dos usuarios y copiarla; ciclo offline → online.
- **Edge Function de IA:** se prueba con respuestas de MiniMax simuladas. Cero tokens gastados en integración continua.

## Orden de construcción

La IA se construye al final: el coach necesita leer rutinas y PRs reales para tener contexto útil.

1. Base del proyecto, tema claro/oscuro, autenticación.
2. Catálogo de ejercicios y script de seed.
3. Registro de entrenos con persistencia offline.
4. Rutinas: crear, editar, ejecutar.
5. Amigos, compartir y copiar rutinas.
6. Progreso: historial, PRs, gráficas.
7. Coach IA: chat, propuestas de cambio, generador.

## Fuera de alcance de v1

Temporizador de descanso entre series, comentarios sobre entrenos de amigos, notificaciones push, registro de medidas corporales, ranking o competencia entre amigos.

## Pendiente externo

El logo lo genera el autor.
