# Plan y Hoy con tarjetas grandes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan y Hoy muestran cada ejercicio en una tarjeta grande con las dos fotos, dosis con descanso, nota del coach y "Cómo se hace"; Plan pasa a selector de semana + cuadrícula de días + detalle de un día.

**Architecture:** Funciones puras de formato y resumen en `src/lib/dose.ts`. `ExerciseImage` gana una variante `pair` (dos frames lado a lado) que reutiliza su diálogo. `ExercisePreview` compone todo y lo usan Hoy y Plan. La lógica de Plan (semana y día por defecto) es pura y se prueba aparte; la vista presentacional `PlanWeek` recibe datos ya cargados.

**Tech Stack:** React 19, TypeScript, Tailwind v4, TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-plan-hoy-tarjetas-design.md`

## Global Constraints

- Sin cambios de backend, prompt, esquema ni base de datos.
- Tokens visuales actuales: `volt`, `--surface`, `--surface-2`, `--line`, `--fg-muted`, `.strip`, `.eyebrow`, `.num`, `.display`. Sin colores nuevos.
- Session, Progreso, Perfil, Preferencias y Onboarding no cambian.
- Tocar el nombre/dosis de un ejercicio en Hoy entra al entreno (commit `ff71a41`), salvo si la sesión de hoy ya está completada.
- Textos en español de México; comentarios con la densidad y tono del código existente.

## Review Focus

- Ejercicio cuyo `exercise_id` ya no existe en el catálogo: la tarjeta no se pinta (igual que hoy), sin romper la lista.
- `target_reps` nulo o con formato raro ("AMRAP", "8"): la dosis no muestra "undefined" ni "×  ·".
- Semana sin días (plan corto o datos incompletos): Plan no revienta y no ofrece "Entrenar este día".
- Traducción ausente u offline: nombre e instrucciones caen al catálogo en inglés.
- Imagen que falla al cargar en la variante `pair`: fallback de mancuerna, sin diálogo roto.

---

### Task 1: Formato de dosis y resumen del plan

**Files:**
- Create: `src/lib/dose.ts`
- Test: `tests/dose.test.ts`

**Interfaces:**
- Produces:
  - `formatRest(seconds: number): string | null` — `null` si ≤ 0; `"90 s"` bajo 120; `"2 min"`, `"2:30 min"` desde 120.
  - `formatDose(ex: Pick<ProgramExercise, 'category' | 'target_sets' | 'target_reps' | 'target_duration_seconds' | 'rest_seconds'>): string` — fuerza `"3 × 10-12 · 90 s"`; sin reps `"3 series · 90 s"`; cardio `"15 min"`.
  - `planSummary(exercises: ProgramExercise[], trainingDays: number): { days: number; sets: number | null; reps: string | null; cardioMinutes: number }` — moda de series de fuerza, rango de reps con min/max de números encontrados en `target_reps`, suma de minutos de cardio.

- [ ] Tests: `formatRest` con 0, 60, 90, 120, 150; `formatDose` fuerza, reps nulas, reps `"AMRAP"`, rest 0, cardio; `planSummary` con moda, rango `"8-12"` desde `["8-10","10-12"]`, sin cardio → 0, sin fuerza → `sets: null, reps: null`.
- [ ] Verificar que fallan, implementar, verificar que pasan.
- [ ] Commit `feat: formato de dosis con descanso y resumen del plan`.

### Task 2: `ExerciseImage` variante `pair`

**Files:**
- Modify: `src/components/ExerciseImage.tsx`
- Test: `tests/exercise-image.test.tsx`

**Interfaces:**
- Produces: prop `variant?: 'thumb' | 'pair'` (por defecto `'thumb'`, comportamiento actual intacto). `pair`: rejilla de 2 columnas, cada frame `aspect-[4/3]`, etiqueta "1 Inicio" / "2 Fin", un solo botón que abre el mismo diálogo. Si cualquier frame falla, fallback de mancuerna en ese frame; el diálogo sigue disponible mientras al menos uno cargó.

- [ ] Tests: `pair` pinta dos `img` con alt de posición inicial/final; tocar abre el diálogo (`showModal` stub en jsdom); `thumb` sigue pintando una sola imagen.
- [ ] Implementar, pasar, commit `feat: variante de dos fotos en ExerciseImage`.

### Task 3: `ExercisePreview`

**Files:**
- Create: `src/components/ExercisePreview.tsx`
- Test: `tests/exercise-preview.test.tsx`

**Interfaces:**
- Consumes: `formatDose` (Task 1), `ExerciseImage variant="pair"` (Task 2).
- Produces: `ExercisePreview({ exercise, translation, href }: { exercise: ProgramExercise; translation?: ExerciseTranslation; href?: string })`. Devuelve `null` si el ejercicio no está en el catálogo. Con `href`, el bloque nombre + dosis es un `<Link>`.

- [ ] Tests: dosis con descanso; cardio sin fotos y con minutos; `coach_note` visible; "Cómo se hace" despliega pasos; nombre traducido y fallback; con `href` hay enlace, sin `href` no; id inexistente → nada.
- [ ] Implementar, pasar, commit `feat: tarjeta grande de ejercicio para Hoy y Plan`.

### Task 4: Hoy con tarjetas grandes

**Files:**
- Modify: `src/routes/Today.tsx`

- [ ] Reemplazar la lista compacta por `ExercisePreview` en rejilla `grid gap-3 sm:grid-cols-2`, con `href` salvo si `isDone`. Pasar la traducción completa.
- [ ] Añadir `WeekMarks` con "x de y" bajo el encabezado en días de entrenamiento.
- [ ] Ampliar el ancho del `main` a `max-w-3xl` para que la rejilla de dos columnas tenga sitio en pantallas anchas (móvil igual).
- [ ] `npm test`, `npm run typecheck`, commit `feat: Hoy enseña cada ejercicio con sus dos fotos y la dosis completa`.

### Task 5: Plan con semana, días y detalle

**Files:**
- Create: `src/lib/planView.ts` (`defaultDayId(weekDays, completed): string | null`)
- Create: `src/components/PlanWeek.tsx` (presentacional)
- Modify: `src/routes/PlanView.tsx`
- Test: `tests/plan-week.test.tsx`

**Interfaces:**
- `defaultDayId(weekDays: ProgramDay[], completed: Set<string>): string | null` — primer día (por `day_index`) sin completar; si todos, el primero; semana vacía → `null`.
- `PlanWeek({ days, exercises, translations, completed, week, currentWeek, weeks, onWeekChange })` — pinta fila de datos (`planSummary`), selector S1…Sn, cuadrícula de días, barra de progreso y detalle con `ExercisePreview` + "Entrenar este día".

- [ ] Tests de `defaultDayId` (orden, todos hechos, vacío) y de `PlanWeek`: tocar un día cambia el detalle; cambiar semana reinicia la selección; semana vacía no ofrece "Entrenar este día".
- [ ] `PlanView` carga traducciones (`getTranslations`) en su query y usa `PlanWeek`; se elimina el acordeón.
- [ ] `npm test`, `npm run typecheck`, commit `feat: Plan por semana con cuadrícula de días y tarjetas grandes`.

### Task 6: Verificación y deploy

- [ ] `npm test`, `npm run build`.
- [ ] Revisión visual en el navegador (dev server) de Hoy y Plan en ancho móvil.
- [ ] Commit aparte de los básicos de gimnasio pendientes (`src/lib/catalog/filter.ts`, `index.ts`, test, `worker/routes/plan.ts`).
- [ ] `npm run deploy` y comprobar que la URL responde.
- [ ] `git push`.
