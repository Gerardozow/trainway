# Días de entrenamiento elegidos y flexibles — Diseño

**Fecha:** 2026-09-24
**Estado:** aprobado en conversación, pendiente de revisión del spec

---

## 1. Problema

Hoy la IA decide en qué día de la semana cae cada entrenamiento (`program_days.day_index`, 1 = lunes). El cuestionario solo pregunta cuántos días. Consecuencias:

- Quien entrena lunes, miércoles, viernes y sábado recibe un plan de lunes, martes, jueves y viernes, y no puede cambiarlo.
- Si un día vas en otro momento, Hoy dice "Hoy toca descansar". Se puede entrenar desde Plan, pero no es evidente.
- La racha se rompe si un día pasa sin hacerse, aunque lo recuperes al día siguiente.
- Un bloque empieza el día en que se crea (`starts_on` = fecha de creación) y `currentWeek` cuenta semanas de 7 días desde ahí. Si el bloque nace un miércoles, la "semana 1" va de miércoles a martes, mientras que los días son de la semana calendario. `weekMarks` y la racha mezclan los dos criterios.

La persona tiene días preferidos pero a veces mueve uno (opción C de la conversación).

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Días preferidos | Se eligen en el cuestionario y en Preferencias con chips L M X J V S D. `days_per_week` = cuántos se eligen |
| Dónde viven | En el plan activo (`program_days.day_index`). **Sin migración de base de datos** |
| Plan nuevo | El Worker recibe los días y la IA debe usar exactamente esos; el validador lo exige |
| Cambiar días con un plan activo | Si es la misma cantidad, se reasignan en el bloque actual sin regenerar. Si cambia la cantidad, hace falta rehacer el bloque |
| Ir otro día | Hoy ofrece el primer entrenamiento pendiente de la semana ("Adelantar" o "Recuperar") |
| Racha | Solo se rompe cuando termina una semana con entrenamientos pendientes |
| Semanas del bloque | Empiezan en lunes |
| Arrastrar días en Plan | Fuera de alcance |

## 3. Semanas que empiezan en lunes

- `worker/routes/plan.ts`: `starts_on` pasa a ser el lunes de la semana en curso, no la fecha de creación.
- `currentWeek` (`src/lib/supabase/queries.ts`) cuenta desde el lunes de `starts_on`. Así también se corrigen los bloques ya creados en otro día, sin tocar datos. Efecto en un bloque existente: su semana puede avanzar hasta dos días antes de lo que avanzaba; se acepta.
- Si el bloque nace a media semana, los días de esa semana que ya pasaron quedan pendientes y se pueden recuperar (sección 6).

## 4. Elegir días

**Componente `WeekdayPicker`** (`src/components/WeekdayPicker.tsx`): siete chips `L M X J V S D` con `aria-pressed` y nombre accesible completo ("Lunes"). Valor: `number[]` ordenado (1..7). Mínimo 2 días, como hoy (`days_per_week between 2 and 7`).

**Cuestionario** (`src/routes/Onboarding.tsx`): el paso "¿Cuántos días?" pasa a ser "¿Qué días vas al gym?" con `WeekdayPicker`. `days_per_week` = `days.length`. `generatePlan` envía los días.

**Preferencias** (`src/routes/Preferences.tsx`): el control de días por semana se sustituye por `WeekdayPicker`, precargado con los `day_index` del plan activo (o con los primeros N días si no hay plan). Al guardar:
- misma cantidad que el plan activo y días distintos → se reasignan los días del bloque (sección 5) y se guarda el cuestionario como hoy;
- otra cantidad → se guarda el cuestionario y se avisa de que hace falta "Rehacer el bloque" para aplicarlo. Rehacer envía los días elegidos.

**Siguiente bloque** (`PlanView.generateNextBlock`): envía los días del bloque que termina. Si la revisión baja la cantidad de días, se envían igualmente como días permitidos y la IA elige un subconjunto (sección 5).

## 5. Worker: plan con días dados

`POST /api/plan` acepta `days?: number[]` en el cuerpo.

