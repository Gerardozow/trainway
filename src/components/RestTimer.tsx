import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { loadSettings } from '@/lib/settings'
import { playRestDone } from '@/lib/sound'
import { formatDuration } from '@/lib/utils'

/**
 * Arranca solo al marcar una serie. Ocupa el ancho completo abajo, encima de la
 * navegación: es lo único que importa mirar en ese momento.
 *
 * El descanso prescrito es una estimación, no una ley: hay días de subir la
 * carga y días de tener prisa. Los botones de ±  ajustan sobre la marcha sin
 * salir de la pantalla.
 */
export function RestTimer({
  seconds,
  startedAt,
  onAdjust,
  onDismiss,
}: {
  seconds: number
  startedAt: number
  onAdjust: (deltaSeconds: number) => void
  onDismiss: () => void
}) {
  const [remaining, setRemaining] = useState(seconds)
  const buzzed = useRef(false)

  useEffect(() => {
    // Alargar el descanso después de que suene tiene que volver a sonar.
    buzzed.current = false

    const tick = () => {
      const left = seconds - Math.floor((Date.now() - startedAt) / 1000)
      setRemaining(left)

      if (left <= 0 && !buzzed.current) {
        buzzed.current = true
        // Se leen las preferencias en el momento del aviso: cambiarlas en otra
        // pestaña no debería exigir reiniciar el descanso.
        const settings = loadSettings()
        if (settings.vibrate) navigator.vibrate?.([200, 100, 200])
        if (settings.sound) playRestDone()
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
      {/* La misma barra de la serie, vaciándose por donde se llenó.
          Sólida y fina en el borde inferior: un bloque translúcido de amarillo
          sobre negro se vuelve un oliva sucio, y esto se lee limpio en ambos
          temas sin competir con el número. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-[var(--surface-2)]">
        <div
          className="carga carga-lineal size-full bg-volt"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <div className="relative flex items-center gap-1 px-3 py-2">
        <div className="flex min-w-24 flex-col">
          <span className="eyebrow">{done ? 'Listo' : 'Descanso'}</span>
          <span className="num text-2xl tabular-nums">
            {done ? '¡Vamos!' : formatDuration(remaining)}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            aria-label="Quitar 15 segundos de descanso"
            className="press num flex h-12 min-w-12 items-center justify-center gap-0.5 rounded-xl border border-[var(--line)] px-2 text-sm active:bg-[var(--surface-2)]"
          >
            <Minus className="size-3.5" aria-hidden />
            15
          </button>

          <button
            type="button"
            onClick={() => onAdjust(30)}
            aria-label="Añadir 30 segundos de descanso"
            className="press num flex h-12 min-w-12 items-center justify-center gap-0.5 rounded-xl border border-[var(--line)] px-2 text-sm active:bg-[var(--surface-2)]"
          >
            <Plus className="size-3.5" aria-hidden />
            30
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Saltar descanso"
            className="press grid size-12 place-items-center rounded-xl active:bg-[var(--surface-2)]"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
