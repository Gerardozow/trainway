import { cn } from '@/lib/utils'
import type { HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export { Button, buttonClass } from './Button'
export { Stepper } from './Stepper'

/** La unidad de composición de toda la app. */
export function Strip({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('strip', className)} {...rest} />
}

export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('eyebrow', className)} {...rest} />
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5',
        'placeholder:text-[var(--fg-muted)]',
        className,
      )}
      {...rest}
    />
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 leading-relaxed',
        'placeholder:text-[var(--fg-muted)]',
        className,
      )}
      {...rest}
    />
  )
}

/** Opción tocable del wizard. 48px mínimo, estado seleccionado en amarillo. */
export function Chip({
  selected,
  children,
  onClick,
  className,
}: {
  selected: boolean
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-12 rounded-xl border px-4 font-semibold transition-colors',
        selected
          ? 'border-volt bg-volt text-volt-fg'
          : 'border-[var(--line)] bg-[var(--surface)] active:bg-[var(--surface-2)]',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        'inline-block size-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-volt',
        className,
      )}
    />
  )
}

/** Estados vacíos: una invitación a actuar, no un encogimiento de hombros. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h2 className="display text-xl">{title}</h2>
      <p className="max-w-xs text-sm text-[var(--fg-muted)]">{body}</p>
      {action}
    </div>
  )
}
