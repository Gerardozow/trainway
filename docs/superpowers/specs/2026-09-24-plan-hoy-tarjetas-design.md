# Plan y Hoy con tarjetas grandes — Diseño

**Fecha:** 2026-09-24
**Estado:** aprobado en conversación, pendiente de revisión del spec

---

## 1. Qué cambia y por qué

La app se usa en dos momentos distintos y hoy los trata igual:

- **Antes de entrenar** (Hoy, Plan): la persona quiere entender qué le toca. Necesita ver el movimiento, la dosis y un detalle técnico.
- **Durante el entreno** (Session): entre series, con una mano y sudando. Necesita poco texto, botones grandes y el descanso visible.

Plan hoy es un acordeón de semanas y días sin ejercicios ni imágenes. Hoy es una lista compacta con una miniatura de 56 px del frame inicial. Ninguna de las dos muestra el descanso.

Se toma la **distribución** de una referencia externa (`rutina.html`: fila de datos, cuadrícula de la semana, tarjetas grandes con las dos fotos lado a lado, dosis en chip, indicaciones) y se aplica a **Plan y Hoy**. Los colores, la tipografía (Archivo) y los temas claro/oscuro no cambian. Session queda igual.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Pantallas | Plan y Hoy. Session, Progreso, Perfil y Onboarding no cambian |
| Texto de la tarjeta | `coach_note` visible + "Cómo se hace" desplegable con `instructions`. Sin cambios de backend, prompt ni esquema |
| Plan | Selector de semana + cuadrícula de días + detalle de un día a la vez |
| Encabezado tipo hero | No. La app se abre 4-5 veces por semana; un hero se come la pantalla útil |
| Estilo visual | Tokens actuales (`volt`, `--surface`, `.strip`, `.eyebrow`, `.num`, `.display`) |

## 3. Componente nuevo: `ExercisePreview`

`src/components/ExercisePreview.tsx`. Tarjeta grande de solo lectura, para ver un ejercicio antes de entrenarlo. La usan Hoy y Plan; Session sigue con `ExerciseCard`.

**Props:** el `ProgramExercise`, el `Exercise` del catálogo y la `ExerciseTranslation` opcional (misma forma en que hoy se resuelven nombre e instrucciones en `ExerciseCard`).

**Estructura, de arriba abajo:**

1. **Fotos:** dos frames lado a lado, 4:3 cada uno, separados por 2 px de `--line`. Etiquetas superpuestas "1 Inicio" y "2 Fin". `loading="lazy"`. Tocar abre el diálogo a pantalla completa que ya tiene `ExerciseImage`. Si una imagen falla, el mismo fallback de mancuerna que `ExerciseImage`.
   - **Cardio** (`category === 'cardio'`): sin fotos; una franja con icono de cardio.
2. **Eyebrow:** músculos primarios en español. `text-volt-ink` en fuerza; en cardio, un tono distinto ya disponible en el tema (a elegir en implementación, sin agregar color nuevo si se puede evitar).
3. **Nombre** en español (traducción o nombre del catálogo).
4. **Chip de dosis:** `3 × 10–12 · 90 s` en fuerza (`target_sets × target_reps · rest_seconds`); `15 min` en cardio (`target_duration_seconds`). Formato de descanso: segundos bajo 120, `2 min`, `2:30 min` arriba. Si `rest_seconds` es 0, no se muestra.
5. **`coach_note`**, si existe.
6. **"Cómo se hace"**: botón desplegable con los pasos numerados. Cerrado por defecto.

**Rejilla:** una columna en móvil; dos columnas desde `sm` (640 px).

**Reutilización:** el diálogo de pantalla completa y el fallback se extraen de `ExerciseImage` si hace falta para no duplicarlos. El formateo de la dosis se comparte con lo que hoy hace `ExerciseCard` (`"sets × reps"`) en una función pura en `src/lib`.

## 4. Plan (`src/routes/PlanView.tsx`)

Datos: la consulta actual ya trae `program`, `days`, `sessions`, `exercises` y la semana actual. No hay consultas nuevas; las traducciones se piden como en Hoy (`getTranslations`).

