import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Entrada numérica pensada para una mano sudada entre series.
 *
 * Los botones son de 48×48 y el valor central es un input real para quien
 * prefiera teclear. Los números van en la voz de la marca: tabulares,
 * pesados y ligeramente expandidos.
 */
type Props = {
  value: number | null
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
  label: string
  placeholder?: string
  className?: string
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
  label,
  placeholder = '—',
  className,
}: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const bump = (delta: number) => onChange(clamp(Math.round(((value ?? 0) + delta) * 100) / 100))

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label={`Bajar ${label}`}
        onClick={() => bump(-step)}
        className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--line)] active:bg-[var(--surface-2)]"
      >
        <Minus className="size-4" aria-hidden />
      </button>

      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (e.target.value !== '' && !Number.isNaN(n)) onChange(clamp(n))
          }}
          className={cn(
            'num w-full bg-transparent py-2 text-center text-2xl',
            'placeholder:text-[var(--fg-muted)] placeholder:font-normal',
          )}
        />
        {suffix && value !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-1 bottom-2 text-[0.6875rem] font-bold text-[var(--fg-muted)]"
          >
            {suffix}
          </span>
        )}
      </label>

      <button
        type="button"
        aria-label={`Subir ${label}`}
        onClick={() => bump(step)}
        className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--line)] active:bg-[var(--surface-2)]"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  )
}
