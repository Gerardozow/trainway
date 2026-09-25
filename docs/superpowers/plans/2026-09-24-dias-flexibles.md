# Días elegidos y flexibles — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La persona elige sus días de entrenamiento; la IA los respeta; el bloque se puede reacomodar; Hoy ofrece recuperar o adelantar lo pendiente; la racha solo se rompe al cerrar una semana incompleta.

**Architecture:** Lógica de calendario pura en `src/lib/schedule.ts` (lunes de una fecha, orden de movimientos, día pendiente). El Worker recibe `days` en `/api/plan` y los impone en prompt, validación y reparación. La UI usa un `WeekdayPicker` en cuestionario y Preferencias. Sin migraciones: los días viven en `program_days.day_index`.

**Tech Stack:** React 19, TypeScript, Vitest, Cloudflare Worker, Supabase (PostgREST).

**Spec:** `docs/superpowers/specs/2026-09-24-dias-flexibles-design.md`

## Global Constraints

- Sin migraciones de base de datos.
- `day_index` 1..7 con lunes = 1; restricción `unique (program_id, week, day_index)`.
- Mínimo 2 días, máximo 7.
- Textos en español de México; comentarios con la densidad y tono del código existente.

## Review Focus

- Bloque creado un miércoles: el lunes siguiente es semana 2 y los días pasados de la semana 1 aparecen como pendientes, no como "próximos".
- Reacomodar con un intercambio (lunes↔miércoles) no viola la restricción única.
- Worker recibe `days` con basura (`[0, 9, 'x', 3, 3]`): se ignora sin romper la generación.
- La revisión baja de 4 a 3 días y se envían 4 permitidos: la IA elige 3 de esos 4.
- Hoy sin entrenamiento y con semana completa: descanso, no un día ya hecho.

---

### Task 1: Calendario puro y racha

**Files:** Create `src/lib/schedule.ts`, `tests/schedule.test.ts`. Modify `src/lib/supabase/queries.ts` (`currentWeek`), `src/lib/history.ts` (`sessionStreak`), `tests/history.test.ts`.

**Produces:**
- `mondayOf(date: Date): Date` — medianoche local del lunes de esa semana.
- `planMoves(from: number[], to: number[]): { from: number; to: number }[]` — movimientos en orden seguro para la restricción única; usa un día libre para romper ciclos. `from`/`to` misma longitud, se emparejan ordenados.
- `pendingDay(days: ProgramDay[], completed: Set<string>, week: number, todayIndex: number): ProgramDay | null`.
- `currentWeek` cuenta desde `mondayOf(starts_on)`.
- `sessionStreak` con la regla de semanas cerradas (firma igual).

- [ ] Tests RED → implementar → GREEN → commit `feat: calendario de semanas en lunes, movimientos de dias y racha por semana`.

### Task 2: Worker con días dados

**Files:** Modify `worker/lib/validate.ts`, `worker/lib/prompt.ts`, `worker/routes/plan.ts`; tests `tests/worker-validate.test.ts`, `tests/worker-days.test.ts`.

**Produces:**
- `normalizeDays(raw: unknown, count: number): number[] | null` — enteros 1..7 únicos ordenados; `null` si quedan menos de `count`.
- `validatePlan(raw, candidateIds, allowedDays?: number[])` — error si un `day_index` no está permitido.
- `repairDays(plan: AiPlan, allowedDays: number[]): AiPlan` — i-ésimo día (orden por `day_index`) → i-ésimo permitido, solo si alguno está fuera.
- `dayRule(days: number[] | null, count: number): string` en prompt.
- `/api/plan` lee `body.days`; `starts_on` = lunes de la semana en curso (fecha ISO).

- [ ] Tests RED → implementar → GREEN → commit `feat: el plan usa los dias que elige la persona`.

### Task 3: Elegir días en el cuestionario

**Files:** Create `src/components/WeekdayPicker.tsx`, `tests/weekday-picker.test.tsx`. Modify `src/routes/Onboarding.tsx`, `src/lib/api.ts`.

**Produces:** `WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void })`. `generatePlan(intakeId, opts?: { previousReview?: string; days?: number[] })`.

- [ ] Onboarding: paso 1 "¿Qué días vas al gym?", `canAdvance` exige ≥ 2, `days_per_week = days.length`, envía `days`.
- [ ] Tests RED → GREEN → commit `feat: el cuestionario pregunta que dias vas, no cuantos`.

### Task 4: Cambiar días con plan activo

**Files:** Modify `src/routes/Preferences.tsx`, `src/routes/PlanView.tsx`, `src/lib/supabase/queries.ts` (`moveProgramDays`), tests `tests/move-days.test.ts`.

- [ ] `moveProgramDays(programId, from, to)` aplica `planMoves` con un `update` por movimiento.
- [ ] Preferencias: `WeekdayPicker` sembrado con los días del plan activo; guardar con misma cantidad y días distintos → `moveProgramDays`; otra cantidad → aviso "Para aplicar otra cantidad de días hay que rehacer el bloque". Rehacer envía `days`.
- [ ] PlanView siguiente bloque envía los días del bloque actual.
- [ ] Tests (moveProgramDays con cliente simulado: orden de updates) → commit `feat: cambiar los dias reacomoda el bloque sin rehacerlo`.

### Task 5: Hoy ofrece lo pendiente

**Files:** Modify `src/routes/Today.tsx`, `tests/today-view.test.tsx`.

- [ ] `loadToday` calcula `pending` con `pendingDay` y carga sus ejercicios y traducciones cuando hoy no hay día.
- [ ] `TodayView`: sin día hoy y con pendiente → aviso, título "Recuperar el martes"/"Adelantar el jueves", `ExercisePreview` con enlace y CTA; sin pendiente → `RestDay`.
- [ ] Tests RED → GREEN → commit `feat: Hoy ofrece recuperar o adelantar el entrenamiento pendiente`.

### Task 6: Verificación y deploy

- [ ] Suite, typecheck, build; revisión final con subagente; fixes; push; `npx wrangler deploy`; comprobar URL.
