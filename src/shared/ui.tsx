import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

/**
 * Primitivas de interfaz. Existen para que las pantallas no repartan clases
 * sueltas por todas partes: cuando el sistema cambie, cambia aquí.
 *
 * El lenguaje viene del prototipo: bordes generosos, etiquetas diminutas en
 * mayúscula con mucho tracking, y superficies que se levantan del fondo en vez
 * de dibujarse con sombras.
 */

type Tone = 'strength' | 'cardio' | 'neutral' | 'ok'

const TONE_TEXT: Record<Tone, string> = {
  strength: 'text-strength',
  cardio: 'text-cardio',
  ok: 'text-ok',
  neutral: 'text-content-muted',
}

const TONE_BG: Record<Tone, string> = {
  strength: 'bg-strength-soft',
  cardio: 'bg-cardio-soft',
  ok: 'bg-surface-sunken',
  neutral: 'bg-surface-sunken',
}

/** Etiqueta diminuta en mayúscula. El detalle que más define el prototipo. */
export function Eyebrow({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: Tone
}) {
  return (
    <span
      className={`text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${TONE_TEXT[tone]}`}
    >
      {children}
    </span>
  )
}

/** Píldora de categoría: fuerza, cardio, descanso. */
export function Tag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: Tone
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.05em] ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
    >
      {children}
    </span>
  )
}

export function Card({
  children,
  className = '',
  tone,
}: {
  children: ReactNode
  className?: string
  /** Con tono, el borde se enciende al pasar por encima. */
  tone?: Tone
}) {
  const hover =
    tone === 'strength'
      ? 'hover:border-strength'
      : tone === 'cardio'
        ? 'hover:border-cardio'
        : ''

  return (
    <div
      className={`rounded-2xl border border-border bg-surface-raised transition-colors ${hover} ${className}`}
    >
      {children}
    </div>
  )
}

/** Cifra grande con su etiqueta debajo. Las del encabezado del prototipo. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-[110px] flex-1 rounded-2xl border border-border bg-surface-raised px-5 py-4">
      <div className="font-display text-[1.9rem] font-extrabold leading-none text-content">
        {value}
      </div>
      <div className="mt-1 text-[0.68rem] uppercase tracking-[0.1em] text-content-muted">
        {label}
      </div>
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
}

const VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  // El amarillo de marca solo aquí: es la acción principal, nada más.
  primary: 'bg-brand text-brand-content font-semibold hover:brightness-95',
  secondary:
    'border border-border text-content hover:border-content-muted bg-transparent',
  ghost: 'text-content-muted hover:text-content bg-transparent',
  danger: 'border border-danger text-danger hover:bg-danger-soft bg-transparent',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const sizing = size === 'lg' ? 'px-5 py-4 text-lg' : 'px-4 py-3'

  return (
    <button
      {...props}
      className={`rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${VARIANT[variant]} ${className}`}
    />
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  /** Los campos del registro de series se usan de pie, con una mano. */
  big?: boolean
}

export function Field({ label, big = false, id, className = '', ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-content-muted"
      >
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={`w-full rounded-xl border border-border bg-surface-raised text-content transition placeholder:text-content-muted focus:border-content-muted focus:outline-none ${
          big ? 'px-4 py-4 text-2xl' : 'px-4 py-3'
        } ${className}`}
      />
    </div>
  )
}

/** Mensaje de error. Siempre anunciado, siempre en el color de peligro. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  )
}

/** Barra de progreso con el degradado fuerza → cardio del prototipo. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-2.5 overflow-hidden rounded-full bg-surface-sunken"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-strength to-cardio transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Encabezado de sección con su número, como el prototipo. */
export function SectionHead({
  index,
  title,
  subtitle,
}: {
  index?: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-baseline gap-3">
        {index && (
          <span className="rounded-lg border border-border px-2 py-0.5 font-display text-sm font-extrabold text-content-muted">
            {index}
          </span>
        )}
        <h2 className="text-2xl font-bold text-content">{title}</h2>
      </div>
      {subtitle && (
        <p className="mt-2 max-w-xl text-sm text-content-muted">{subtitle}</p>
      )}
    </div>
  )
}

/** Estado vacío: dice qué falta y qué hacer, no solo que no hay nada. */
export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <p className="font-display text-lg font-bold text-content">{title}</p>
      {hint && <p className="max-w-sm text-sm text-content-muted">{hint}</p>}
      {action}
    </div>
  )
}
