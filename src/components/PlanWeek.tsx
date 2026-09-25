import { useState } from 'react'
import { Link } from 'react-router'
import { Check, ChevronRight } from 'lucide-react'
import { muscleEs } from '@/lib/catalog'
import { planSummary } from '@/lib/dose'
import { defaultDayId } from '@/lib/planView'
import type { ExerciseTranslation, ProgramDay, ProgramExercise } from '@/lib/supabase/types'
import { cn, dayName } from '@/lib/utils'
import { buttonClass } from '@/components/ui'
import { ExercisePreview } from './ExercisePreview'

/**
 * Una semana del bloque: sus números, sus días y un día abierto.
 *
 * Un día a la vez y no la semana entera. Con cinco días de seis ejercicios
 * serían treinta tarjetas con fotos, y lo que se viene a mirar casi siempre es
 * un solo día: el siguiente.
 */
export function PlanWeek({
  days,
  exercises,
  translations,
  completed,
  weeks,
  currentWeek,
}: {
  days: ProgramDay[]
  exercises: ProgramExercise[]
  translations: Record<string, ExerciseTranslation>
  completed: Set<string>
  weeks: number
  currentWeek: number
}) {
  const [week, setWeek] = useState(currentWeek)
  const [picked, setPicked] = useState<string | null>(null)

  const weekDays = days.filter((d) => d.week === week).sort((a, b) => a.day_index - b.day_index)
  const selectedId =
    picked && weekDays.some((d) => d.id === picked) ? picked : defaultDayId(weekDays, completed)
  const selected = weekDays.find((d) => d.id === selectedId) ?? null

  const weekDayIds = new Set(weekDays.map((d) => d.id))
  const weekExercises = exercises.filter((e) => weekDayIds.has(e.program_day_id))
  const dayExercises = selected
    ? exercises
        .filter((e) => e.program_day_id === selected.id)
        .sort((a, b) => a.position - b.position)
    : []

  const selectedDone = selected ? completed.has(selected.id) : false
  const summary = planSummary(weekExercises, weekDays.length)
  const doneCount = weekDays.filter((d) => completed.has(d.id)).length

  const isDeload = (w: number) => days.some((d) => d.week === w && d.is_deload)

  const stats = [
    { value: String(summary.days), label: 'Días' },
    summary.sets !== null && { value: `${summary.sets}×`, label: 'Series' },
    summary.reps !== null && { value: summary.reps, label: 'Reps' },
    summary.cardioMinutes > 0 && { value: `${summary.cardioMinutes}′`, label: 'Cardio' },
  ].filter(Boolean) as { value: string; label: string }[]

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Semanas del bloque"
        className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--surface-2)] p-1"
      >
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
          <button
            key={w}
            type="button"
            role="tab"
            aria-selected={w === week}
            aria-label={`Semana ${w}${isDeload(w) ? ', descarga' : ''}${w === currentWeek ? ', actual' : ''}`}
            onClick={() => {
              setWeek(w)
              setPicked(null)
            }}
            className={cn(
              'flex min-h-12 flex-col items-center justify-center rounded-lg px-1 transition-colors',
              w === week
                ? 'bg-[var(--surface)] shadow-[var(--shadow-strip)]'
                : 'text-[var(--fg-muted)]',
            )}
          >
            <span className="num text-base">S{w}</span>
            {(isDeload(w) || w === currentWeek) && (
              <span
                className={cn(
                  'text-[0.625rem] font-semibold uppercase',
                  w === currentWeek && 'text-volt-ink',
                )}
              >
                {w === currentWeek ? 'Actual' : 'Descarga'}
              </span>
            )}
          </button>
        ))}
      </div>

      {stats.length > 0 && weekDays.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="strip flex flex-col-reverse px-4 py-3">
              <dt className="eyebrow">{s.label}</dt>
              <dd className="num text-2xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {weekDays.length === 0 ? (
        <p className="strip p-4 text-sm text-[var(--fg-muted)]">
          Esta semana no tiene entrenamientos.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {weekDays.map((d) => {
              const done = completed.has(d.id)
              const active = d.id === selectedId
              return (
                <li key={d.id} className="flex">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPicked(d.id)}
                    className={cn(
                      'press strip relative flex w-full flex-col gap-1 p-3 pr-9 text-left transition-colors',
                      active && 'border-volt',
                    )}
                  >
                    <span className="eyebrow">{dayName(d.day_index)}</span>
                    <span className="display text-base leading-tight">{d.title}</span>
                    <span className="line-clamp-1 text-xs text-[var(--fg-muted)]">
                      {d.focus.map(muscleEs).join(' · ')}
                    </span>
                    <span
                      aria-label={done ? 'Hecho' : undefined}
                      className={cn(
                        'absolute top-3 right-3 grid size-5 place-items-center rounded-full border-2',
                        done ? 'border-volt bg-volt text-volt-fg' : 'border-[var(--line)]',
                      )}
                    >
                      {done && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex flex-col gap-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-volt transition-[width] duration-500"
                style={{ width: `${(doneCount / weekDays.length) * 100}%` }}
              />
            </div>
            <p className="text-sm text-[var(--fg-muted)]">
              {`${doneCount} de ${weekDays.length} entrenamientos`}
            </p>
          </div>
        </section>
      )}

      {selected && (
        <section aria-label="Día seleccionado" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="eyebrow">
              {dayName(selected.day_index)}
              {selected.is_deload && ' · Descarga'}
            </p>
            <h2 className="display text-2xl">{selected.title}</h2>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {dayExercises.map((ex) => (
              <li key={ex.id} className="flex">
                <ExercisePreview
                  exercise={ex}
                  translation={translations[ex.exercise_id]}
                  href={selectedDone ? undefined : `/sesion/${selected.id}`}
                />
              </li>
            ))}
          </ul>

          {/* Un día hecho no enlaza a la sesión: /sesion abre una nueva con
              fecha de hoy y las series vacías, no enseña lo que se hizo. */}
          {selectedDone ? (
            <p className="flex items-center justify-center gap-2 rounded-xl border border-volt bg-volt/10 px-4 py-4 font-bold">
              <Check className="size-5" strokeWidth={3} aria-hidden />
              Día completado
            </p>
          ) : (
            <Link
              to={`/sesion/${selected.id}`}
              className={buttonClass({ variant: 'volt', size: 'lg', full: true })}
            >
              Entrenar este día
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          )}
        </section>
      )}
    </div>
  )
}
