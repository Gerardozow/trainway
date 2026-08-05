import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'volt' | 'solid' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // El amarillo SIEMPRE lleva texto oscuro encima. Nunca es color de texto en claro.
  volt: 'bg-volt text-volt-fg hover:brightness-95 active:brightness-90',
  solid: 'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90',
  outline: 'border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]',
  ghost: 'hover:bg-[var(--surface-2)]',
  danger: 'text-red-600 dark:text-red-400 hover:bg-red-500/10',
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-12 px-4 text-[0.9375rem]', // 48px: el mínimo táctil
  lg: 'min-h-14 px-6 text-base',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  full?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'outline',
  size = 'md',
  full = false,
  className,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold',
        'transition-[filter,background-color,opacity] duration-150',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    />
  )
}