De arriba abajo:

1. **Encabezado:** "Bloque N", nombre y justificación de la IA. Igual que hoy.
2. **Fila de datos** (4 celdas `.strip`, número en `.num`): días por semana, series típicas, rango de reps, minutos de cardio. Todos derivados del plan real:
   - días: días de entrenamiento de la semana seleccionada.
   - series: moda de `target_sets` de los ejercicios de fuerza.
   - reps: mínimo y máximo de los extremos de `target_reps`.
   - cardio: suma de minutos de cardio en la semana; la celda se oculta si no hay cardio.
3. **Selector de semana:** S1-S4 como control segmentado. Abre en la semana actual. La de descarga lleva marca "Descarga".
4. **Cuadrícula de días:** 2 columnas en móvil, hasta 4 en pantallas anchas. Cada tarjeta: día de la semana (`eyebrow`), título/enfoque del día, etiqueta, ✓ si tiene sesión completada. La seleccionada lleva borde volt. Es un `button` con `aria-pressed`.
5. **Barra de progreso:** "x de y entrenamientos" de la semana seleccionada.
6. **Detalle del día seleccionado:** título del día, sus `ExercisePreview` en el orden del plan y botón "Entrenar este día" a `/sesion/:programDayId`. Selección por defecto: el primer día sin completar de la semana; si todos están hechos, el primero.
7. **Acciones de bloque:** "Armar el siguiente bloque" o "Empezar un plan nuevo", igual que hoy.

El estado de semana y día seleccionados vive en el componente. No se sincroniza con la URL en esta iteración.

## 5. Hoy (`src/routes/Today.tsx`)

- Se mantiene el encabezado (wordmark, "Programa · Semana X de N", racha, sync, tema) y los avisos.
- **Nuevo:** `WeekMarks` debajo del encabezado en días de entrenamiento (hoy solo aparece en el día de descanso).
- Título del día, músculos y chip de cardio: igual.
- La lista de tarjetas `strip` compactas se reemplaza por `ExercisePreview`.
- **Tocar un ejercicio sigue entrando al entreno** (lo pidió el commit `ff71a41`). Como la foto abre el diálogo y "Cómo se hace" se despliega, la navegación va en el nombre y el chip de dosis: `ExercisePreview` acepta un `href` opcional y, si lo recibe, esa zona es un enlace a `/sesion/:programDayId`. En Plan se usa igual con el día seleccionado.
- El CTA sticky "Empezar/Continuar entrenamiento" no cambia.
- El día de descanso (`RestDay`) no cambia.

## 6. Fuera de alcance

- Session, Progreso, Perfil, Preferencias, Onboarding.
- Indicaciones cortas generadas por la IA (requiere prompt, esquema y columna nueva). Candidato a una iteración futura.
- Sección de cardio y alimentación de la referencia.
- Cambios de color o tipografía.

## 7. Rendimiento y datos

- Cada tarjeta pide dos imágenes en vez de una. Van con `loading="lazy"` y el service worker ya las cachea (`vite.config.ts`, caché `ejercicios-imagenes` para `cdn.jsdelivr.net`).
- En Plan solo se pintan las tarjetas del día seleccionado, no las de toda la semana.
- Offline: Hoy ya funciona con datos en Dexie; `ExercisePreview` no agrega dependencias de red más allá de las imágenes.

## 8. Pruebas

- `ExercisePreview`: dosis con descanso en fuerza; cardio muestra minutos y no fotos; `rest_seconds` 0 no muestra descanso; "Cómo se hace" se despliega; nombre traducido con fallback al catálogo.
- Función de formato de dosis y descanso: casos de 60 s, 90 s, 120 s, 150 s, 0 s, reps nulas.
- Resumen de la fila de datos del Plan: moda de series, rango de reps, cardio ausente.
- Plan: tocar un día cambia el detalle; la selección por defecto es el primer día pendiente; cambiar de semana reinicia la selección.
- Hoy: muestra `ExercisePreview` por ejercicio y el CTA sigue llevando a la sesión.