- Se normaliza: enteros 1..7, sin repetidos, ordenados. Si hay menos que `intake.days_per_week`, se ignora (la IA elige como hoy).
- **Prompt** (`buildPlanPrompt`): si hay días, sustituye "Asigna day_index repartiendo los días…" por: `Usa exactamente ${days_per_week} de estos day_index: ${days.join(', ')} (1 = lunes). Reparte el trabajo para que un mismo grupo muscular no caiga en días seguidos.` Cuando `days.length === days_per_week` son exactamente esos.
- **Validación** (`validatePlan`): con días dados, cada `day_index` debe estar en el conjunto; si no, error descriptivo que alimenta el reintento que ya existe.
- **Reparación** (`repairPlan`): si el segundo intento sigue fuera del conjunto, se reasignan por orden: el i-ésimo día del plan (por `day_index`) pasa al i-ésimo día permitido. Nunca se descarta un plan por esto.

**Reasignar un bloque existente** (cliente, `src/lib/supabase/queries.ts` → `moveProgramDays(programId, from: number[], to: number[])`):
- Mueve cada `day_index` en todas las semanas del bloque con un `update … where program_id = P and day_index = X`.
- El orden de los movimientos lo decide una función pura `planMoves(from, to)` en `src/lib/schedule.ts`, que respeta la restricción `unique (program_id, week, day_index)`: primero los movimientos cuyo destino está libre; los ciclos se rompen usando un día libre como paso intermedio (siempre existe uno si hay menos de 7 días; con 7 no hay nada que mover).
- `swapExercise(..., 'bloque')` sigue funcionando porque se basa en `day_index` y todas las semanas se mueven juntas.
- No es atómico. Si falla a medias, el bloque queda con una mezcla válida de días (ninguna fila se pierde) y el error se muestra; volver a guardar lo completa.

## 6. Hoy: entrenar otro día

`loadToday` añade `pending`: el primer día de la semana actual, por `day_index`, sin sesión completada, distinto del de hoy.

- **Hoy tiene entrenamiento:** igual que ahora.
- **Hoy no tiene entrenamiento y hay `pending`:** se muestra la semana (`WeekSummary`), el aviso *"Hoy no estaba en tu plan. ¿Vas al gym?"*, el título del día pendiente con su día original ("Recuperar el martes" si ya pasó, "Adelantar el jueves" si viene), sus `ExercisePreview` con enlace a su sesión y el CTA volt "Recuperar …" / "Adelantar …".
- **Sin `pending`:** el día de descanso actual (`RestDay`).
- Los ejercicios y traducciones del día pendiente se cargan igual que los del día de hoy y entran en la caché offline (`db.cachedToday`).

La sesión de un día hecho en otra fecha ya funciona: `resolveSession` crea la sesión con fecha de hoy para ese `program_day_id`.

## 7. Semana y racha

- `weekMarks`: sin cambios de forma. "Hecho" ya se basa en `program_day_id`, así que un día recuperado se marca en su columna original.
- `sessionStreak` se reescribe:
  - suma las sesiones completadas de la semana actual;
  - recorre las semanas anteriores hacia atrás: si la semana tiene todos sus días completados, suma y sigue; si tiene alguno pendiente, se detiene sin sumarla.
  - La firma no cambia.

## 8. Fuera de alcance

- Arrastrar días en Plan.
- Guardar los días preferidos en `intakes` (necesitaría migración).
- Recordatorios o notificaciones por día.
- Cambiar el aspecto de los días perdidos en `WeekMarks`.

## 9. Pruebas

- `planMoves`: identidad; desplazamiento simple (1→2 con 2 libre); intercambio (1↔3) con día libre; ciclo de tres; destino ocupado por otro que también se mueve.
- `mondayOf` y `currentWeek` con `starts_on` en miércoles: lunes de la semana siguiente ya es semana 2.
- `sessionStreak`: semana actual parcial, semana pasada completa, semana pasada con un pendiente (corta), día recuperado en otra fecha cuenta.
- `pendingDay`: primero sin hacer por orden; excluye hoy; semana hecha → null.
- Worker: prompt incluye los días; `validatePlan` rechaza un `day_index` fuera del conjunto; `repairPlan` reasigna por orden; cuerpo con días inválidos se ignora.
- `WeekdayPicker`: alternar, mínimo 2 bloquea continuar en el cuestionario.
- Hoy: sin entrenamiento hoy y con pendiente → aviso y CTA al día pendiente; sin pendiente → descanso.
