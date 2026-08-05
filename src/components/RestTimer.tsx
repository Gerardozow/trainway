import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { formatDuration } from '@/lib/utils'

/**
 * Arranca solo al marcar una serie. Ocupa el ancho completo abajo, encima de la
 * navegación: es lo único que importa mirar en ese momento.
 */
export function RestTimer({
  seconds,
  startedAt,
  onDismiss,
}: {
  seconds: number
  startedAt: number
  onDismiss: () => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const buzzed = useRef(false)

  useEffect(() => {
    buzzed.current = false

    const tick = () => {
      const left = seconds - Math.floor((Date.now() - startedAt) / 1000)
      setRemaining(left)

      if (left <= 0 && !buzzed.current) {
        buzzed.current = true
        navigator.vibrate?.([200, 100, 200])
      }
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [seconds, startedAt])

  const done = remaining <= 0
  const progress = Math.max(0, Math.min(1, remaining / seconds))

  return (
    <div
      role="timer"
      aria-live="off"
      className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"
    >
      {/* Barra sólida y fina en el borde inferior. Un bloque translúcido de
          amarillo sobre negro se vuelve un oliva sucio; esto se lee limpio en
          ambos temas y no compite con el número. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1 bg-[var(--surface-2)]"
      >
        <div
          className="h-full bg-volt transition-[width] duration-200 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="relative flex items-center justify-between px-4 py-3">
        <div className="flex flex-col">
          <span className="eyebrow">{done ? 'Listo' : 'Descanso'}</span>
          <span className="num text-2xl tabular-nums">
            {done ? '¡Vamos!' : formatDuration(remaining)}
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Saltar descanso"
          className="grid size-12 place-items-center rounded-xl active:bg-[var(--surface-2)]"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
