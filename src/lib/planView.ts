import type { ProgramDay } from '@/lib/supabase/types'

/**
 * El día que se abre al entrar a una semana: el primero que falta por hacer,
 * que es el que la persona viene a mirar. Con la semana hecha, el primero.
 */
export function defaultDayId(weekDays: ProgramDay[], completed: Set<string>): string | null {
  const ordered = [...weekDays].sort((a, b) => a.day_index - b.day_index)
  return (ordered.find((d) => !completed.has(d.id)) ?? ordered[0])?.id ?? null
}
