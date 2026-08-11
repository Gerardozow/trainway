import { cn } from '@/lib/utils'
import type { WeekMark } from '@/lib/history'

/**
 * La semana en siete marcas.
 *
 * Es el mismo amarillo de la serie llena, a escala de semana: entrenado es una
 * marca llena, hoy va perfilado y lo que falta queda hueco. Un día saltado no
 * se pinta en rojo — el plan no regaña, y el hueco ya se ve solo.
 */
export function WeekMarks({ marks, className }: { marks: WeekMark[]; className?: string }) {
  const hechos = marks.filter((m) => m.done).length
  const previstos = marks.filter((m) => m.planned).length

  return (
    <ol
      className={cn('flex justify-between gap-1', className)}
      aria-label={`Semana: ${hechos} de ${previstos} entrenamientos hechos`}
    >
      {marks.map((m) => (
        <li key={m.dayIndex} className="flex flex-1 flex-col items-center gap-2">
          {/* Hoy se marca en la letra, no en la casilla: un día de descanso es
              una raya baja, y rodear una raya de negro grita por nada. */}
          <span
            className={cn(
              'eyebrow rounded px-1 text-[0.625rem]',
              m.today ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg-muted)]',
            )}
          >
            {m.initial}
          </span>

          {/* La altura ES la carga. Un día con entrenamiento ocupa; uno de
              descanso es una raya al ras. Al revés —que era como estaba— el
              descanso pesaba más que el entreno.

              La banda de altura fija va aparte para que las siete letras queden
              en la misma línea: colgadas de su propia marca, subían y bajaban
              con ella y la fila se leía rota. */}
          <span className="flex h-9 w-full items-end">
            <span
              title={m.title ?? undefined}
              className={cn(
                'w-full rounded-md transition-colors',
                m.planned ? 'h-full border' : 'h-1.5 bg-[var(--surface-2)]',
                m.planned && m.done && 'border-volt bg-volt',
                m.planned && !m.done && 'border-dashed border-[var(--fg-muted)]',
              )}
            >
              <span className="sr-only">
                {m.done
                  ? `${m.title}: hecho`
                  : m.planned
                    ? `${m.title}: ${m.missed ? 'sin hacer' : 'pendiente'}`
                    : 'descanso'}
              </span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
