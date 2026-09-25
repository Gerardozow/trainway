import { cn, dayName } from '@/lib/utils'

const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Qué días va la persona al gimnasio.
 *
 * Días concretos y no una cantidad: "cuatro días" dejaba que la IA eligiera
 * lunes, martes, jueves y viernes a quien va lunes, miércoles, viernes y
 * sábado. La cantidad sale sola de lo que se marque.
 */
export function WeekdayPicker({
  value,
  onChange,
}: {
  /** day_index de 1 (lunes) a 7 (domingo), ordenados. */
  value: number[]
  onChange: (days: number[]) => void
}) {
  const toggle = (d: number) =>
    onChange(
      value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b),
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1.5">
        {INICIALES.map((inicial, i) => {
          const d = i + 1
          const on = value.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={dayName(d)}
              onClick={() => toggle(d)}
              className={cn(
                'press num grid aspect-square min-h-11 place-items-center rounded-xl border text-base',
                on
                  ? 'border-volt bg-volt text-volt-fg'
                  : 'border-[var(--line)] bg-[var(--surface)] active:bg-[var(--surface-2)]',
              )}
            >
              {inicial}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-[var(--fg-muted)]">
        {value.length === 1 ? '1 día por semana' : `${value.length} días por semana`}
      </p>
    </div>
  )
}
